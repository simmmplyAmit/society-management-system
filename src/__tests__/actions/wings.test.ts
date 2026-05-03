import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come before action import) ────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wing: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user1", role: "ADMIN", societyId: "society1" },
  }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { deleteWing } from "@/actions/wings";
import { prisma } from "@/lib/prisma";

const mockWingFind = vi.mocked(prisma.wing.findFirst);
const mockWingDelete = vi.mocked(prisma.wing.delete);

describe("deleteWing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error when the wing has floors", async () => {
    mockWingFind.mockResolvedValue({
      id: "wing1", name: "A", societyId: "society1",
      _count: { floors: 2 },
    } as never);

    const result = await deleteWing("wing1");

    expect(result.error).toMatch(/Remove all floors/);
    expect(mockWingDelete).not.toHaveBeenCalled();
  });

  it("deletes the wing when it has no floors", async () => {
    mockWingFind.mockResolvedValue({
      id: "wing1", name: "A", societyId: "society1",
      _count: { floors: 0 },
    } as never);
    mockWingDelete.mockResolvedValue({} as never);

    const result = await deleteWing("wing1");

    expect(result.error).toBeUndefined();
    expect(mockWingDelete).toHaveBeenCalledWith({ where: { id: "wing1" } });
  });

  it("returns an error when the wing is not found", async () => {
    mockWingFind.mockResolvedValue(null);

    const result = await deleteWing("nonexistent");

    expect(result.error).toBeTruthy();
    expect(mockWingDelete).not.toHaveBeenCalled();
  });
});
