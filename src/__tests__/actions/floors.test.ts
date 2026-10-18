import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    floor: {
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    wing: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user1", role: "ADMIN", societyId: "society1" },
  }),
}));

import { deleteFloor, addFloorDirect, addFloor } from "@/actions/floors";
import { prisma } from "@/lib/prisma";

const mockFloorFind = vi.mocked(prisma.floor.findFirst);
const mockFloorCreate = vi.mocked(prisma.floor.create);
const mockFloorDelete = vi.mocked(prisma.floor.delete);
const mockWingUpsert = vi.mocked(prisma.wing.upsert);
const mockWingFind = vi.mocked(prisma.wing.findFirst);
const mockFloorCreateMany = vi.mocked(prisma.floor.createMany);

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

describe("floor ranges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWingFind.mockResolvedValue({ id: "wing1" } as never);
    mockWingUpsert.mockResolvedValue({ id: "defaultWing" } as never);
  });

  it("addFloor creates a range in the wing, skipping existing floors", async () => {
    mockFloorCreateMany.mockResolvedValue({ count: 4 } as never);
    const r = await addFloor(fd({ number: "1", toNumber: "5", wingId: "wing1" }));
    expect(r).toMatchObject({ success: true, created: 4, skipped: 1 });
    expect(mockFloorCreateMany).toHaveBeenCalledWith({
      data: [1, 2, 3, 4, 5].map((number) => ({ number, wingId: "wing1" })),
      skipDuplicates: true,
    });
  });

  it("addFloor still creates a single floor when no end is given", async () => {
    const r = await addFloor(fd({ number: "3", toNumber: "", wingId: "wing1" }));
    expect(r).toMatchObject({ success: true, created: 1 });
    expect(mockFloorCreate).toHaveBeenCalledWith({ data: { number: 3, wingId: "wing1" } });
    expect(mockFloorCreateMany).not.toHaveBeenCalled();
  });

  it("addFloor rejects a wing from another society", async () => {
    mockWingFind.mockResolvedValue(null);
    const r = await addFloor(fd({ number: "1", toNumber: "5", wingId: "x" }));
    expect(r.error).toBe("Wing not found");
    expect(mockFloorCreateMany).not.toHaveBeenCalled();
  });

  it("addFloorDirect creates a range in the default wing", async () => {
    mockFloorCreateMany.mockResolvedValue({ count: 3 } as never);
    const r = await addFloorDirect(fd({ number: "0", toNumber: "2" }));
    expect(r).toMatchObject({ success: true, created: 3, skipped: 0 });
    expect(mockFloorCreateMany).toHaveBeenCalledWith({
      data: [0, 1, 2].map((number) => ({ number, wingId: "defaultWing" })),
      skipDuplicates: true,
    });
  });

  it("rejects a descending range", async () => {
    const r = await addFloorDirect(fd({ number: "5", toNumber: "2" }));
    expect(r.error).toMatch(/same as or higher/);
    expect(mockFloorCreateMany).not.toHaveBeenCalled();
  });

  it("rejects a negative or fractional end", async () => {
    expect((await addFloor(fd({ number: "1", toNumber: "-3", wingId: "wing1" }))).error).toMatch(/0 or above/);
    expect((await addFloor(fd({ number: "1", toNumber: "2.5", wingId: "wing1" }))).error).toMatch(/whole number/);
  });
});

describe("deleteFloor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error when the floor still has flats", async () => {
    mockFloorFind.mockResolvedValue({
      id: "floor1", number: 1, wingId: "wing1",
      _count: { flats: 3 },
    } as never);

    const result = await deleteFloor("floor1");

    expect(result.error).toMatch(/Remove all flats/);
    expect(mockFloorDelete).not.toHaveBeenCalled();
  });

  it("deletes the floor when it has no flats", async () => {
    mockFloorFind.mockResolvedValue({
      id: "floor1", number: 1, wingId: "wing1",
      _count: { flats: 0 },
    } as never);
    mockFloorDelete.mockResolvedValue({} as never);

    const result = await deleteFloor("floor1");

    expect(result.error).toBeUndefined();
    expect(mockFloorDelete).toHaveBeenCalledWith({ where: { id: "floor1" } });
  });

  it("returns an error when the floor is not found", async () => {
    mockFloorFind.mockResolvedValue(null);

    const result = await deleteFloor("nonexistent");

    expect(result.error).toBeTruthy();
    expect(mockFloorDelete).not.toHaveBeenCalled();
  });
});

describe("addFloorDirect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a floor under the _default_ wing", async () => {
    mockWingUpsert.mockResolvedValue({ id: "defaultWing", name: "_default_", societyId: "society1" } as never);
    mockFloorCreate.mockResolvedValue({ id: "floor1", number: 2, wingId: "defaultWing" } as never);

    const fd = new FormData();
    fd.set("number", "2");
    const result = await addFloorDirect(fd);

    expect(result.error).toBeUndefined();
    expect(mockWingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId_name: { societyId: "society1", name: "_default_" } },
      })
    );
    expect(mockFloorCreate).toHaveBeenCalledWith({
      data: { number: 2, wingId: "defaultWing" },
    });
  });

  it("returns an error when floor number is missing", async () => {
    const fd = new FormData();
    const result = await addFloorDirect(fd);

    expect(result.error).toBeTruthy();
    expect(mockFloorCreate).not.toHaveBeenCalled();
  });
});
