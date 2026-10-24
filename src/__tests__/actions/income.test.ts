import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { income: { create: vi.fn().mockResolvedValue({ id: "i1" }), deleteMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));

import { addIncome, deleteIncome, updateIncome } from "@/actions/income";
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
    expect(r).toEqual({ success: true, incomeId: "i1" });
    expect(prisma.income.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", addedById: "t1", amount: 1250.75, reference: "UTR123" }),
      select: { id: true },
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

describe("updateIncome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.income.updateMany).mockResolvedValue({ count: 1 });
  });

  it("requires TREASURER or ADMIN and scopes the update by society", async () => {
    const r = await updateIncome("i1", fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["TREASURER", "ADMIN"]);
    expect(r).toEqual({ success: true });
    expect(prisma.income.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", societyId: "s1" },
      data: expect.objectContaining({ amount: 1250.75, category: "Bank interest" }),
    });
  });

  it("cannot move an entry to another society", async () => {
    await updateIncome("i1", fd({ ...valid, societyId: "other" }));
    expect(vi.mocked(prisma.income.updateMany).mock.calls[0][0].data).not.toHaveProperty("societyId");
  });

  it("reports an entry that isn't in this society", async () => {
    vi.mocked(prisma.income.updateMany).mockResolvedValue({ count: 0 });
    expect(await updateIncome("x", fd(valid))).toEqual({ error: "Income entry not found" });
  });

  it("rejects invalid input without writing", async () => {
    expect(await updateIncome("i1", fd({ ...valid, amount: "-1" }))).toHaveProperty("error");
    expect(prisma.income.updateMany).not.toHaveBeenCalled();
  });
});

describe("income money channel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores cash income with no bank account, whatever account was sent", async () => {
    await addIncome(fd({ ...valid, channel: "CASH", bankAccountId: "b1" }));
    expect(vi.mocked(prisma.income.create).mock.calls[0][0].data).toMatchObject({ receivedVia: "CASH", bankAccountId: null });
  });

  it("defaults to the bank and the primary account", async () => {
    await addIncome(fd(valid));
    expect(vi.mocked(prisma.income.create).mock.calls[0][0].data).toMatchObject({ receivedVia: "BANK", bankAccountId: null });
  });

  it("rejects an unknown channel", async () => {
    expect(await addIncome(fd({ ...valid, channel: "CHEQUE" }))).toHaveProperty("error");
  });
});
