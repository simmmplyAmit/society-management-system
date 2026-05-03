import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    floor: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    wing: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user1", role: "ADMIN", societyId: "society1" },
  }),
}));

import { deleteFloor, addFloorDirect } from "@/actions/floors";
import { prisma } from "@/lib/prisma";

const mockFloorFind = vi.mocked(prisma.floor.findFirst);
const mockFloorCreate = vi.mocked(prisma.floor.create);
const mockFloorDelete = vi.mocked(prisma.floor.delete);
const mockWingUpsert = vi.mocked(prisma.wing.upsert);

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
