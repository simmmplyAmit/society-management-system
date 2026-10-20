import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  $queryRaw: vi.fn(),
  creditEntry: { aggregate: vi.fn(), create: vi.fn() },
  maintenancePayment: { findMany: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    creditEntry: { aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { depositAndApply, applyCreditFor, applyCreditForSociety, getCreditBalance, hasCreditAllocations } from "@/lib/ledger";

const due = (id: string, amount: number, amountPaid = 0, month = 1, year = 2026) => ({ id, amount, amountPaid, month, year });
let entryNo = 0;

// balance the next aggregate() calls will report: [before deposit/apply, after]
function balances(...sums: number[]) {
  for (const s of sums) tx.creditEntry.aggregate.mockResolvedValueOnce({ _sum: { amount: s } });
}

beforeEach(() => {
  vi.clearAllMocks();
  entryNo = 0;
  tx.creditEntry.create.mockImplementation(async () => ({ id: `e${++entryNo}` }));
});

describe("depositAndApply", () => {
  it("locks the user, records the deposit, and pays the oldest dues first", async () => {
    balances(3000, 0); // after deposit inside apply, then final
    tx.maintenancePayment.findMany.mockResolvedValue([due("p1", 2500, 0, 1), due("p2", 2500, 0, 2)]);
    const r = await depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 3000, reference: "UTR1" });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.creditEntry.create.mock.calls[0][0].data).toMatchObject({ type: "DEPOSIT", amount: 3000, userId: "u1", reference: "UTR1" });
    expect(r.applied).toEqual([
      expect.objectContaining({ paymentId: "p1", amount: 2500, fullyPaid: true }),
      expect.objectContaining({ paymentId: "p2", amount: 500, fullyPaid: false }),
    ]);
    // first due fully paid, second partly
    expect(tx.maintenancePayment.update.mock.calls[0][0]).toMatchObject({
      where: { id: "p1" }, data: { amountPaid: 2500, status: "PAID", utrNumber: "UTR1" },
    });
    expect(tx.maintenancePayment.update.mock.calls[1][0].data).toEqual({ amountPaid: 500 });
    expect(tx.creditEntry.create.mock.calls[1][0].data).toMatchObject({ type: "APPLIED", amount: -2500, paymentId: "p1" });
    expect(tx.creditEntry.create.mock.calls[2][0].data).toMatchObject({ type: "APPLIED", amount: -500, paymentId: "p2" });
  });

  it("settles the dues the member chose before older ones", async () => {
    balances(2500, 0);
    tx.maintenancePayment.findMany.mockResolvedValue([due("old", 2500, 0, 1), due("chosen", 2500, 0, 5)]);
    const r = await depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 2500, priorityIds: ["chosen"] });
    expect(r.applied.map((a) => a.paymentId)).toEqual(["chosen"]);
  });

  it("auto-spends only on flats the member owns (or that have no owner), plus dues they chose", async () => {
    balances(100, 0);
    tx.maintenancePayment.findMany.mockResolvedValue([]);
    await depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 100, priorityIds: ["mine"] });
    expect(tx.maintenancePayment.findMany.mock.calls[0][0].where).toEqual({
      societyId: "s1",
      status: { in: ["PENDING", "OVERDUE"] },
      AND: [
        { OR: [{ claimId: null }, { id: { in: ["mine"] } }] },
        {
          OR: [
            { flat: { residents: { some: { userId: "u1", type: "OWNER" } } } },
            { flat: { AND: [{ residents: { some: { userId: "u1" } } }, { residents: { none: { type: "OWNER" } } }] } },
            { id: { in: ["mine"] } },
          ],
        },
      ],
    });
  });

  it("keeps the leftover as credit when it exceeds every due", async () => {
    balances(5000, 4000);
    tx.maintenancePayment.findMany.mockResolvedValue([due("p1", 1000)]);
    const r = await depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 5000 });
    expect(r.applied).toHaveLength(1);
    expect(r.balance).toBe(4000);
  });

  it("continues a part-paid due from where it left off, without float drift", async () => {
    balances(0.1 * 3 * 100, 0); // 30 paise-ish values
    tx.maintenancePayment.findMany.mockResolvedValue([due("p1", 10.3, 10.1)]);
    const r = await depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 0.3 });
    expect(r.applied[0]).toMatchObject({ amount: 0.2, fullyPaid: true });
    expect(tx.maintenancePayment.update.mock.calls[0][0].data).toMatchObject({ amountPaid: 10.3, status: "PAID" });
  });

  it("runs the caller's hook inside the same transaction, after the deposit entry", async () => {
    balances(100, 0);
    tx.maintenancePayment.findMany.mockResolvedValue([]);
    const order: string[] = [];
    tx.creditEntry.create.mockImplementation(async () => { order.push("deposit"); return { id: "e1" }; });
    await depositAndApply({
      societyId: "s1", userId: "u1", actorId: "t1", amount: 100,
      inTx: async (t) => { expect(t).toBe(tx); order.push("hook"); },
    });
    expect(order).toEqual(["deposit", "hook"]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-positive deposit before touching the database", async () => {
    await expect(depositAndApply({ societyId: "s1", userId: "u1", actorId: "t1", amount: 0 })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("applyCreditFor", () => {
  it("does nothing without credit", async () => {
    balances(0);
    expect(await applyCreditFor("s1", "u1")).toEqual([]);
    expect(tx.maintenancePayment.findMany).not.toHaveBeenCalled();
  });

  it("pays new dues from existing credit with no actor (automatic)", async () => {
    balances(1000);
    tx.maintenancePayment.findMany.mockResolvedValue([due("p1", 800)]);
    const r = await applyCreditFor("s1", "u1");
    expect(r[0]).toMatchObject({ paymentId: "p1", fullyPaid: true });
    expect(tx.maintenancePayment.update.mock.calls[0][0].data).toMatchObject({ paidBy: null, status: "PAID" });
  });
});

describe("applyCreditForSociety", () => {
  it("only processes users whose balance is positive", async () => {
    vi.mocked(prisma.creditEntry.groupBy).mockResolvedValue([
      { userId: "u1", _sum: { amount: "500" } },
      { userId: "u2", _sum: { amount: "0" } },
      { userId: "u3", _sum: { amount: "-1" } },
    ] as never);
    balances(500);
    tx.maintenancePayment.findMany.mockResolvedValue([]);
    await applyCreditForSociety("s1");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.creditEntry.groupBy).mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });
});

describe("balance and allocations", () => {
  it("sums the ledger for one user in one society", async () => {
    vi.mocked(prisma.creditEntry.aggregate).mockResolvedValue({ _sum: { amount: "125.50" } } as never);
    expect(await getCreditBalance("s1", "u1")).toBe(125.5);
    expect(vi.mocked(prisma.creditEntry.aggregate).mock.calls[0][0]!.where).toEqual({ societyId: "s1", userId: "u1" });
  });

  it("detects credit-funded dues", async () => {
    vi.mocked(prisma.creditEntry.count).mockResolvedValue(1);
    expect(await hasCreditAllocations("s1", "p1")).toBe(true);
    expect(vi.mocked(prisma.creditEntry.count).mock.calls[0][0]!.where).toEqual({ societyId: "s1", paymentId: "p1", type: "APPLIED" });
  });
});
