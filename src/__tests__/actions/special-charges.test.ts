import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    specialCharge: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    flat: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "a1", role: "ADMIN", societyId: "s1" } }),
}));
vi.mock("@/lib/queries/special-charges", () => ({ generateSpecialChargeDues: vi.fn() }));
vi.mock("@/lib/notify/schedule", () => ({ sendNewDueNotices: vi.fn() }));
vi.mock("@/lib/credit-service", () => ({ applyCreditAndNotify: vi.fn() }));

import { createSpecialCharge, stopSpecialCharge, generateSpecialChargeNow, updateFlatDetails } from "@/actions/special-charges";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateSpecialChargeDues } from "@/lib/queries/special-charges";
import { sendNewDueNotices } from "@/lib/notify/schedule";
import { applyCreditAndNotify } from "@/lib/credit-service";

const fd = (f: Record<string, string>, configs: string[] = []) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  configs.forEach((c) => d.append("configuration", c));
  return d;
};
const oneTime = { name: "Sinking fund", schedule: "ONE_TIME", startMonth: "10", startYear: "2026", basis: "FIXED", rate: "500" };
const recurring = { ...oneTime, schedule: "RECURRING", frequency: "QUARTERLY", endMonth: "9", endYear: "2027" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({ user: { id: "a1", role: "ADMIN", societyId: "s1" } } as never);
  vi.mocked(prisma.specialCharge.create).mockResolvedValue({ id: "c1" } as never);
  vi.mocked(generateSpecialChargeDues).mockResolvedValue({ created: 5, missingArea: 1 });
  vi.mocked(sendNewDueNotices).mockResolvedValue({ sent: 4, failed: 0, skipped: 0 });
});

describe("createSpecialCharge", () => {
  it("is ADMIN only and stores the charge in the session's society", async () => {
    await createSpecialCharge(fd(oneTime));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(vi.mocked(prisma.specialCharge.create).mock.calls[0][0].data).toMatchObject({
      societyId: "s1", name: "Sinking fund", basis: "FIXED", rate: 500, schedule: "ONE_TIME",
      frequency: null, startMonth: 10, startYear: 2026, endMonth: null, endYear: null, createdById: "a1",
    });
  });

  it("normalizes and de-duplicates the target configurations and area limits", async () => {
    await createSpecialCharge(fd({ ...oneTime, minArea: "800", maxArea: "" }, ["2 bhk", "2BHK", "3-bhk", ""]));
    expect(vi.mocked(prisma.specialCharge.create).mock.calls[0][0].data).toMatchObject({
      configurations: ["2BHK", "3BHK"], minArea: 800, maxArea: null,
    });
  });

  it("bills straight away, lets credit pay first, and notifies only when asked", async () => {
    const r = await createSpecialCharge(fd({ ...oneTime, notify: "on" }));
    expect(r).toMatchObject({ success: true, created: 5, missingArea: 1, notified: { sent: 4 } });
    expect(generateSpecialChargeDues).toHaveBeenCalledWith("s1", { chargeId: "c1" });
    expect(applyCreditAndNotify).toHaveBeenCalledWith("s1");
    expect(sendNewDueNotices).toHaveBeenCalledWith({ societyId: "s1" });

    vi.clearAllMocks();
    vi.mocked(prisma.specialCharge.create).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(generateSpecialChargeDues).mockResolvedValue({ created: 5, missingArea: 0 });
    await createSpecialCharge(fd(oneTime));
    expect(sendNewDueNotices).not.toHaveBeenCalled();
  });

  it("stores recurring schedules with frequency and end", async () => {
    await createSpecialCharge(fd(recurring));
    expect(vi.mocked(prisma.specialCharge.create).mock.calls[0][0].data).toMatchObject({
      schedule: "RECURRING", frequency: "QUARTERLY", endMonth: 9, endYear: 2027,
    });
  });

  it("validates the schedule, amount and area range", async () => {
    const bad: Record<string, string>[] = [
      { ...oneTime, name: "x" },
      { ...oneTime, rate: "0" },
      { ...oneTime, rate: "-5" },
      { ...oneTime, basis: "PER_ACRE" },
      { ...recurring, frequency: "" },
      { ...recurring, endMonth: "", endYear: "" },
      { ...recurring, endMonth: "1", endYear: "2026" }, // ends before it starts
      { ...oneTime, minArea: "900", maxArea: "800" },
      { ...oneTime, startMonth: "13" },
    ];
    for (const b of bad) expect(await createSpecialCharge(fd(b))).toMatchObject({ error: expect.any(String) });
    expect(prisma.specialCharge.create).not.toHaveBeenCalled();
  });

  it("refuses a schedule that would bill more than 60 times", async () => {
    const r = await createSpecialCharge(fd({ ...recurring, frequency: "MONTHLY", startYear: "2026", endYear: "2035" }));
    expect(r).toMatchObject({ error: expect.stringMatching(/60/) });
    expect(prisma.specialCharge.create).not.toHaveBeenCalled();
  });

  it("does not touch credit or messages when nothing was billed", async () => {
    vi.mocked(generateSpecialChargeDues).mockResolvedValue({ created: 0, missingArea: 3 });
    await createSpecialCharge(fd({ ...oneTime, notify: "on" }));
    expect(applyCreditAndNotify).not.toHaveBeenCalled();
    expect(sendNewDueNotices).not.toHaveBeenCalled();
  });
});

describe("stopSpecialCharge / generateSpecialChargeNow", () => {
  it("stops a charge only within the society and only while active", async () => {
    vi.mocked(prisma.specialCharge.updateMany).mockResolvedValue({ count: 1 } as never);
    expect(await stopSpecialCharge("c1")).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(vi.mocked(prisma.specialCharge.updateMany).mock.calls[0][0]).toEqual({
      where: { id: "c1", societyId: "s1", isActive: true }, data: { isActive: false },
    });
    vi.mocked(prisma.specialCharge.updateMany).mockResolvedValue({ count: 0 } as never);
    expect(await stopSpecialCharge("other")).toMatchObject({ error: expect.any(String) });
  });

  it("bills again for ADMIN/TREASURER, scoped to the society", async () => {
    vi.mocked(prisma.specialCharge.findFirst).mockResolvedValue({ id: "c1" } as never);
    expect(await generateSpecialChargeNow("c1")).toMatchObject({ success: true, created: 5 });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(vi.mocked(prisma.specialCharge.findFirst).mock.calls[0][0]!.where).toEqual({ id: "c1", societyId: "s1", isActive: true });

    vi.mocked(prisma.specialCharge.findFirst).mockResolvedValue(null);
    expect(await generateSpecialChargeNow("foreign")).toMatchObject({ error: expect.any(String) });
  });
});

describe("updateFlatDetails", () => {
  const rows = (r: unknown) => fd({ rows: JSON.stringify(r) });

  it("is ADMIN only and updates each flat scoped to the society", async () => {
    vi.mocked(prisma.flat.updateMany).mockResolvedValue({ count: 1 } as never);
    const r = await updateFlatDetails(rows([
      { id: "f1", configuration: " 2 BHK ", areaSqFt: 925 },
      { id: "f2", configuration: "", areaSqFt: null },
    ]));
    expect(r).toEqual({ success: true, updated: 2 });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(vi.mocked(prisma.flat.updateMany).mock.calls[0][0]).toEqual({
      where: { id: "f1", societyId: "s1" }, data: { configuration: "2 BHK", areaSqFt: 925 },
    });
    expect(vi.mocked(prisma.flat.updateMany).mock.calls[1][0]).toEqual({
      where: { id: "f2", societyId: "s1" }, data: { configuration: null, areaSqFt: null },
    });
  });

  it("counts only flats that really belong to the society", async () => {
    vi.mocked(prisma.flat.updateMany).mockResolvedValueOnce({ count: 1 } as never).mockResolvedValueOnce({ count: 0 } as never);
    const r = await updateFlatDetails(rows([
      { id: "mine", configuration: "1 BHK", areaSqFt: 500 },
      { id: "foreign", configuration: "1 BHK", areaSqFt: 500 },
    ]));
    expect(r).toMatchObject({ updated: 1 });
  });

  it("rejects malformed, empty, oversized and non-positive input", async () => {
    expect(await updateFlatDetails(fd({ rows: "not json" }))).toMatchObject({ error: expect.any(String) });
    expect(await updateFlatDetails(rows([]))).toMatchObject({ error: expect.any(String) });
    expect(await updateFlatDetails(rows([{ id: "f1", configuration: "x", areaSqFt: -1 }]))).toMatchObject({ error: expect.any(String) });
    expect(await updateFlatDetails(rows([{ id: "f1", configuration: "x".repeat(40), areaSqFt: 1 }]))).toMatchObject({ error: expect.any(String) });
    expect(await updateFlatDetails(rows(Array.from({ length: 501 }, (_, i) => ({ id: `f${i}`, configuration: null, areaSqFt: null }))))).toMatchObject({ error: expect.any(String) });
    expect(prisma.flat.updateMany).not.toHaveBeenCalled();
  });
});
