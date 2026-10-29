import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/otp", () => ({ issueOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/rate-limit", () => ({ resetAttempts: vi.fn() }));

import { requestPasswordReset, resetPassword } from "@/actions/password-reset";
import { prisma } from "@/lib/prisma";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/notify/email";
import { resetAttempts } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const user = prisma.user;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
});

describe("requestPasswordReset", () => {
  it("emails a code to an active user", async () => {
    vi.mocked(user.findFirst).mockResolvedValue({ id: "u1", email: "a@b.com", isActive: true } as never);
    vi.mocked(issueOtp).mockResolvedValue({ ok: true, code: "111222" });
    expect(await requestPasswordReset(fd({ email: " A@B.com " }))).toEqual({ success: true });
    expect(user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: "a@b.com", mode: "insensitive" } } }));
    expect(issueOtp).toHaveBeenCalledWith({ userId: "u1", purpose: "RESET_PASSWORD", channel: "EMAIL", target: "a@b.com" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.com" }));
  });

  it("gives the same answer for unknown, inactive and throttled emails, and sends nothing", async () => {
    vi.mocked(user.findFirst).mockResolvedValueOnce(null);
    expect(await requestPasswordReset(fd({ email: "nobody@b.com" }))).toEqual({ success: true });

    vi.mocked(user.findFirst).mockResolvedValueOnce({ id: "u2", email: "x@b.com", isActive: false } as never);
    expect(await requestPasswordReset(fd({ email: "x@b.com" }))).toEqual({ success: true });

    vi.mocked(user.findFirst).mockResolvedValueOnce({ id: "u3", email: "y@b.com", isActive: true } as never);
    vi.mocked(issueOtp).mockResolvedValueOnce({ ok: false, error: "Please wait a minute" });
    expect(await requestPasswordReset(fd({ email: "y@b.com" }))).toEqual({ success: true });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    expect(await requestPasswordReset(fd({ email: "nope" }))).toMatchObject({ error: expect.any(String) });
  });
});

describe("resetPassword", () => {
  const valid = { email: "a@b.com", code: "123456", password: "newpassword1" };

  it("sets the new password (hashed), verifies the email, and clears login throttling", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ ok: true, userId: "u1" });
    vi.mocked(user.findUnique).mockResolvedValue({ emailVerifiedAt: null } as never);
    expect(await resetPassword(fd(valid))).toEqual({ success: true });
    expect(verifyOtp).toHaveBeenCalledWith({ purpose: "RESET_PASSWORD", target: "a@b.com", code: "123456" });
    const data = vi.mocked(user.update).mock.calls[0][0].data as { passwordHash: string; emailVerifiedAt: Date };
    expect(data.passwordHash).not.toBe(valid.password);
    expect(await bcrypt.compare(valid.password, data.passwordHash)).toBe(true);
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(resetAttempts).toHaveBeenCalledWith("a@b.com");
  });

  it("rejects a bad code without changing anything", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ ok: false, error: "Invalid or expired code" });
    expect(await resetPassword(fd(valid))).toEqual({ error: "Invalid or expired code" });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("enforces password length before checking the code", async () => {
    expect(await resetPassword(fd({ ...valid, password: "short" }))).toMatchObject({ error: expect.stringMatching(/8 characters/) });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
