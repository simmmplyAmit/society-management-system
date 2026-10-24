import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  bankAccount: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bankAccount: { findFirst: vi.fn(), create: vi.fn() },
    bankBalanceCheck: { create: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));
vi.mock("@/lib/queries/bank", () => ({ getBankBalance: vi.fn().mockResolvedValue({ expected: 1000 }) }));

import { addBankAccount, setPrimaryBankAccount, recordBalanceCheck } from "@/actions/bank";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBankBalance } from "@/lib/queries/bank";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const validAccount = { name: "Maintenance savings", bankName: "Kotak", last4: "1234", openingBalance: "50000", openingDate: "2026-10-01" };

describe("addBankAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bankAccount.findFirst).mockResolvedValue(null);
    tx.bankAccount.count.mockResolvedValue(0);
  });

  it("is limited to ADMIN and TREASURER", async () => {
    await addBankAccount(fd(validAccount));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
  });

  it("makes the first account primary and scopes it to the session's society", async () => {
    expect(await addBankAccount(fd({ ...validAccount, societyId: "other" }))).toEqual({ success: true });
    expect(tx.bankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", isPrimary: true, openingBalance: 50000 }),
    });
  });

  it("does not make later accounts primary", async () => {
    tx.bankAccount.count.mockResolvedValue(1);
    await addBankAccount(fd(validAccount));
    expect(tx.bankAccount.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isPrimary: false }) });
  });

  it.each([
    ["negative opening balance", { openingBalance: "-1" }],
    ["short name", { name: "a" }],
    ["bad last 4", { last4: "12a4" }],
    ["future date", { openingDate: "2999-01-01" }],
    ["bad date", { openingDate: "nope" }],
  ])("rejects %s", async (_n, patch) => {
    expect(await addBankAccount(fd({ ...validAccount, ...patch }))).toHaveProperty("error");
    expect(tx.bankAccount.create).not.toHaveBeenCalled();
  });

  it("refuses a duplicate account", async () => {
    vi.mocked(prisma.bankAccount.findFirst).mockResolvedValue({ id: "x" } as never);
    expect(await addBankAccount(fd(validAccount))).toEqual({ error: "This account is already added" });
  });
});

describe("setPrimaryBankAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes by society and clears the old primary", async () => {
    tx.bankAccount.updateMany.mockResolvedValue({ count: 1 });
    expect(await setPrimaryBankAccount("b2")).toEqual({ success: true });
    expect(tx.bankAccount.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "b2", societyId: "s1", isActive: true },
      data: { isPrimary: true },
    });
    expect(tx.bankAccount.updateMany).toHaveBeenNthCalledWith(2, {
      where: { societyId: "s1", id: { not: "b2" }, isPrimary: true },
      data: { isPrimary: false },
    });
  });

  it("refuses an account from another society", async () => {
    tx.bankAccount.updateMany.mockResolvedValue({ count: 0 });
    expect(await setPrimaryBankAccount("foreign")).toEqual({ error: "Account not found" });
    expect(tx.bankAccount.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("recordBalanceCheck", () => {
  const account = { id: "b1", societyId: "s1", openingBalance: 500, openingDate: new Date("2026-10-01"), isPrimary: true };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bankAccount.findFirst).mockResolvedValue(account as never);
    vi.mocked(getBankBalance).mockResolvedValue({ expected: 1000 } as never);
  });

  it("computes the expected balance on the server and stores the difference", async () => {
    const r = await recordBalanceCheck(fd({ bankAccountId: "b1", statementBalance: "1200.50", asOf: "2026-10-15", expected: "999999" }));
    expect(r).toEqual({ success: true, expected: 1000, difference: 200.5 });
    expect(prisma.bankAccount.findFirst).toHaveBeenCalledWith({ where: { id: "b1", societyId: "s1", isActive: true } });
    expect(prisma.bankBalanceCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", expectedBalance: 1000, difference: 200.5, recordedById: "t1" }),
    });
  });

  it("refuses a statement date before the opening date", async () => {
    expect(await recordBalanceCheck(fd({ bankAccountId: "b1", statementBalance: "1", asOf: "2026-09-01" }))).toHaveProperty("error");
    expect(prisma.bankBalanceCheck.create).not.toHaveBeenCalled();
  });

  it("refuses an account of another society", async () => {
    vi.mocked(prisma.bankAccount.findFirst).mockResolvedValue(null);
    expect(await recordBalanceCheck(fd({ bankAccountId: "x", statementBalance: "1", asOf: "2026-10-15" }))).toEqual({ error: "Account not found" });
  });

  it("refuses a future date", async () => {
    expect(await recordBalanceCheck(fd({ bankAccountId: "b1", statementBalance: "1", asOf: "2999-01-01" }))).toHaveProperty("error");
  });
});
