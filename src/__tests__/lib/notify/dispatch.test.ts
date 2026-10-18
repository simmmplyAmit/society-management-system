import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    maintenancePayment: { findMany: vi.fn() },
    notificationLog: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notify/sms", () => ({ sendSms: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify/email";
import { sendSms } from "@/lib/notify/sms";
import { notifyPayments } from "@/lib/notify/dispatch";

const user = (over: Record<string, unknown> = {}) => ({
  id: "u1", name: "Rahul", email: "r@x.com", phone: "+919876543210",
  emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), isActive: true, ...over,
});
const payment = (residents: unknown[], over: Record<string, unknown> = {}) => ({
  id: "p1", societyId: "s1", month: 10, year: 2026, amount: 2500, paidAt: null, utrNumber: null,
  society: { name: "Sunrise", upiId: "sun@upi", hasWings: true },
  flat: { number: "101", floor: { number: 1, wing: { name: "A" } }, residents },
  ...over,
});
const resident = (u: unknown, isPrimary = true) => ({ isPrimary, user: u });

const findPayments = vi.mocked(prisma.maintenancePayment.findMany);
const log = vi.mocked(prisma.notificationLog);
const items = [{ paymentId: "p1", keySuffix: "x" }];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
  vi.mocked(sendSms).mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyPayments", () => {
  it("emails and texts a verified resident and logs both as SENT", async () => {
    findPayments.mockResolvedValue([payment([resident(user())])] as never);
    const r = await notifyPayments("DUE_CREATED", items, "s1");
    expect(r).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "r@x.com" }));
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: "+919876543210", template: "due" }));
    expect(log.update).toHaveBeenCalledTimes(2);
    expect(log.update.mock.calls[0][0].data).toEqual({ status: "SENT" });
  });

  it("scopes the payment lookup to the society when one is given", async () => {
    findPayments.mockResolvedValue([]);
    await notifyPayments("DUE_CREATED", items, "s1");
    expect(findPayments.mock.calls[0][0]!.where).toEqual({ id: { in: ["p1"] }, societyId: "s1" });
  });

  it("never contacts unverified channels", async () => {
    findPayments.mockResolvedValue([
      payment([resident(user({ emailVerifiedAt: null }))]),
    ] as never);
    await notifyPayments("DUE_CREATED", items);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    findPayments.mockResolvedValue([
      payment([resident(user({ emailVerifiedAt: null, phoneVerifiedAt: null }))]),
    ] as never);
    const r = await notifyPayments("DUE_CREATED", items);
    expect(r).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("skips a flat with no residents and inactive residents", async () => {
    findPayments.mockResolvedValue([
      payment([]),
      payment([resident(user({ isActive: false }))], { id: "p2" }),
    ] as never);
    const r = await notifyPayments("DUE_CREATED", items);
    expect(r.skipped).toBe(2);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("messages primary residents only, but everyone when none is primary", async () => {
    findPayments.mockResolvedValue([
      payment([resident(user({ id: "u1", email: "p@x.com" }), true), resident(user({ id: "u2", email: "o@x.com" }), false)]),
    ] as never);
    await notifyPayments("DUE_CREATED", items);
    expect(vi.mocked(sendEmail).mock.calls.map((c) => c[0].to)).toEqual(["p@x.com"]);

    vi.clearAllMocks();
    findPayments.mockResolvedValue([
      payment([resident(user({ id: "u1", email: "a@x.com" }), false), resident(user({ id: "u2", email: "b@x.com" }), false)]),
    ] as never);
    await notifyPayments("DUE_CREATED", items);
    expect(vi.mocked(sendEmail).mock.calls.map((c) => c[0].to).sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("does not resend something already sent (unique dedupe key)", async () => {
    findPayments.mockResolvedValue([payment([resident(user())])] as never);
    log.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    log.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await notifyPayments("DUE_CREATED", items);
    expect(r).toEqual({ sent: 0, failed: 0, skipped: 2 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("retries a failed send only after the cool-down", async () => {
    findPayments.mockResolvedValue([payment([resident(user({ phoneVerifiedAt: null }))])] as never);
    log.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    log.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await notifyPayments("DUE_CREATED", items);
    expect(r.sent).toBe(1);
    expect(log.updateMany.mock.calls[0][0]!.where).toMatchObject({ status: "FAILED", updatedAt: { lt: expect.any(Date) } });
  });

  it("records failures and keeps going", async () => {
    findPayments.mockResolvedValue([payment([resident(user())])] as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "boom" });
    const r = await notifyPayments("DUE_REMINDER", items);
    expect(r).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(log.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "FAILED", error: "boom" } }));
  });

  it("uses distinct dedupe keys per kind, user, channel and suffix", async () => {
    findPayments.mockResolvedValue([payment([resident(user())])] as never);
    await notifyPayments("PAYMENT_RECEIPT", items);
    const keys = log.create.mock.calls.map((c) => (c[0].data as { dedupeKey: string }).dedupeKey);
    expect(keys).toEqual(["rcpt:p1:u1:EMAIL:x", "rcpt:p1:u1:SMS:x"]);
  });

  it("sends the receipt template for PAYMENT_RECEIPT", async () => {
    findPayments.mockResolvedValue([payment([resident(user())], { paidAt: new Date("2026-10-05"), utrNumber: "UTR9" })] as never);
    await notifyPayments("PAYMENT_RECEIPT", items);
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({ template: "receipt" }));
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toMatch(/Payment received/);
  });

  it("does nothing for an empty list", async () => {
    expect(await notifyPayments("DUE_CREATED", [])).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(findPayments).not.toHaveBeenCalled();
  });
});
