import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flatResident: { findMany: vi.fn() },
    maintenancePayment: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getMyFlats } from "@/lib/queries/flats";

const link = (flatId: string, number: string, wing: string, floor: number, type = "OWNER") => ({
  flatId, type, flat: { number, floor: { number: floor, wing: { name: wing } } },
});

beforeEach(() => vi.resetAllMocks());

describe("getMyFlats", () => {
  it("returns nothing, without a second query, for a user with no flats", async () => {
    vi.mocked(prisma.flatResident.findMany).mockResolvedValue([]);
    expect(await getMyFlats("s1", "u1")).toEqual([]);
    expect(prisma.maintenancePayment.groupBy).not.toHaveBeenCalled();
  });

  it("scopes by user and society and totals unpaid dues per flat", async () => {
    vi.mocked(prisma.flatResident.findMany).mockResolvedValue([
      link("f2", "B-202", "B", 2, "TENANT"),
      link("f1", "A-101", "A", 1),
    ] as never);
    vi.mocked(prisma.maintenancePayment.groupBy).mockResolvedValue([
      { flatId: "f1", _sum: { amount: "5500.50" }, _count: { _all: 2 } },
    ] as never);

    const flats = await getMyFlats("s1", "u1");

    expect(vi.mocked(prisma.flatResident.findMany).mock.calls[0][0]!.where).toEqual({ userId: "u1", flat: { societyId: "s1" } });
    expect(vi.mocked(prisma.maintenancePayment.groupBy).mock.calls[0][0]!.where).toEqual({
      societyId: "s1", flatId: { in: ["f2", "f1"] }, status: { in: ["PENDING", "OVERDUE"] },
    });
    expect(flats.map((f) => [f.number, f.unpaidTotal, f.unpaidCount, f.type])).toEqual([
      ["A-101", 5500.5, 2, "OWNER"],
      ["B-202", 0, 0, "TENANT"],
    ]);
  });

  it("orders flats naturally within a wing and floor", async () => {
    vi.mocked(prisma.flatResident.findMany).mockResolvedValue([
      link("f10", "A-10", "A", 1), link("f2", "A-2", "A", 1),
    ] as never);
    vi.mocked(prisma.maintenancePayment.groupBy).mockResolvedValue([] as never);
    expect((await getMyFlats("s1", "u1")).map((f) => f.number)).toEqual(["A-2", "A-10"]);
  });
});

describe("getMemberOptions", () => {
  it("groups a member's flats into one option and scopes by society", async () => {
    const { getMemberOptions } = await import("@/lib/queries/flats");
    vi.mocked(prisma.flatResident.findMany).mockResolvedValue([
      { user: { id: "u1", name: "Asha" }, flat: { number: "A-101" } },
      { user: { id: "u1", name: "Asha" }, flat: { number: "B-202" } },
      { user: { id: "u2", name: "Ravi" }, flat: { number: "A-102" } },
    ] as never);
    expect(await getMemberOptions("s1")).toEqual([
      { id: "u1", label: "Asha · A-101, B-202" },
      { id: "u2", label: "Ravi · A-102" },
    ]);
    expect(vi.mocked(prisma.flatResident.findMany).mock.calls[0][0]!.where).toEqual({
      flat: { societyId: "s1" }, user: { isActive: true },
    });
  });
});
