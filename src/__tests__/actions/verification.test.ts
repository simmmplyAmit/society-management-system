import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/session", () => ({
  getSessionUnverified: vi.fn().mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } }),
}));
vi.mock("@/lib/otp", () => ({ issueOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notify/sms", () => ({ sendSms: vi.fn() }));

import { sendEmailCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode } from "@/actions/verification";
import { prisma } from "@/lib/prisma";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/notify/email";
import { getSessionUnverified } from "@/lib/session";
import { sendSms } from "@/lib/notify/sms";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const user = prisma.user;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSessionUnverified).mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendEmailCode", () => {
  it("sends a code to the signed-in user's own email only", async () => {
    vi.mocked(user.findUnique).mockResolvedValue({ id: "u1", email: "Me@X.com", emailVerifiedAt: null } as never);
    vi.mocked(issueOtp).mockResolvedValue({ ok: true, code: "123456" });
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });
    const r = await sendEmailCode();
    expect(r).toEqual({ success: true, devCode: undefined });
    expect(user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" } }));
    expect(issueOtp).toHaveBeenCalledWith({ userId: "u1", purpose: "VERIFY_EMAIL", channel: "EMAIL", target: "me@x.com" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "Me@X.com" }));
  });

  it("refuses when already verified", async () => {
    vi.mocked(user.findUnique).mockResolvedValue({ id: "u1", email: "m@x.com", emailVerifiedAt: new Date() } as never);
    expect(await sendEmailCode()).toMatchObject({ error: expect.stringMatching(/already/) });
    expect(issueOtp).not.toHaveBeenCalled();
  });

  it("passes throttle errors through and hides send failures", async () => {
    vi.mocked(user.findUnique).mockResolvedValue({ id: "u1", email: "m@x.com", emailVerifiedAt: null } as never);
    vi.mocked(issueOtp).mockResolvedValueOnce({ ok: false, error: "Please wait a minute" });
    expect(await sendEmailCode()).toEqual({ error: "Please wait a minute" });

    vi.mocked(issueOtp).mockResolvedValueOnce({ ok: true, code: "123456" });
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "Resend 401: bad key" });
    const r = await sendEmailCode();
    expect(JSON.stringify(r)).not.toMatch(/Resend|bad key/);
  });
});

describe("verifyEmailCode", () => {
  beforeEach(() => vi.mocked(user.findUnique).mockResolvedValue({ email: "m@x.com" } as never));

  it("marks the email verified on a valid code", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ ok: true, userId: "u1" });
    expect(await verifyEmailCode(fd({ code: "123456" }))).toEqual({ success: true });
    expect(user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { emailVerifiedAt: expect.any(Date) } });
  });

  it("rejects a malformed code without touching the database", async () => {
    expect(await verifyEmailCode(fd({ code: "12ab" }))).toMatchObject({ error: expect.any(String) });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects a code that belongs to a different user", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ ok: true, userId: "someone-else" });
    expect(await verifyEmailCode(fd({ code: "123456" }))).toMatchObject({ error: expect.any(String) });
    expect(user.update).not.toHaveBeenCalled();
  });
});

describe("phone verification", () => {
  it("normalizes the number and sends the SMS code to it", async () => {
    vi.mocked(user.findUnique).mockResolvedValue({ id: "u1", phone: null, phoneVerifiedAt: null } as never);
    vi.mocked(issueOtp).mockResolvedValue({ ok: true, code: "654321" });
    vi.mocked(sendSms).mockResolvedValue({ ok: true });
    expect(await sendPhoneCode(fd({ phone: "98765 43210" }))).toMatchObject({ success: true });
    expect(issueOtp).toHaveBeenCalledWith({ userId: "u1", purpose: "VERIFY_PHONE", channel: "SMS", target: "+919876543210" });
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: "+919876543210", template: "otp" }));
  });

  it("rejects an invalid number", async () => {
    expect(await sendPhoneCode(fd({ phone: "12345" }))).toMatchObject({ error: expect.stringMatching(/valid/) });
    expect(issueOtp).not.toHaveBeenCalled();
  });

  it("stores the verified number on success", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ ok: true, userId: "u1" });
    expect(await verifyPhoneCode(fd({ phone: "9876543210", code: "654321" }))).toEqual({ success: true });
    expect(verifyOtp).toHaveBeenCalledWith({ purpose: "VERIFY_PHONE", target: "+919876543210", code: "654321" });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { phone: "+919876543210", phoneVerifiedAt: expect.any(Date) },
    });
  });
});
