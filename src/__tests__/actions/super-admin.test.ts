import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() }, society: { create: vi.fn() } } }));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "sa", role: "SUPER_ADMIN", societyId: null } }),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-pw") } }));

import { createSociety } from "@/actions/super-admin";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = {
  societyName: "Sunrise Residency", city: "Pune", upiId: "sunrise@upi",
  adminName: "Asha Rao", adminEmail: "Asha@Example.com", adminPassword: "longenough",
};

describe("createSociety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  });

  it("is SUPER_ADMIN only", async () => {
    await createSociety(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["SUPER_ADMIN"]);
  });

  it("creates the society with its first ADMIN in one write, normalising the email", async () => {
    const r = await createSociety(fd(valid));
    expect(r).toEqual({ success: true });
    expect(prisma.society.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Sunrise Residency",
        upiId: "sunrise@upi",
        users: { create: expect.objectContaining({ email: "asha@example.com", role: "ADMIN", passwordHash: "hashed-pw" }) },
      }),
    });
  });

  it("rejects an invalid UPI id", async () => {
    const r = await createSociety(fd({ ...valid, upiId: "not-upi" }));
    expect(r).toMatchObject({ error: expect.stringMatching(/UPI/) });
    expect(prisma.society.create).not.toHaveBeenCalled();
  });

  it("rejects a short admin password", async () => {
    const r = await createSociety(fd({ ...valid, adminPassword: "short" }));
    expect(r).toMatchObject({ error: expect.stringMatching(/at least 8/) });
  });

  it("rejects an already-registered admin email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "x" } as never);
    const r = await createSociety(fd(valid));
    expect(r).toMatchObject({ error: expect.stringMatching(/already exists/) });
    expect(prisma.society.create).not.toHaveBeenCalled();
  });

  it("allows UPI and city to be omitted", async () => {
    const r = await createSociety(fd({ ...valid, upiId: "", city: "" }));
    expect(r).toEqual({ success: true });
    expect(prisma.society.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ upiId: null, city: null }),
    });
  });
});
