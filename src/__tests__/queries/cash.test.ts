import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { cashCollection: { findMany: vi.fn() }, cashDeposit: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getCashState } from "@/lib/queries/cash";

const c = (id: string, amount: number, collector: string, receivedOn: string) => ({
  id, amount, receivedOn: new Date(receivedOn), payer: { name: "P" }, collectedBy: { id: collector, name: collector.toUpperCase() },
});

beforeEach(() => vi.resetAllMocks());

describe("getCashState", () => {
  it("scopes to the society and groups cash in hand by who holds it", async () => {
    vi.mocked(prisma.cashCollection.findMany).mockResolvedValue([
      c("1", 500, "t1", "2026-10-10"), c("2", "250.25" as never, "t1", "2026-10-05"), c("3", 1000, "a1", "2026-10-12"),
    ] as never);
    vi.mocked(prisma.cashDeposit.findMany).mockResolvedValue([]);
    const s = await getCashState("s1");

    expect(vi.mocked(prisma.cashCollection.findMany).mock.calls[0][0]!.where).toEqual({ societyId: "s1", depositId: null });
    expect(vi.mocked(prisma.cashDeposit.findMany).mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
    expect(s.total).toBe(1750.25);
    expect(s.holders.map((h) => [h.id, h.total, h.count])).toEqual([["a1", 1000, 1], ["t1", 750.25, 2]]);
    expect(s.holders.find((h) => h.id === "t1")!.oldest).toEqual(new Date("2026-10-05"));
  });

  it("is empty when everything has been deposited", async () => {
    vi.mocked(prisma.cashCollection.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cashDeposit.findMany).mockResolvedValue([]);
    expect(await getCashState("s1")).toMatchObject({ total: 0, holders: [], inHand: [] });
  });
});
