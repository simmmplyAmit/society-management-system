import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { income: { create: vi.fn(), deleteMany: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));

import { addIncome, deleteIncome } from "@/actions/income";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { title: "Savings interest", category: "Bank interest", amount: "1250.75", date: "2026-10-01" };

describe("addIncome", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is limited to TREASURER and ADMIN", async () => {
    await addIncome(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["TREASURER", "ADMIN"]);
  });

  it("saves income scoped to the session's society and user", async () => {
    const r = await addIncome(fd({ ...valid, reference: "UTR123" }));
    expect(r).toEqual({ success: true });
    expect(prisma.income.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", addedById: "t1", amount: 1250.75, reference: "UTR123" }),
    });
  });

  it("ignores a societyId supplied by the client", async () => {
    await addIncome(fd({ ...valid, societyId: "other" }));
    expect(vi.mocked(prisma.income.create).mock.calls[0][0].data.societyId).toBe("s1");
  });

  it.each([
    ["non-positive amount", { amount: "0" }],
    ["negative amount", { amount: "-5" }],
    ["huge amount", { amount: "999999999" }],
    ["short title", { title: "a" }],
    ["missing category", { category: "" }],
    ["bad date", { date: "not-a-date" }],
  ])("rejects %s", async (_n, patch) => {
    const r = await addIncome(fd({ ...valid, ...patch }));
    expect(r).toHaveProperty("error");
    expect(prisma.income.create).not.toHaveBeenCalled();
  });
});

describe("deleteIncome", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires TREASURER or ADMIN and scopes the delete by society", async () => {
    await deleteIncome("i1");
    expect(requireRole).toHaveBeenCalledWith(["TREASURER", "ADMIN"]);
    expect(prisma.income.deleteMany).toHaveBeenCalledWith({ where: { id: "i1", societyId: "s1" } });
  });
});
