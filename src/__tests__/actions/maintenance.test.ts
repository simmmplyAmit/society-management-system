import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flat: { findFirst: vi.fn(), findMany: vi.fn() },
    maintenanceCharge: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    maintenancePayment: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "a1", role: "ADMIN", societyId: "s1" } }),
}));
vi.mock("@/lib/queries/maintenance", () => ({ generateForMonth: vi.fn().mockResolvedValue({ created: 1, skipped: 0 }) }));

import { setMaintenanceCharge, markPaymentPaid, markPaymentPending, generateMonthlyPayments, generateDuesForRange } from "@/actions/maintenance";
import { generateForMonth } from "@/lib/queries/maintenance";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

describe("setMaintenanceCharge", () => {
  const base = { flatId: "f1", amount: "1000", startMonth: "4", startYear: "2026" };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.flat.findMany).mockResolvedValue([{ id: "f1", number: "101" }] as never);
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([]);
  });

  it("is ADMIN only", async () => {
    await setMaintenanceCharge(fd(base));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("rejects flats outside the society", async () => {
    vi.mocked(prisma.flat.findMany).mockResolvedValue([]);
    const r = await setMaintenanceCharge(fd(base));
    expect(r.error).toMatch(/Flat not found/);
    expect(prisma.maintenanceCharge.createMany).not.toHaveBeenCalled();
  });

  it("rejects an end date before the start date", async () => {
    const r = await setMaintenanceCharge(fd({ ...base, endMonth: "3", endYear: "2026" }));
    expect(r.error).toMatch(/End date/);
    expect(prisma.maintenanceCharge.createMany).not.toHaveBeenCalled();
  });

  it("rejects a charge overlapping an open-ended one", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([
      { startMonth: 1, startYear: 2026, endMonth: null, endYear: null, amount: 900 },
    ] as never);
    const r = await setMaintenanceCharge(fd(base));
    expect(r.error).toMatch(/Overlaps/);
    expect(prisma.maintenanceCharge.createMany).not.toHaveBeenCalled();
  });

  it("allows an adjacent, non-overlapping charge", async () => {
    vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([
      { startMonth: 1, startYear: 2026, endMonth: 3, endYear: 2026, amount: 900 },
    ] as never);
    const r = await setMaintenanceCharge(fd(base));
    expect(r.success).toBe(true);
    expect(prisma.maintenanceCharge.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ societyId: "s1", flatId: "f1", amount: 1000, endMonth: null, endYear: null })],
    });
  });

  describe("multiple flats", () => {
    const multi = (ids: string[], extra: Record<string, string> = {}) => {
      const d = fd({ amount: "1500", startMonth: "4", startYear: "2026", ...extra });
      ids.forEach((id) => d.append("flatId", id));
      return d;
    };
    const flats = [
      { id: "f1", number: "101" },
      { id: "f2", number: "102" },
      { id: "f3", number: "103" },
    ];

    it("sets the same charge on every selected flat in one go", async () => {
      vi.mocked(prisma.flat.findMany).mockResolvedValue(flats as never);
      const r = await setMaintenanceCharge(multi(["f1", "f2", "f3"]));
      expect(r).toMatchObject({ success: true, created: 3 });
      expect(prisma.flat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["f1", "f2", "f3"] }, societyId: "s1" } })
      );
      expect(prisma.maintenanceCharge.createMany).toHaveBeenCalledTimes(1);
      const { data } = vi.mocked(prisma.maintenanceCharge.createMany).mock.calls[0][0] as { data: { flatId: string; amount: number; societyId: string }[] };
      expect(data.map((d) => d.flatId)).toEqual(["f1", "f2", "f3"]);
      expect(data.every((d) => d.amount === 1500 && d.societyId === "s1")).toBe(true);
    });

    it("ignores duplicate flat ids", async () => {
      vi.mocked(prisma.flat.findMany).mockResolvedValue(flats.slice(0, 2) as never);
      const r = await setMaintenanceCharge(multi(["f1", "f2", "f1"]));
      expect(r).toMatchObject({ success: true, created: 2 });
    });

    it("rejects the whole batch if any flat is outside the society", async () => {
      vi.mocked(prisma.flat.findMany).mockResolvedValue(flats.slice(0, 2) as never);
      const r = await setMaintenanceCharge(multi(["f1", "f2", "other"]));
      expect(r.error).toMatch(/Flat not found/);
      expect(prisma.maintenanceCharge.createMany).not.toHaveBeenCalled();
    });

    it("rejects the whole batch if one flat overlaps, naming it", async () => {
      vi.mocked(prisma.flat.findMany).mockResolvedValue(flats as never);
      vi.mocked(prisma.maintenanceCharge.findMany).mockResolvedValue([
        { flatId: "f2", startMonth: 1, startYear: 2026, endMonth: null, endYear: null, amount: 900 },
      ] as never);
      const r = await setMaintenanceCharge(multi(["f1", "f2", "f3"]));
      expect(r.error).toMatch(/Overlaps.*flat 102/);
      expect(prisma.maintenanceCharge.createMany).not.toHaveBeenCalled();
    });

    it("requires at least one flat", async () => {
      const r = await setMaintenanceCharge(multi([]));
      expect(r.error).toMatch(/at least one flat/);
    });
  });
});

describe("markPaymentPaid / markPaymentPending", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only marks payments that belong to the caller's society", async () => {
    vi.mocked(prisma.maintenancePayment.findFirst).mockResolvedValue(null);
    const r = await markPaymentPaid(fd({ paymentId: "p1" }));
    expect(prisma.maintenancePayment.findFirst).toHaveBeenCalledWith({ where: { id: "p1", societyId: "s1" } });
    expect(r.error).toMatch(/not found/i);
    expect(prisma.maintenancePayment.update).not.toHaveBeenCalled();
  });

  it("records paidBy, UTR and status", async () => {
    vi.mocked(prisma.maintenancePayment.findFirst).mockResolvedValue({ id: "p1" } as never);
    await markPaymentPaid(fd({ paymentId: "p1", utrNumber: "UTR123" }));
    expect(prisma.maintenancePayment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ status: "PAID", paidBy: "a1", utrNumber: "UTR123" }),
    });
  });

  it("reverting to pending is society-scoped and clears payment fields", async () => {
    await markPaymentPending("p1");
    expect(prisma.maintenancePayment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", societyId: "s1" },
      data: { status: "PENDING", paidAt: null, paidBy: null, utrNumber: null },
    });
  });
});

describe("generate actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateMonthlyPayments is ADMIN/TREASURER and uses the session society", async () => {
    await generateMonthlyPayments(fd({ month: "10", year: "2026" }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(generateForMonth).toHaveBeenCalledWith("s1", 10, 2026);
  });

  it("generateDuesForRange generates every month in the range", async () => {
    const r = await generateDuesForRange(fd({ fromMonth: "11", fromYear: "2025", toMonth: "2", toYear: "2026" }));
    expect(r.success).toBe(true);
    expect(vi.mocked(generateForMonth).mock.calls.map((c) => [c[1], c[2]])).toEqual([[11, 2025], [12, 2025], [1, 2026], [2, 2026]]);
  });

  it("generateDuesForRange rejects a reversed range", async () => {
    const r = await generateDuesForRange(fd({ fromMonth: "5", fromYear: "2026", toMonth: "1", toYear: "2026" }));
    expect(r.error).toBeDefined();
    expect(generateForMonth).not.toHaveBeenCalled();
  });
});
