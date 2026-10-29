import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "ADMIN", societyId: "s1" } }),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-pw") } }));

import { createUser, toggleUserActive } from "@/actions/users";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { name: "Rahul Sharma", email: "rahul@x.com", role: "OWNER", password: "longenough" };

describe("createUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the ADMIN role", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    await createUser(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const r = await createUser(fd({ ...valid, password: "short12" }));
    expect(r.error).toMatch(/at least 8/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects SUPER_ADMIN as a role", async () => {
    const r = await createUser(fd({ ...valid, role: "SUPER_ADMIN" }));
    expect(r.error).toBeDefined();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate emails whatever their case", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "x" } as never);
    const r = await createUser(fd({ ...valid, email: " Rahul@X.com " }));
    expect(r.error).toMatch(/already exists/);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "rahul@x.com", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("creates the user in the admin's society with a hashed password", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const r = await createUser(fd(valid));
    expect(r.success).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", passwordHash: "hashed-pw", role: "OWNER", email: "rahul@x.com" }),
    });
  });
});

describe("toggleUserActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error for users outside the society", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const r = await toggleUserActive("ghost");
    expect(r.error).toMatch(/not found/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks admins from deactivating themselves", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "admin1", role: "ADMIN", isActive: true } as never);
    const r = await toggleUserActive("admin1");
    expect(r.error).toMatch(/own account/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks deactivating the last active admin", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "admin2", role: "ADMIN", isActive: true } as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    const r = await toggleUserActive("admin2");
    expect(r.error).toMatch(/last active admin/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows deactivating an admin when another active admin exists", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "admin2", role: "ADMIN", isActive: true } as never);
    vi.mocked(prisma.user.count).mockResolvedValue(2);
    await toggleUserActive("admin2");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "admin2" }, data: { isActive: false } });
  });

  it("deactivates a regular user without admin checks", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u9", role: "TENANT", isActive: true } as never);
    await toggleUserActive("u9");
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u9" }, data: { isActive: false } });
  });

  it("always allows reactivating an inactive user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u9", role: "ADMIN", isActive: false } as never);
    await toggleUserActive("u9");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u9" }, data: { isActive: true } });
  });
});
