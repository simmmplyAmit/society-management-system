import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flat: {
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

import { deleteFlat } from "@/actions/flats";
import { prisma } from "@/lib/prisma";

const mockFlatFind = vi.mocked(prisma.flat.findFirst);
const mockFlatDelete = vi.mocked(prisma.flat.delete);

describe("deleteFlat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error when the flat still has residents", async () => {
    mockFlatFind.mockResolvedValue({
      id: "flat1", number: "101", floorId: "floor1", societyId: "society1",
      _count: { residents: 2 },
    } as never);

    const result = await deleteFlat("flat1");

    expect(result.error).toMatch(/Remove all residents/);
    expect(mockFlatDelete).not.toHaveBeenCalled();
  });

  it("deletes the flat when it has no residents", async () => {
    mockFlatFind.mockResolvedValue({
      id: "flat1", number: "101", floorId: "floor1", societyId: "society1",
      _count: { residents: 0 },
    } as never);
    mockFlatDelete.mockResolvedValue({} as never);

    const result = await deleteFlat("flat1");

    expect(result.error).toBeUndefined();
    expect(mockFlatDelete).toHaveBeenCalledWith({ where: { id: "flat1" } });
  });

  it("returns an error when the flat is not found", async () => {
    mockFlatFind.mockResolvedValue(null);

    const result = await deleteFlat("nonexistent");

    expect(result.error).toBeTruthy();
    expect(mockFlatDelete).not.toHaveBeenCalled();
  });
});
