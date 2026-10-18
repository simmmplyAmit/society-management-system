import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { expense: { create: vi.fn(), deleteMany: vi.fn() } } }));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));

import { addExpense, deleteExpense } from "@/actions/expenses";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { title: "Lift repair", category: "Repairs", amount: "2500.50", date: "2026-10-01" };

describe("addExpense", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is limited to TREASURER and ADMIN", async () => {
    await addExpense(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["TREASURER", "ADMIN"]);
  });

  it("stores the expense against the session's society and user", async () => {
    const r = await addExpense(fd(valid));
    expect(r.success).toBe(true);
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", addedById: "t1", amount: 2500.5, title: "Lift repair" }),
    });
  });

  it("rejects non-positive amounts", async () => {
    const r = await addExpense(fd({ ...valid, amount: "0" }));
    expect(r.error).toMatch(/positive/);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a missing title", async () => {
    const r = await addExpense(fd({ ...valid, title: "" }));
    expect(r.error).toBeDefined();
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });
});

describe("deleteExpense", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only deletes within the caller's society", async () => {
    await deleteExpense("e1");
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({ where: { id: "e1", societyId: "s1" } });
  });
});
