import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flat: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    floor: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user1", role: "ADMIN", societyId: "society1" },
  }),
}));

import { deleteFlat, addFlat } from "@/actions/flats";
import { prisma } from "@/lib/prisma";

const mockFlatFind = vi.mocked(prisma.flat.findFirst);
const mockFlatDelete = vi.mocked(prisma.flat.delete);
const mockFlatCreate = vi.mocked(prisma.flat.create);
const mockFlatCreateMany = vi.mocked(prisma.flat.createMany);
const mockFloorFind = vi.mocked(prisma.floor.findFirst);

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

describe("addFlat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFloorFind.mockResolvedValue({ id: "floor1" } as never);
  });

  it("creates a single flat when no end is given", async () => {
    const r = await addFlat(fd({ number: "101", toNumber: "", floorId: "floor1" }));
    expect(r).toMatchObject({ success: true, created: 1, skipped: 0 });
    expect(mockFlatCreate).toHaveBeenCalledWith({
      data: { number: "101", floorId: "floor1", societyId: "society1" },
    });
    expect(mockFlatCreateMany).not.toHaveBeenCalled();
  });

  it("creates a range, skipping flats that already exist", async () => {
    mockFlatCreateMany.mockResolvedValue({ count: 3 } as never);
    const r = await addFlat(fd({ number: "A-101", toNumber: "105", floorId: "floor1" }));
    expect(r).toMatchObject({ success: true, created: 3, skipped: 2 });
    expect(mockFlatCreateMany).toHaveBeenCalledWith({
      data: ["A-101", "A-102", "A-103", "A-104", "A-105"].map((number) => ({
        number, floorId: "floor1", societyId: "society1",
      })),
      skipDuplicates: true,
    });
  });

  it("rejects an invalid range without touching the database", async () => {
    const r = await addFlat(fd({ number: "110", toNumber: "101", floorId: "floor1" }));
    expect(r.error).toMatch(/same as or higher/);
    expect(mockFlatCreateMany).not.toHaveBeenCalled();
  });

  it("does not create flats on a floor from another society", async () => {
    mockFloorFind.mockResolvedValue(null);
    const r = await addFlat(fd({ number: "101", toNumber: "103", floorId: "other" }));
    expect(r.error).toBe("Floor not found");
    expect(mockFlatCreateMany).not.toHaveBeenCalled();
  });
});

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
