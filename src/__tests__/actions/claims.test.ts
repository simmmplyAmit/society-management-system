import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentClaim: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    maintenancePayment: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    creditEntry: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ledger", () => ({ depositAndApply: vi.fn() }));
vi.mock("@/lib/credit-service", () => ({ notifyApplied: vi.fn() }));

import { submitPaymentClaim, approveClaim, rejectClaim } from "@/actions/claims";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";

const claim = vi.mocked(prisma.paymentClaim);
const pay = vi.mocked(prisma.maintenancePayment);
const credit = vi.mocked(prisma.creditEntry);

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
  claim.count.mockResolvedValue(0);
  claim.findFirst.mockResolvedValue(null);
  pay.findFirst.mockResolvedValue(null);
  credit.findFirst.mockResolvedValue(null);
  pay.findMany.mockResolvedValue([
    { id: "p1", amount: 2500, amountPaid: 0 },
    { id: "p2", amount: "3000.50", amountPaid: "500" },
  ] as never);
  claim.create.mockResolvedValue({ id: "c1" } as never);
  pay.updateMany.mockResolvedValue({ count: 2 } as never);
});

describe("submitPaymentClaim", () => {
  it("is open to every society role, but only for flats the user is linked to", async () => {
    await submitPaymentClaim(fd(valid, ["p1", "p2"]));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
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

  it("records the amount the resident says they paid (any amount) and attaches the dues", async () => {
    const r = await submitPaymentClaim(fd({ ...valid, amount: "1200.50" }, ["p1", "p2"]));
    expect(r).toEqual({ success: true, claimId: "c1" });
    expect(claim.create.mock.calls[0][0].data).toMatchObject({
      societyId: "s1", userId: "u1", utrNumber: "412345678901", amount: 1200.5,
    });
    expect(pay.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, societyId: "s1", claimId: null, status: { in: ["PENDING", "OVERDUE"] } },
      data: { claimId: "c1" },
    });
  });

  it("defaults the amount to the selected dues' remaining balance", async () => {
    await submitPaymentClaim(fd(valid, ["p1", "p2"]));
    expect(claim.create.mock.calls[0][0].data).toMatchObject({ amount: 5000.5 }); // 2500 + (3000.50 - 500)
  });

  it("rejects zero, negative and absurd amounts", async () => {
    for (const amount of ["0", "-5", "99999999"]) {
      expect(await submitPaymentClaim(fd({ ...valid, amount }, ["p1"]))).toMatchObject({ error: expect.any(String) });
    }
    expect(claim.create).not.toHaveBeenCalled();
  });

  it("normalizes the UTR and rejects a malformed one", async () => {
    await submitPaymentClaim(fd({ ...valid, utrNumber: "ab12 3456 7890" }, ["p1", "p2"]));
    expect(claim.create.mock.calls[0][0].data).toMatchObject({ utrNumber: "AB1234567890" });

    vi.clearAllMocks();
    expect(await submitPaymentClaim(fd({ ...valid, utrNumber: "123" }, ["p1"]))).toMatchObject({ error: expect.stringMatching(/UTR/) });
    expect(claim.create).not.toHaveBeenCalled();
  });

  it("rejects a reference that was already used by a report, payment or deposit", async () => {
    claim.findFirst.mockResolvedValue({ id: "other" } as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "p2"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });

    claim.findFirst.mockResolvedValue(null);
    pay.findFirst.mockResolvedValue({ id: "paid" } as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "p2"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });

    pay.findFirst.mockResolvedValue(null);
    credit.findFirst.mockResolvedValue({ id: "d1" } as never);
    expect(await submitPaymentClaim(fd(valid, ["p1", "p2"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });
    expect(claim.create).not.toHaveBeenCalled();
  });

  it("refuses dues the resident doesn't own or that are already claimed", async () => {
    pay.findMany.mockResolvedValue([{ id: "p1", amount: 100, amountPaid: 0 }] as never);
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
  const paidOn = new Date("2026-10-05");
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue(manager as never);
    claim.findFirst.mockResolvedValue({ id: "c1", userId: "u1", utrNumber: "UTR123456789", paidOn, amount: 5000 } as never);
    claim.updateMany.mockResolvedValue({ count: 1 } as never);
    pay.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }] as never);
    vi.mocked(depositAndApply).mockResolvedValue({
      applied: [
        { entryId: "e1", paymentId: "p1", amount: 2500, fullyPaid: true },
        { entryId: "e2", paymentId: "p2", amount: 1000, fullyPaid: false },
      ],
      balance: 0,
    });
  });

  it("is ADMIN/TREASURER only and looks up the report inside the society", async () => {
    await approveClaim("c1");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(claim.findFirst.mock.calls[0][0]!.where).toEqual({ id: "c1", societyId: "s1", status: "SUBMITTED" });
  });

  it("credits the reported amount to the resident and applies it, chosen dues first", async () => {
    const r = await approveClaim("c1");
    expect(r).toEqual({ success: true, applied: 2, paidInFull: 1, balance: 0 });
    expect(depositAndApply).toHaveBeenCalledWith(expect.objectContaining({
      societyId: "s1", userId: "u1", actorId: "t1", amount: 5000,
      claimId: "c1", reference: "UTR123456789", paidOn, priorityIds: ["p1", "p2"],
    }));
    expect(notifyApplied).toHaveBeenCalledWith("s1", expect.arrayContaining([expect.objectContaining({ paymentId: "p1" })]));
  });

  it("lets the treasurer correct the amount actually received and notes the difference", async () => {
    await approveClaim("c1", 4000);
    expect(depositAndApply).toHaveBeenCalledWith(expect.objectContaining({ amount: 4000 }));
    expect(claim.updateMany.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", reviewNote: "Received 4000 (reported 5000)" });
  });

  it("frees the report's dues once credited so they can be reported again if still unpaid", async () => {
    await approveClaim("c1");
    expect(pay.updateMany).toHaveBeenCalledWith({ where: { claimId: "c1", societyId: "s1" }, data: { claimId: null } });
  });

  it("does nothing when the report was already reviewed (including a concurrent approval)", async () => {
    claim.findFirst.mockResolvedValue(null);
    expect(await approveClaim("c1")).toMatchObject({ error: expect.any(String) });
    claim.findFirst.mockResolvedValue({ id: "c1", userId: "u1", utrNumber: "X", paidOn, amount: 100 } as never);
    claim.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await approveClaim("c1")).toMatchObject({ error: expect.any(String) });
    expect(depositAndApply).not.toHaveBeenCalled();
  });

  it("puts the report back for another try when recording the credit fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(depositAndApply).mockRejectedValue(new Error("db down"));
    expect(await approveClaim("c1")).toMatchObject({ error: expect.any(String) });
    expect(claim.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1", societyId: "s1", status: "APPROVED" },
      data: expect.objectContaining({ status: "SUBMITTED", reviewedById: null }),
    });
  });

  it("rejects an invalid received amount", async () => {
    expect(await approveClaim("c1", -1)).toMatchObject({ error: expect.any(String) });
    expect(claim.findFirst).not.toHaveBeenCalled();
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
