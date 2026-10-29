import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  importBatch: { create: vi.fn().mockResolvedValue({ id: "b1" }) },
  wing: { upsert: vi.fn() },
  floor: { upsert: vi.fn() },
  flat: { createMany: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  maintenanceCharge: { createMany: vi.fn() },
  user: { createManyAndReturn: vi.fn() },
  flatResident: { createMany: vi.fn() },
  tenantRecord: { createMany: vi.fn() },
  maintenancePayment: { createMany: vi.fn() },
  expense: { createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    society: { findUnique: vi.fn() },
    flat: { findMany: vi.fn() },
    wing: { findMany: vi.fn() },
    maintenanceCharge: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    maintenancePayment: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    bankAccount: { findFirst: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hash") } }));

import { prisma } from "@/lib/prisma";
import { flatResolver, runImport } from "@/lib/queries/import";

const now = new Date(2026, 9, 29);
const base = { societyId: "s1", userId: "u1", now, fileName: "sheet.csv" };
const known = (id: string, wing: string, number: string, floor = 1) => ({
  id, number, configuration: null, areaSqFt: null, floorId: `f-${wing}${floor}`,
  floor: { number: floor, wing: { name: wing } },
});
const p = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  p.society.findUnique.mockResolvedValue({ hasWings: true } as never);
  p.flat.findMany.mockResolvedValue([]);
  p.wing.findMany.mockResolvedValue([]);
  p.maintenanceCharge.findMany.mockResolvedValue([]);
  p.user.findMany.mockResolvedValue([]);
  p.maintenancePayment.findMany.mockResolvedValue([]);
  p.expense.findMany.mockResolvedValue([]);
  p.bankAccount.findFirst.mockResolvedValue(null);
});

describe("runImport", () => {
  it("only checks when apply is false, and scopes reads to the society", async () => {
    const r = await runImport({ ...base, kind: "flats", apply: false, text: "Wing,Flat\nA,101" });
    expect(r.counts).toEqual({ create: 1, update: 0, skip: 0 });
    expect(r.applied).toBe(false);
    expect(p.$transaction).not.toHaveBeenCalled();
    expect(p.society.findUnique).toHaveBeenCalledWith({ where: { id: "s1" }, select: { hasWings: true } });
    expect(p.flat.findMany.mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });

  it("refuses to apply while any row has an error", async () => {
    const r = await runImport({ ...base, kind: "flats", apply: true, text: "Wing,Flat\nA,101\nA,7" });
    expect(r.errors).toHaveLength(1);
    expect(r.applied).toBe(false);
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing when every row already exists", async () => {
    p.flat.findMany.mockResolvedValue([known("x", "A", "101")] as never);
    const r = await runImport({ ...base, kind: "flats", apply: true, text: "Wing,Flat\nA,101" });
    expect(r.counts.skip).toBe(1);
    expect(r.applied).toBe(false);
  });
});

describe("flats", () => {
  it("creates missing wings and floors, the flats, and their maintenance charges", async () => {
    tx.wing.upsert.mockResolvedValue({ id: "wB" });
    tx.floor.upsert.mockResolvedValue({ id: "fB1" });
    tx.flat.findMany.mockResolvedValue([{ id: "new1", number: "101", floorId: "fB1" }]);
    const r = await runImport({ ...base, kind: "flats", apply: true, text: "Wing,Flat,Configuration,Monthly maintenance\nB,101,2 BHK,2500" });
    expect(r.applied).toBe(true);
    expect(r.notes[0]).toBe("1 wing will be created: B");
    expect(tx.importBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ societyId: "s1", kind: "FLATS", createdById: "u1", created: 1, fileName: "sheet.csv" }),
    }));
    expect(tx.wing.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { societyId_name: { societyId: "s1", name: "B" } } }));
    expect(tx.flat.createMany).toHaveBeenCalledWith({
      data: [{ societyId: "s1", floorId: "fB1", number: "101", configuration: "2 BHK", areaSqFt: null }],
      skipDuplicates: true,
    });
    expect(tx.maintenanceCharge.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ societyId: "s1", flatId: "new1", amount: 2500, startMonth: 10, startYear: 2026 })],
    });
  });

  it("puts flats of a wingless society in the hidden default wing", async () => {
    p.society.findUnique.mockResolvedValue({ hasWings: false } as never);
    tx.wing.upsert.mockResolvedValue({ id: "wd" });
    tx.floor.upsert.mockResolvedValue({ id: "fd" });
    await runImport({ ...base, kind: "flats", apply: true, text: "Flat\n201" });
    expect(tx.wing.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { societyId: "s1", name: "_default_" } }));
    expect(tx.floor.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { wingId: "wd", number: 2 } }));
  });

  it("updates details of existing flats and keeps an overlapping charge", async () => {
    p.flat.findMany.mockResolvedValue([known("x", "A", "101")] as never);
    p.wing.findMany.mockResolvedValue([{ id: "wA", name: "A", floors: [{ id: "f-A1", number: 1 }] }] as never);
    p.maintenanceCharge.findMany.mockResolvedValue([{ flatId: "x", startMonth: 4, startYear: 2026, endMonth: null, endYear: null }] as never);
    const r = await runImport({ ...base, kind: "flats", apply: true, text: "Wing,Flat,Area,Monthly maintenance\na,101,850,3000" });
    expect(r.items[0]).toMatchObject({ action: "update", text: "Update A-101: 850 sq ft" });
    expect(r.warnings[0].message).toMatch(/already has a maintenance charge from Apr 2026/);
    expect(tx.flat.update).toHaveBeenCalledWith({ where: { id: "x" }, data: { areaSqFt: 850 } });
    expect(tx.maintenanceCharge.createMany).not.toHaveBeenCalled();
    expect(tx.wing.upsert).not.toHaveBeenCalled();
  });
});

describe("flatResolver", () => {
  const flats = [
    { id: "1", number: "101", wing: "A", floorId: "", floor: 1, configuration: null, areaSqFt: null },
    { id: "2", number: "101", wing: "B", floorId: "", floor: 1, configuration: null, areaSqFt: null },
    { id: "3", number: "202", wing: "B", floorId: "", floor: 2, configuration: null, areaSqFt: null },
  ];
  const resolve = flatResolver(flats, true);
  it("finds a flat by wing, by a unique number, or written as A-101", () => {
    expect(resolve({ wing: "b", flat: "101" })).toEqual({ flat: flats[1] });
    expect(resolve({ wing: null, flat: "202" })).toEqual({ flat: flats[2] });
    expect(resolve({ wing: null, flat: "A-101" })).toEqual({ flat: flats[0] });
  });
  it("asks for the wing when a number is in several wings", () => {
    expect(resolve({ wing: null, flat: "101" })).toEqual({ error: "Flat 101 matches A-101, B-101; fill the Wing column" });
    expect(resolve({ wing: "C", flat: "101" })).toEqual({ error: "Flat C-101 not found. Import or add your flats first" });
  });
});

describe("residents", () => {
  beforeEach(() => {
    p.flat.findMany.mockResolvedValue([known("fl1", "A", "101"), known("fl2", "A", "102")] as never);
  });

  it("creates new members once, links each flat, and records tenants", async () => {
    tx.user.createManyAndReturn.mockResolvedValue([{ id: "n1", email: "ravi@x.com" }, { id: "n2", email: "tina@x.com" }]);
    const r = await runImport({
      ...base, kind: "residents", apply: true,
      text: "Name,Email,Wing,Flat,Type,Primary,Role\nRavi,ravi@x.com,A,101,owner,yes,admin\nRavi,ravi@x.com,A,102,owner,,\nTina,tina@x.com,A,102,tenant,,",
    });
    expect(r.applied).toBe(true);
    expect(tx.user.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ email: "ravi@x.com", name: "Ravi", role: "ADMIN", societyId: "s1", passwordHash: "hash" }),
        expect.objectContaining({ email: "tina@x.com", role: "TENANT", societyId: "s1" }),
      ],
      select: { id: true, email: true },
    });
    expect(tx.flatResident.createMany).toHaveBeenCalledWith({
      data: [
        { flatId: "fl1", userId: "n1", type: "OWNER", isPrimary: true },
        { flatId: "fl2", userId: "n1", type: "OWNER", isPrimary: false },
        { flatId: "fl2", userId: "n2", type: "TENANT", isPrimary: false },
      ],
      skipDuplicates: true,
    });
    expect(tx.flat.updateMany).toHaveBeenCalledWith({ where: { societyId: "s1", id: { in: ["fl1", "fl2", "fl2"] } }, data: { isOccupied: true } });
    expect(tx.tenantRecord.createMany).toHaveBeenCalledWith({ data: [{ flatId: "fl2", userId: "n2", startDate: now }] });
  });

  it("refuses an email that belongs to another society", async () => {
    p.user.findMany.mockResolvedValue([{ id: "o", email: "ravi@x.com", name: "Ravi", societyId: "other", isActive: true, flatResidents: [] }] as never);
    const r = await runImport({ ...base, kind: "residents", apply: true, text: "Name,Email,Flat\nRavi,ravi@x.com,101" });
    expect(r.errors[0].message).toMatch(/already used by another account/);
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it("links an existing member without changing their role, and skips existing links", async () => {
    p.user.findMany.mockResolvedValue([{ id: "m1", email: "ravi@x.com", name: "Ravi M", societyId: "s1", isActive: true, flatResidents: [{ flatId: "fl1" }] }] as never);
    tx.user.createManyAndReturn.mockResolvedValue([]);
    const r = await runImport({ ...base, kind: "residents", apply: true, text: "Name,Email,Flat,Role\nRavi,ravi@x.com,101,\nRavi,ravi@x.com,102,treasurer" });
    expect(r.items.map((i) => i.action)).toEqual(["skip", "update"]);
    expect(r.warnings[0].message).toMatch(/role is not changed/);
    expect(tx.user.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.flatResident.createMany).toHaveBeenCalledWith({ data: [{ flatId: "fl2", userId: "m1", type: "OWNER", isPrimary: false }], skipDuplicates: true });
  });
});

describe("dues", () => {
  beforeEach(() => {
    p.flat.findMany.mockResolvedValue([known("fl1", "A", "101")] as never);
  });

  it("imports history with the right status, tagged with the batch", async () => {
    const r = await runImport({
      ...base, kind: "dues", apply: true,
      text: "Flat,Month,Amount,Paid,Charge,Paid on,Reference\n101,Aug 2026,2500,2500,,10/08/2026,UTR1\n101,Sep 2026,2500,1000,,,\n101,Oct 2026,2500,,,,\n101,Oct 2026,5000,,Sinking fund,,",
    });
    expect(r.applied).toBe(true);
    const data = tx.maintenancePayment.createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      expect.objectContaining({ societyId: "s1", flatId: "fl1", month: 8, chargeKey: "MAINTENANCE", status: "PAID", amountPaid: 2500, paidAt: new Date(Date.UTC(2026, 7, 10)), importBatchId: "b1", notes: "Imported from earlier records · ref UTR1" }),
      expect.objectContaining({ month: 9, status: "OVERDUE", amountPaid: 1000, paidAt: null }),
      expect.objectContaining({ month: 10, status: "PENDING", amountPaid: 0 }),
      expect.objectContaining({ month: 10, chargeKey: "IMPORT:sinking fund", label: "Sinking fund", amount: 5000 }),
    ]);
    expect(tx.maintenancePayment.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(r.notes[0]).toMatch(/Outstanding from these rows: ₹9,000/);
  });

  it("skips dues that already exist", async () => {
    p.maintenancePayment.findMany.mockResolvedValue([{ flatId: "fl1", month: 9, year: 2026, chargeKey: "MAINTENANCE" }] as never);
    const r = await runImport({ ...base, kind: "dues", apply: false, text: "Flat,Month,Amount\n101,Sep 2026,2500" });
    expect(r.items[0]).toMatchObject({ action: "skip", text: "Maintenance for A-101, Sep 2026 already exists" });
    expect(p.maintenancePayment.findMany.mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });
});

describe("expenses", () => {
  it("creates expenses for the society and skips ones already recorded", async () => {
    p.expense.findMany.mockResolvedValue([{ date: new Date(Date.UTC(2026, 8, 5)), title: "Light bill", amount: 4820 }] as never);
    p.bankAccount.findFirst.mockResolvedValue({ openingDate: new Date(Date.UTC(2026, 8, 1)), name: "Main" } as never);
    const r = await runImport({ ...base, kind: "expenses", apply: true, text: "Date,Title,Amount,Paid via\n05/09/2026,light bill,4820,\n10/09/2026,Salary,12000,cash" });
    expect(r.items.map((i) => i.action)).toEqual(["skip", "create"]);
    expect(r.notes[1]).toMatch(/1 of these are on or after the opening date of "Main"/);
    expect(tx.expense.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ societyId: "s1", addedById: "u1", title: "Salary", amount: 12000, paidVia: "CASH", importBatchId: "b1" })],
    });
    expect(p.expense.findMany.mock.calls[0][0]!.where).toMatchObject({ societyId: "s1" });
  });
});
