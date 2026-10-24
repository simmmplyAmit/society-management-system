import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    specialCharge: { findMany: vi.fn() },
    flat: { findMany: vi.fn() },
    maintenancePayment: { createMany: vi.fn(), groupBy: vi.fn() },
    society: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { generateSpecialChargeDues, generateAllSpecialCharges, getSpecialCharges } from "@/lib/queries/special-charges";

const charge = (over: Record<string, unknown> = {}) => ({
  id: "c1", name: "Sinking fund", basis: "FIXED", rate: 500, schedule: "ONE_TIME", frequency: null,
  startMonth: 10, startYear: 2026, endMonth: null, endYear: null,
  configurations: [], minArea: null, maxArea: null, isActive: true, ...over,
});
const flat = (id: string, configuration: string | null, areaSqFt: number | null) => ({ id, configuration, areaSqFt });
const now = new Date(2026, 9, 20); // 20 Oct 2026

const find = vi.mocked(prisma.specialCharge.findMany);
const create = vi.mocked(prisma.maintenancePayment.createMany);

beforeEach(() => {
  vi.resetAllMocks();
  create.mockImplementation((async (a: { data: unknown[] }) => ({ count: a.data.length })) as never);
});

describe("generateSpecialChargeDues", () => {
  it("scopes to the society and its active charges", async () => {
    find.mockResolvedValue([]);
    await generateSpecialChargeDues("s1", { chargeId: "c1", now });
    expect(find.mock.calls[0][0]!.where).toEqual({ societyId: "s1", isActive: true, id: "c1" });
    expect(create).not.toHaveBeenCalled();
  });

  it("bills every matching flat once for a one-time charge, labelled and keyed by the charge", async () => {
    find.mockResolvedValue([charge()] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", "2BHK", 900), flat("f2", "1BHK", 600)] as never);
    const r = await generateSpecialChargeDues("s1", { now });
    expect(r).toEqual({ created: 2, missingArea: 0 });
    expect(create).toHaveBeenCalledWith({
      data: [
        { societyId: "s1", flatId: "f1", month: 10, year: 2026, amount: 500, status: "PENDING", chargeKey: "c1", label: "Sinking fund", specialChargeId: "c1" },
        { societyId: "s1", flatId: "f2", month: 10, year: 2026, amount: 500, status: "PENDING", chargeKey: "c1", label: "Sinking fund", specialChargeId: "c1" },
      ],
      skipDuplicates: true,
    });
    expect(vi.mocked(prisma.flat.findMany).mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });

  it("targets by configuration and area, and prices per sq ft", async () => {
    find.mockResolvedValue([charge({ basis: "PER_SQFT", rate: 2, configurations: ["2BHK"], minArea: 800 })] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([
      flat("f1", "2 bhk", 900), flat("f2", "2BHK", 700), flat("f3", "1BHK", 900), flat("f4", "2BHK", null),
    ] as never);
    const r = await generateSpecialChargeDues("s1", { now });
    expect(r.created).toBe(1);
    expect(create.mock.calls[0][0]!.data).toEqual([expect.objectContaining({ flatId: "f1", amount: 1800 })]);
  });

  it("skips and reports flats that can't be billed per sq ft", async () => {
    find.mockResolvedValue([charge({ basis: "PER_SQFT", rate: 2 })] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", "2BHK", 900), flat("f2", "2BHK", null)] as never);
    expect(await generateSpecialChargeDues("s1", { now })).toEqual({ created: 1, missingArea: 1 });
  });

  it("raises dues only for billing months that have arrived", async () => {
    find.mockResolvedValue([charge({ startMonth: 11 })] as never); // November: not yet
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", null, null)] as never);
    expect(await generateSpecialChargeDues("s1", { now })).toEqual({ created: 0, missingArea: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it("bills each period of a recurring charge, and rerunning only counts what was new", async () => {
    find.mockResolvedValue([charge({
      schedule: "RECURRING", frequency: "MONTHLY", startMonth: 8, startYear: 2026, endMonth: 12, endYear: 2026,
    })] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", null, null)] as never);
    await generateSpecialChargeDues("s1", { now });
    expect((create.mock.calls[0][0]!.data as { month: number }[]).map((d) => d.month)).toEqual([8, 9, 10]);

    create.mockResolvedValue({ count: 0 } as never); // all already exist
    expect((await generateSpecialChargeDues("s1", { now })).created).toBe(0);
  });

  it("always asks the database to skip duplicates so reruns are safe", async () => {
    find.mockResolvedValue([charge()] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", null, null)] as never);
    await generateSpecialChargeDues("s1", { now });
    expect(create.mock.calls[0][0]!.skipDuplicates).toBe(true);
  });

  it("writes large runs in chunks", async () => {
    find.mockResolvedValue([charge()] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue(Array.from({ length: 1200 }, (_, i) => flat(`f${i}`, null, null)) as never);
    const r = await generateSpecialChargeDues("s1", { now });
    expect(r.created).toBe(1200);
    expect(create).toHaveBeenCalledTimes(3);
  });
});

describe("generateAllSpecialCharges", () => {
  it("runs every active society and totals the result", async () => {
    vi.mocked(prisma.society.findMany).mockResolvedValue([{ id: "s1" }, { id: "s2" }] as never);
    find.mockResolvedValue([charge()] as never);
    vi.mocked(prisma.flat.findMany).mockResolvedValue([flat("f1", null, null)] as never);
    expect(await generateAllSpecialCharges(now)).toEqual({ created: 2, missingArea: 0 });
    expect(vi.mocked(prisma.society.findMany).mock.calls[0][0]!.where).toEqual({ isActive: true });
  });
});

describe("getSpecialCharges", () => {
  it("adds what has been billed to each charge", async () => {
    find.mockResolvedValue([charge(), charge({ id: "c2" })] as never);
    vi.mocked(prisma.maintenancePayment.groupBy).mockResolvedValue([
      { specialChargeId: "c1", _sum: { amount: "1500.50" }, _count: { _all: 3 } },
    ] as never);
    const out = await getSpecialCharges("s1");
    expect(out.map((c) => [c.id, c.billedCount, c.billedTotal])).toEqual([["c1", 3, 1500.5], ["c2", 0, 0]]);
    expect(find.mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });
});
