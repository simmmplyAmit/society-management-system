import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentClaim: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    maintenancePayment: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/notify/dispatch", () => ({ notifyPayments: vi.fn().mockResolvedValue({ sent: 1, failed: 0, skipped: 0 }) }));

import { submitPaymentClaim, approveClaim, rejectClaim } from "@/actions/claims";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyPayments } from "@/lib/notify/dispatch";

const claim = vi.mocked(prisma.paymentClaim);
const pay = vi.mocked(prisma.maintenancePayment);

const fd = (f: Record<string, string>, ids: string[] = []) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  ids.forEach((id) => d.append("paymentId", id));
  return d;
};

const resident = { user: { id: "u1", role: "OWNER", societyId: "s1" } };
const manager = { user: { id: "t1", role: "TREASURER", societyId: "s1" } };
const today = new Date().toISOString().split("T")[0];
const valid = { utrNumber: "412345678901", paidOn: today };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue(resident as never);
  vi.mocked(notifyPayments).mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
  claim.count.mockResolvedValue(0);
  claim.findFirst.mockResolvedValue(null);
  pay.findFirst.mockResolvedValue(null);
  pay.findMany.mockResolvedValue([{ id: "p1", amount: 2500 }, { id: "p2", amount: "3000.50" }] as never);
  claim.create.mockResolvedValue({ id: "c1" } as never);
  pay.updateMany.mockResolvedValue({ count: 2 } as never);
});

describe("submitPaymentClaim", () => {
  it("is limited to residents", async () => {
    await submitPaymentClaim(fd(valid, ["p1", "p2"]));
    expect(requireRole).toHaveBeenCalledWith(["OWNER", "TENANT"]);
  });

  it("only accepts the resident's own unpaid, unclaimed dues in their society", async () => {
    await submitPaymentClaim(fd(valid, ["p1", "p2"]));
    expect(pay.findMany.mock.calls[0][0]!.where).toEqual({
      id: { in: ["p1", "p2"] },
      societyId: "s1",
      status: { in: ["PENDING", "OVERDUE"] },
      claimId: null,
      flat: { residents: { some: { userId: "u1" } } },
    });
  });

  it("computes the amount on the server and attaches the dues to the claim", async () => {
    const r = await submitPaymentClaim(fd({ ...valid, amount: "1" }, ["p1", "p2"]));
    expect(r).toEqual({ success: true });
    expect(claim.create.mock.calls[0][0].data).toMatchObject({
      societyId: "s1", userId: "u1", utrNumber: "412345678901", amount: 5500.5,
    });
    expect(pay.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, societyId: "s1", claimId: null, status: { in: ["PENDING", "OVERDUE"] } },
      data: { claimId: "c1" },
    });
  });

  it("normalizes the UTR and rejects a malformed one", async () => {
    await submitPaymentClaim(fd({ ...valid, utrNumber: "ab12 3456 7890" }, ["p1", "p2"]));
    expect(claim.create.mock.calls[0][0].data).toMatchObject({ utrNumber: "AB1234567890" });

    vi.clearAllMocks();
    expect(await submitPaymentClaim(fd({ ...valid, utrNumber: "123" }, ["p1"]))).toMatchObject({ error: expect.stringMatching(/UTR/) });
    expect(claim.create).not.toHaveBeenCalled();
  });

  it("rejects a reference that was already used", async () => {
    claim.findFirst.mockResolvedValue({ id: "other" } as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "p2"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });
    expect(claim.create).not.toHaveBeenCalled();

    claim.findFirst.mockResolvedValue(null);
    pay.findFirst.mockResolvedValue({ id: "paid" } as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "p2"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });
  });

  it("refuses dues the resident doesn't own or that are already claimed", async () => {
    pay.findMany.mockResolvedValue([{ id: "p1", amount: 100 }] as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "foreign"]))).toMatchObject({ error: expect.stringMatching(/no longer available/) });
    expect(claim.create).not.toHaveBeenCalled();
  });

  it("undoes the claim if another request grabbed a due first", async () => {
    pay.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    const r = await submitPaymentClaim(fd(valid, ["p1", "p2"]));
    expect(r).toMatchObject({ error: expect.stringMatching(/no longer available/) });
    expect(pay.updateMany).toHaveBeenLastCalledWith({ where: { claimId: "c1" }, data: { claimId: null } });
    expect(claim.deleteMany).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("validates selection size, dates and the open-report cap", async () => {
    expect(await submitPaymentClaim(fd(valid, []))).toMatchObject({ error: expect.any(String) });
    const future = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    expect(await submitPaymentClaim(fd({ ...valid, paidOn: future }, ["p1"]))).toMatchObject({ error: expect.stringMatching(/future/) });
    expect(await submitPaymentClaim(fd({ ...valid, paidOn: "2020-01-01" }, ["p1"]))).toMatchObject({ error: expect.stringMatching(/last 90 days/) });
    claim.count.mockResolvedValue(10);
    expect(await submitPaymentClaim(fd(valid, ["p1"]))).toMatchObject({ error: expect.stringMatching(/too many/) });
    expect(claim.create).not.toHaveBeenCalled();
  });
});

describe("approveClaim", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue(manager as never);
    claim.findFirst.mockResolvedValue({ id: "c1", utrNumber: "UTR123456789", paidOn: new Date("2026-10-05") } as never);
    claim.updateMany.mockResolvedValue({ count: 1 } as never);
    pay.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }] as never);
  });

  it("is limited to ADMIN and TREASURER and scoped to the society", async () => {
    await approveClaim("c1");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(claim.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", societyId: "s1", status: "SUBMITTED" } }));
  });

  it("marks the dues paid with the claim's UTR and date, then sends receipts", async () => {
    const r = await approveClaim("c1");
    expect(r).toEqual({ success: true, paid: 2 });
    expect(pay.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, societyId: "s1" },
      data: { status: "PAID", paidAt: new Date("2026-10-05"), paidBy: "t1", utrNumber: "UTR123456789" },
    });
    expect(notifyPayments).toHaveBeenCalledWith(
      "PAYMENT_RECEIPT",
      [
        { paymentId: "p1", keySuffix: String(new Date("2026-10-05").getTime()) },
        { paymentId: "p2", keySuffix: String(new Date("2026-10-05").getTime()) },
      ],
      "s1"
    );
  });

  it("does nothing when the report was already reviewed (including a concurrent approval)", async () => {
    claim.findFirst.mockResolvedValue(null);
    expect(await approveClaim("c1")).toMatchObject({ error: expect.any(String) });
    claim.findFirst.mockResolvedValue({ id: "c1", utrNumber: "X", paidOn: new Date() } as never);
    claim.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await approveClaim("c1")).toMatchObject({ error: expect.any(String) });
    expect(pay.updateMany).not.toHaveBeenCalled();
  });

  it("still approves when messaging fails", async () => {
    vi.mocked(notifyPayments).mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await approveClaim("c1")).toMatchObject({ success: true });
  });
});

describe("rejectClaim", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue(manager as never);
    claim.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("rejects with a reason and frees the dues, scoped to the society", async () => {
    const r = await rejectClaim(fd({ claimId: "c1", reason: "Not in statement" }));
    expect(r).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(claim.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", societyId: "s1", status: "SUBMITTED" },
      data: expect.objectContaining({ status: "REJECTED", reviewNote: "Not in statement", reviewedById: "t1" }),
    });
    expect(pay.updateMany).toHaveBeenCalledWith({ where: { claimId: "c1", societyId: "s1" }, data: { claimId: null } });
  });

  it("does not touch the dues when the report was already reviewed", async () => {
    claim.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await rejectClaim(fd({ claimId: "c1" }))).toMatchObject({ error: expect.any(String) });
    expect(pay.updateMany).not.toHaveBeenCalled();
  });
});
