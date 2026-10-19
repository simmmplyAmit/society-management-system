import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    creditEntry: { findFirst: vi.fn() },
    paymentClaim: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));
vi.mock("@/lib/ledger", () => ({ depositAndApply: vi.fn() }));
vi.mock("@/lib/credit-service", () => ({ notifyApplied: vi.fn() }));

import { recordDeposit } from "@/actions/credit";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } } as never);
  vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1" } as never);
  vi.mocked(prisma.creditEntry.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.paymentClaim.findFirst).mockResolvedValue(null);
  vi.mocked(depositAndApply).mockResolvedValue({ applied: [{ entryId: "e1", paymentId: "p1", amount: 500, fullyPaid: false }], balance: 0 });
});

describe("recordDeposit", () => {
  it("is ADMIN/TREASURER only", async () => {
    await recordDeposit(fd({ userId: "u1", amount: "500" }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
  });

  it("only accepts an active member of the caller's society who is linked to a flat", async () => {
    await recordDeposit(fd({ userId: "u1", amount: "500" }));
    expect(vi.mocked(prisma.user.findFirst).mock.calls[0][0]!.where).toEqual({
      id: "u1", societyId: "s1", isActive: true, flatResidents: { some: {} },
    });

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect(await recordDeposit(fd({ userId: "outsider", amount: "500" }))).toMatchObject({ error: expect.stringMatching(/not found/) });
  });

  it("credits any positive amount, applies it, and sends receipts", async () => {
    const r = await recordDeposit(fd({ userId: "u1", amount: "1234.56", reference: "ab12 3456 7890", note: "Cash" }));
    expect(r).toMatchObject({ success: true, applied: 1, balance: 0 });
    expect(depositAndApply).toHaveBeenCalledWith(expect.objectContaining({
      societyId: "s1", userId: "u1", actorId: "t1", amount: 1234.56, reference: "AB1234567890", note: "Cash",
    }));
    expect(notifyApplied).toHaveBeenCalledWith("s1", expect.any(Array));
  });

  it("rejects bad amounts, a bad reference and a reused reference", async () => {
    for (const amount of ["0", "-1", "abc", "99999999"]) {
      expect(await recordDeposit(fd({ userId: "u1", amount }))).toMatchObject({ error: expect.any(String) });
    }
    expect(await recordDeposit(fd({ userId: "u1", amount: "5", reference: "12" }))).toMatchObject({ error: expect.stringMatching(/8–22/) });

    vi.mocked(prisma.creditEntry.findFirst).mockResolvedValue({ id: "d" } as never);
    expect(await recordDeposit(fd({ userId: "u1", amount: "5", reference: "ABCD12345678" }))).toMatchObject({ error: expect.stringMatching(/already been used/) });
    expect(depositAndApply).not.toHaveBeenCalled();
  });

  it("reports a failure without crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(depositAndApply).mockRejectedValue(new Error("db"));
    expect(await recordDeposit(fd({ userId: "u1", amount: "500" }))).toMatchObject({ error: expect.any(String) });
  });
});
