import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flat: { findFirst: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn() },
    flatResident: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), count: vi.fn() },
    tenantRecord: { create: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "a1", role: "ADMIN", societyId: "s1" } }),
}));

import { assignResident, removeResident } from "@/actions/residents";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

describe("assignResident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.flat.findFirst).mockResolvedValue({ id: "f1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1" } as never);
  });

  it("rejects flats outside the society", async () => {
    vi.mocked(prisma.flat.findFirst).mockResolvedValue(null);
    const r = await assignResident(fd({ flatId: "f1", userId: "u1", type: "OWNER" }));
    expect(r.error).toMatch(/Flat not found/);
    expect(prisma.flatResident.create).not.toHaveBeenCalled();
  });

  it("rejects users outside the society", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const r = await assignResident(fd({ flatId: "f1", userId: "u1", type: "OWNER" }));
    expect(r.error).toMatch(/User not found/);
  });

  it("assigns an owner and marks the flat occupied without a tenant record", async () => {
    const r = await assignResident(fd({ flatId: "f1", userId: "u1", type: "OWNER" }));
    expect(r.success).toBe(true);
    expect(prisma.flat.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { isOccupied: true } });
    expect(prisma.tenantRecord.create).not.toHaveBeenCalled();
  });

  it("starts a tenant occupancy record for tenants", async () => {
    await assignResident(fd({ flatId: "f1", userId: "u1", type: "TENANT" }));
    expect(prisma.tenantRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ flatId: "f1", userId: "u1", startDate: expect.any(Date) }),
    });
  });

  it("reports duplicate assignments", async () => {
    vi.mocked(prisma.flatResident.create).mockRejectedValue(new Error("unique"));
    const r = await assignResident(fd({ flatId: "f1", userId: "u1", type: "OWNER" }));
    expect(r.error).toMatch(/already assigned/);
  });
});

describe("removeResident", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes the lookup to the society and errors when missing", async () => {
    vi.mocked(prisma.flatResident.findFirst).mockResolvedValue(null);
    const r = await removeResident("fr1");
    expect(prisma.flatResident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "fr1", flat: { societyId: "s1" } } })
    );
    expect(r.error).toMatch(/not found/i);
    expect(prisma.flatResident.delete).not.toHaveBeenCalled();
  });

  it("closes the open tenant record when a tenant is removed", async () => {
    vi.mocked(prisma.flatResident.findFirst).mockResolvedValue({ id: "fr1", flatId: "f1", userId: "u1", type: "TENANT" } as never);
    vi.mocked(prisma.flatResident.count).mockResolvedValue(1);
    await removeResident("fr1");
    expect(prisma.tenantRecord.updateMany).toHaveBeenCalledWith({
      where: { flatId: "f1", userId: "u1", endDate: null },
      data: { endDate: expect.any(Date) },
    });
    expect(prisma.flat.update).not.toHaveBeenCalled();
  });

  it("marks the flat vacant when the last resident leaves", async () => {
    vi.mocked(prisma.flatResident.findFirst).mockResolvedValue({ id: "fr1", flatId: "f1", userId: "u1", type: "OWNER" } as never);
    vi.mocked(prisma.flatResident.count).mockResolvedValue(0);
    await removeResident("fr1");
    expect(prisma.tenantRecord.updateMany).not.toHaveBeenCalled();
    expect(prisma.flat.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { isOccupied: false } });
  });
});
