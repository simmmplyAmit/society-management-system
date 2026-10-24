import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  society: { update: vi.fn() },
  cashCollection: { create: vi.fn(), updateMany: vi.fn() },
  cashDeposit: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    user: { findFirst: vi.fn() },
    cashCollection: { findMany: vi.fn() },
    cashDeposit: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ledger", () => ({ depositAndApply: vi.fn() }));
vi.mock("@/lib/credit-service", () => ({ notifyApplied: vi.fn() }));

import { collectCash, depositCash, confirmCashDeposit } from "@/actions/cash";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";

const fd = (f: Record<string, string>, ids: string[] = []) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  ids.forEach((id) => d.append("collectionId", id));
  return d;
};
const treasurer = { user: { id: "t1", role: "TREASURER", societyId: "s1" } };
const admin = { user: { id: "a1", role: "ADMIN", societyId: "s1" } };
const today = new Date().toISOString().split("T")[0];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue(treasurer as never);
});

describe("collectCash", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1" } as never);
    tx.society.update.mockResolvedValue({ cashReceiptSeq: 42 });
    // run the in-transaction hook the way the ledger would
    vi.mocked(depositAndApply).mockImplementation(async (o) => {
      await o.inTx?.(tx as never);
      return { applied: [{ entryId: "e1", paymentId: "p1", amount: 500, fullyPaid: true }], balance: 250 };
    });
  });

  it("is ADMIN/TREASURER only and only accepts an active flat-linked member of the society", async () => {
    await collectCash(fd({ userId: "u1", amount: "750", receivedOn: today }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(vi.mocked(prisma.user.findFirst).mock.calls[0][0]!.where).toEqual({
      id: "u1", societyId: "s1", isActive: true, flatResidents: { some: {} },
    });
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect(await collectCash(fd({ userId: "outsider", amount: "5" }))).toMatchObject({ error: expect.stringMatching(/not found/) });
  });

  it("issues the next receipt number and records the collection in the same transaction as the credit", async () => {
    const r = await collectCash(fd({ userId: "u1", amount: "750", note: "At office", receivedOn: today }));
    expect(r).toMatchObject({ success: true, receiptNo: 42, applied: 1, balance: 250 });
    expect(depositAndApply).toHaveBeenCalledWith(expect.objectContaining({
      societyId: "s1", userId: "u1", actorId: "t1", amount: 750, note: "Cash received",
    }));
    expect(tx.society.update).toHaveBeenCalledWith({
      where: { id: "s1" }, data: { cashReceiptSeq: { increment: 1 } }, select: { cashReceiptSeq: true },
    });
    expect(tx.cashCollection.create.mock.calls[0][0].data).toMatchObject({
      societyId: "s1", receiptNo: 42, userId: "u1", collectedById: "t1", amount: 750, note: "At office",
    });
    expect(notifyApplied).toHaveBeenCalled();
  });

  it("rejects bad amounts and dates before touching anything", async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    const bad: Record<string, string>[] = [
      { userId: "u1", amount: "0" }, { userId: "u1", amount: "-4" }, { userId: "u1", amount: "99999999" },
      { userId: "", amount: "5" }, { userId: "u1", amount: "5", receivedOn: future }, { userId: "u1", amount: "5", receivedOn: "2020-01-01" },
    ];
    for (const f of bad) {
      expect(await collectCash(fd(f))).toMatchObject({ error: expect.any(String) });
    }
    expect(depositAndApply).not.toHaveBeenCalled();
  });

  it("reports a failure without leaving a half-recorded receipt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(depositAndApply).mockRejectedValue(new Error("db"));
    expect(await collectCash(fd({ userId: "u1", amount: "5" }))).toMatchObject({ error: expect.any(String) });
    expect(notifyApplied).not.toHaveBeenCalled();
  });
});

describe("depositCash", () => {
  const rows = (...a: [string, number | string, string?][]) =>
    a.map(([id, amount, receivedOn]) => ({ id, amount, receivedOn: new Date(receivedOn ?? Date.now() - 86400000) }));

  beforeEach(() => {
    vi.mocked(prisma.cashDeposit.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.cashCollection.findMany).mockResolvedValue(rows(["c1", 500], ["c2", "250.50"]) as never);
    tx.cashDeposit.create.mockResolvedValue({ id: "d1" });
    tx.cashCollection.updateMany.mockResolvedValue({ count: 2 });
  });

  it("is ADMIN/TREASURER only and only takes undeposited cash of the society", async () => {
    await depositCash(fd({ reference: "SLIP1234", depositedOn: today }, ["c1", "c2"]));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(vi.mocked(prisma.cashCollection.findMany).mock.calls[0][0]!.where).toEqual({
      id: { in: ["c1", "c2"] }, societyId: "s1", depositId: null,
    });
  });

  it("computes the deposit total from the receipts, not from the form", async () => {
    const r = await depositCash(fd({ reference: "SLIP1234", depositedOn: today, amount: "1" }, ["c1", "c2"]));
    expect(r).toEqual({ success: true, amount: 750.5, count: 2 });
    expect(tx.cashDeposit.create.mock.calls[0][0].data).toMatchObject({
      societyId: "s1", depositedById: "t1", amount: 750.5, reference: "SLIP1234",
    });
    expect(tx.cashCollection.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] }, societyId: "s1", depositId: null },
      data: { depositId: "d1" },
    });
  });

  it("rolls everything back if any receipt was banked in the meantime", async () => {
    tx.cashCollection.updateMany.mockResolvedValue({ count: 1 });
    expect(await depositCash(fd({ reference: "SLIP1234" }, ["c1", "c2"]))).toMatchObject({ error: expect.stringMatching(/already deposited/) });
  });

  it("refuses receipts that are not available (foreign, or already deposited)", async () => {
    vi.mocked(prisma.cashCollection.findMany).mockResolvedValue(rows(["c1", 500]) as never);
    expect(await depositCash(fd({ reference: "SLIP1234" }, ["c1", "foreign"]))).toMatchObject({ error: expect.stringMatching(/already deposited/) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("needs a reference, a selection, a sane date and an unused reference", async () => {
    expect(await depositCash(fd({ reference: "12" }, ["c1"]))).toMatchObject({ error: expect.any(String) });
    expect(await depositCash(fd({ reference: "SLIP1234" }, []))).toMatchObject({ error: expect.stringMatching(/Select/) });
    const future = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    expect(await depositCash(fd({ reference: "SLIP1234", depositedOn: future }, ["c1"]))).toMatchObject({ error: expect.stringMatching(/future/) });
    vi.mocked(prisma.cashDeposit.findFirst).mockResolvedValue({ id: "old" } as never);
    expect(await depositCash(fd({ reference: "SLIP1234" }, ["c1"]))).toMatchObject({ error: expect.stringMatching(/already been used/) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("cannot be dated before the cash was received", async () => {
    vi.mocked(prisma.cashCollection.findMany).mockResolvedValue(rows(["c1", 500, new Date().toISOString()]) as never);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
    expect(await depositCash(fd({ reference: "SLIP1234", depositedOn: twoDaysAgo }, ["c1"]))).toMatchObject({ error: expect.stringMatching(/before the cash/) });
  });

  it("lets the admin bank cash that the treasurer collected", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin as never);
    expect(await depositCash(fd({ reference: "SLIP1234" }, ["c1", "c2"]))).toMatchObject({ success: true });
    expect(tx.cashDeposit.create.mock.calls[0][0].data).toMatchObject({ depositedById: "a1" });
  });
});

describe("confirmCashDeposit", () => {
  it("needs a different person from the depositor, scoped to the society", async () => {
    vi.mocked(prisma.cashDeposit.findFirst).mockResolvedValue({ id: "d1", depositedById: "t1" } as never);
    expect(await confirmCashDeposit("d1")).toMatchObject({ error: expect.stringMatching(/Someone else/) });
    expect(vi.mocked(prisma.cashDeposit.findFirst).mock.calls[0][0]!.where).toEqual({ id: "d1", societyId: "s1", confirmedAt: null });
    expect(prisma.cashDeposit.updateMany).not.toHaveBeenCalled();
  });

  it("confirms once for another admin/treasurer", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin as never);
    vi.mocked(prisma.cashDeposit.findFirst).mockResolvedValue({ id: "d1", depositedById: "t1" } as never);
    vi.mocked(prisma.cashDeposit.updateMany).mockResolvedValue({ count: 1 } as never);
    expect(await confirmCashDeposit("d1")).toEqual({ success: true });
    expect(vi.mocked(prisma.cashDeposit.updateMany).mock.calls[0][0]).toEqual({
      where: { id: "d1", societyId: "s1", confirmedAt: null }, data: { confirmedById: "a1", confirmedAt: expect.any(Date) },
    });
    vi.mocked(prisma.cashDeposit.updateMany).mockResolvedValue({ count: 0 } as never);
    expect(await confirmCashDeposit("d1")).toMatchObject({ error: expect.any(String) });
  });

  it("reports an unknown or already confirmed deposit", async () => {
    vi.mocked(prisma.cashDeposit.findFirst).mockResolvedValue(null);
    expect(await confirmCashDeposit("nope")).toMatchObject({ error: expect.any(String) });
  });
});
