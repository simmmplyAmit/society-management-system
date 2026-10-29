import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany: vi.fn() } } }));

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLocale } from "@/i18n/locale";
import { setLocale } from "@/actions/locale";

const fd = (locale: string) => {
  const d = new FormData();
  d.set("locale", locale);
  return d;
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  vi.mocked(auth).mockResolvedValue(null as never);
});

describe("resolveLocale", () => {
  it("prefers the cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "mr" });
    expect(await resolveLocale()).toBe("mr");
    expect(auth).not.toHaveBeenCalled();
  });

  it("falls back to the signed-in user's saved choice, then English", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { locale: "hi" } } as never);
    expect(await resolveLocale()).toBe("hi");
    vi.mocked(auth).mockResolvedValue({ user: { locale: "xx" } } as never);
    expect(await resolveLocale()).toBe("en");
  });

  it("is English outside a request", async () => {
    vi.mocked(cookies).mockRejectedValueOnce(new Error("outside a request scope"));
    expect(await resolveLocale()).toBe("en");
  });
});

describe("setLocale", () => {
  it("sets a year-long cookie and saves the choice on the caller's own account only", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    expect(await setLocale(fd("hi"))).toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledWith("locale", "hi", expect.objectContaining({ path: "/", maxAge: 31_536_000, sameSite: "lax" }));
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1" }, data: { locale: "hi" } });
  });

  it("works before sign-in without touching the database", async () => {
    expect(await setLocale(fd("mr"))).toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown languages", async () => {
    expect(await setLocale(fd("fr"))).toEqual({ error: "Unsupported language" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
