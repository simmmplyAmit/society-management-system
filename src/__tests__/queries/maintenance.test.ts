import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    society: { findMany: vi.fn() },
    maintenanceCharge: { findMany: vi.fn() },
    maintenancePayment: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    flatResident: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  generateForMonth, generateAllSocietiesCurrentMonth, markOverduePayments, getResidentPayments,
} from "@/lib/queries/maintenance";

const charge = (over: Record<string, unknown> = {}) => ({
  id: "c1", flatId: "f1", amount: 1000, startMonth: 1, startYear: 2026, endMonth: null, endYear: null, ...over,
});

describe("generateForMonth", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a PENDING payment for each active charge", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([charge()] as never);
    vi.mocked(prisma.maintenancePayment.findUnique).mockResolvedValue(null);
    const r = await generateForMonth("s1", 10, 2026);
    expect(r).toEqual({ created: 1, skipped: 0 });
    expect(prisma.maintenancePayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", flatId: "f1", chargeId: "c1", month: 10, year: 2026, status: "PENDING" }),
    });
  });

  it("skips months that already have a payment (idempotent)", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([charge()] as never);
    vi.mocked(prisma.maintenancePayment.findUnique).mockResolvedValue({ id: "p1" } as never);
    const r = await generateForMonth("s1", 10, 2026);
    expect(r).toEqual({ created: 0, skipped: 1 });
    expect(prisma.maintenancePayment.create).not.toHaveBeenCalled();
  });

  it("ignores charges that start later in the same year", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([charge({ startMonth: 11, startYear: 2026 })] as never);
    const r = await generateForMonth("s1", 10, 2026);
    expect(r).toEqual({ created: 0, skipped: 0 });
  });

  it("scopes the charge query to the society and optional flat", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([]);
    await generateForMonth("s1", 10, 2026, "f9");
    expect(prisma.maintenanceCharge.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ societyId: "s1", flatId: "f9" }),
    });
  });
});

describe("markOverduePayments", () => {
  beforeEach(() => vi.resetAllMocks());

  it("flips earlier-month PENDING payments of active societies to OVERDUE", async () => {
    vi.mocked(prisma.maintenancePayment.updateMany).mockResolvedValue({ count: 4 });
    const count = await markOverduePayments(new Date(2026, 9, 1));
    expect(count).toBe(4);
    expect(prisma.maintenancePayment.updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        society: { isActive: true },
        OR: [{ year: { lt: 2026 } }, { year: 2026, month: { lt: 10 } }],
      },
      data: { status: "OVERDUE" },
    });
  });
});

describe("generateAllSocietiesCurrentMonth", () => {
  beforeEach(() => vi.resetAllMocks());

  it("generates previous + current month per society, then marks overdue", async () => {
    vi.mocked(prisma.society.findMany).mockResolvedValue([{ id: "s1", name: "Sunrise" }] as never);
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([charge()] as never);
    vi.mocked(prisma.maintenancePayment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.maintenancePayment.updateMany).mockResolvedValue({ count: 2 });

    const r = await generateAllSocietiesCurrentMonth(new Date(2026, 0, 1)); // 1 Jan 2026
    expect(r.month).toBe(1);
    expect(r.year).toBe(2026);
    expect(r.overdueMarked).toBe(2);
    expect(r.results).toEqual([{ society: "Sunrise", created: 2, skipped: 0 }]);
    const months = vi.mocked(prisma.maintenancePayment.create).mock.calls.map((c) => [c[0].data.month, c[0].data.year]);
    expect(months).toEqual([[12, 2025], [1, 2026]]);
  });
});

describe("getResidentPayments", () => {
  beforeEach(() => vi.resetAllMocks());

  it("only returns payments for flats the user lives in, within the society", async () => {
    vi.mocked(prisma.flatResident.findMany).mockResolvedValue([{ flatId: "f1" }, { flatId: "f2" }] as never);
    vi.mocked(prisma.maintenancePayment.findMany).mockResolvedValue([]);
    await getResidentPayments("s1", "u1");
    expect(prisma.flatResident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", flat: { societyId: "s1" } } })
    );
    expect(prisma.maintenancePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { flatId: { in: ["f1", "f2"] } } })
    );
  });
});
