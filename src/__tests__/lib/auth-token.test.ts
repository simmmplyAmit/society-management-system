import { describe, it, expect, vi } from "vitest";
import { refreshToken, REVALIDATE_MS } from "@/lib/auth-token";

const baseToken = { id: "u1", role: "OWNER" as const, societyId: "s1", checkedAt: 1_000 };

describe("refreshToken", () => {
  it("returns the token untouched when it has no user id", async () => {
    const fetchUser = vi.fn();
    const token = { role: "OWNER" as const };
    expect(await refreshToken(token, 5_000_000, fetchUser)).toBe(token);
    expect(fetchUser).not.toHaveBeenCalled();
  });

  it("skips the database inside the revalidation window", async () => {
    const fetchUser = vi.fn();
    const result = await refreshToken(baseToken, 1_000 + REVALIDATE_MS - 1, fetchUser);
    expect(result).toBe(baseToken);
    expect(fetchUser).not.toHaveBeenCalled();
  });

  it("refreshes role, society and checkedAt once the window has passed", async () => {
    const fetchUser = vi.fn().mockResolvedValue({ isActive: true, role: "TREASURER", societyId: "s2" });
    const now = 1_000 + REVALIDATE_MS;
    const result = await refreshToken(baseToken, now, fetchUser);
    expect(fetchUser).toHaveBeenCalledWith("u1");
    expect(result).toMatchObject({ id: "u1", role: "TREASURER", societyId: "s2", checkedAt: now });
  });

  it("checks the database when the token was never checked", async () => {
    const fetchUser = vi.fn().mockResolvedValue({ isActive: true, role: "OWNER", societyId: "s1" });
    await refreshToken({ id: "u1" }, 10, fetchUser);
    expect(fetchUser).toHaveBeenCalledOnce();
  });

  it("invalidates the session when the user was deactivated", async () => {
    const fetchUser = vi.fn().mockResolvedValue({ isActive: false, role: "OWNER", societyId: "s1" });
    expect(await refreshToken(baseToken, 1_000 + REVALIDATE_MS, fetchUser)).toBeNull();
  });

  it("invalidates the session when the user no longer exists", async () => {
    const fetchUser = vi.fn().mockResolvedValue(null);
    expect(await refreshToken(baseToken, 1_000 + REVALIDATE_MS, fetchUser)).toBeNull();
  });
});
