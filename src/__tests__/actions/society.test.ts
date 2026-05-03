import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    society: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user1", role: "ADMIN", societyId: "society1" },
  }),
}));

import { updateSociety } from "@/actions/society";
import { prisma } from "@/lib/prisma";

const mockUpdate = vi.mocked(prisma.society.update);

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("updateSociety", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves all fields correctly when hasWings checkbox is checked", async () => {
    mockUpdate.mockResolvedValue({} as never);

    const fd = makeFormData({
      name: "Test Society",
      city: "Mumbai",
      hasWings: "on",
    });
    const result = await updateSociety(fd);

    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Test Society",
          city: "Mumbai",
          hasWings: true,
        }),
      })
    );
  });

  it("saves hasWings as false when checkbox is unchecked", async () => {
    mockUpdate.mockResolvedValue({} as never);

    const fd = makeFormData({ name: "Test Society" }); // no hasWings key → unchecked
    const result = await updateSociety(fd);

    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasWings: false }),
      })
    );
  });

  it("converts empty strings to null for optional fields", async () => {
    mockUpdate.mockResolvedValue({} as never);

    const fd = makeFormData({ name: "Test Society", address: "", city: "", upiId: "" });
    await updateSociety(fd);

    const callData = mockUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(callData.address).toBeNull();
    expect(callData.city).toBeNull();
    expect(callData.upiId).toBeNull();
  });

  it("trims whitespace from optional fields and saves non-empty values", async () => {
    mockUpdate.mockResolvedValue({} as never);

    const fd = makeFormData({ name: "Test Society", city: "  Mumbai  " });
    await updateSociety(fd);

    const callData = mockUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(callData.city).toBe("Mumbai");
  });

  it("returns a validation error when name is too short", async () => {
    const fd = makeFormData({ name: "X" });
    const result = await updateSociety(fd);

    expect(result.error).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns an error when the Prisma update throws", async () => {
    mockUpdate.mockRejectedValue(new Error("DB error"));

    const fd = makeFormData({ name: "Valid Name" });
    const result = await updateSociety(fd);

    expect(result.error).toBeTruthy();
  });
});
