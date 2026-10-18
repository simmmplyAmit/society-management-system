import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    otpCode: {
      findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  issueOtp, verifyOtp, hashCode, generateCode,
  OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_PER_HOUR, OTP_TTL_MS,
} from "@/lib/otp";

const db = vi.mocked(prisma.otpCode);
const target = "a@b.com";
const now = new Date("2026-10-18T10:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AUTH_SECRET = "test-secret";
});

describe("generateCode", () => {
  it("returns 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe("issueOtp", () => {
  it("stores only a hash, with an expiry, and retires earlier codes", async () => {
    db.findFirst.mockResolvedValue(null);
    db.count.mockResolvedValue(0);
    const r = await issueOtp({ userId: "u1", purpose: "VERIFY_EMAIL", channel: "EMAIL", target, now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { target, purpose: "VERIFY_EMAIL", consumedAt: null },
      data: { consumedAt: now },
    });
    const data = db.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.codeHash).toBe(hashCode(r.code, target, "VERIFY_EMAIL"));
    expect(JSON.stringify(data)).not.toContain(r.code);
    expect(data.expiresAt).toEqual(new Date(now.getTime() + OTP_TTL_MS));
  });

  it("enforces the resend cooldown", async () => {
    db.findFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS + 1000) } as never);
    const r = await issueOtp({ purpose: "VERIFY_EMAIL", channel: "EMAIL", target, now });
    expect(r).toMatchObject({ ok: false });
    expect(db.create).not.toHaveBeenCalled();
  });

  it("enforces the hourly cap", async () => {
    db.findFirst.mockResolvedValue(null);
    db.count.mockResolvedValue(OTP_MAX_PER_HOUR);
    const r = await issueOtp({ purpose: "RESET_PASSWORD", channel: "EMAIL", target, now });
    expect(r).toMatchObject({ ok: false });
    expect(db.create).not.toHaveBeenCalled();
  });
});

describe("verifyOtp", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "o1", userId: "u1", attempts: 0, codeHash: hashCode("123456", target, "VERIFY_EMAIL"), ...over,
  });

  it("accepts the right code once and returns the owner", async () => {
    db.findFirst.mockResolvedValue(row() as never);
    db.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "123456", now });
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(db.updateMany).toHaveBeenCalledWith({ where: { id: "o1", consumedAt: null }, data: { consumedAt: now } });
  });

  it("only looks at unconsumed, unexpired codes for this purpose and target", async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "123456", now })).toMatchObject({ ok: false });
    expect(db.findFirst.mock.calls[0][0]!.where).toEqual({
      purpose: "VERIFY_EMAIL", target, consumedAt: null, expiresAt: { gt: now },
    });
  });

  it("counts a wrong guess against the code", async () => {
    db.findFirst.mockResolvedValue(row() as never);
    const r = await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "000000", now });
    expect(r).toMatchObject({ ok: false });
    expect(db.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { attempts: { increment: 1 } } });
  });

  it("locks the code after too many attempts, even for the right code", async () => {
    db.findFirst.mockResolvedValue(row({ attempts: OTP_MAX_ATTEMPTS }) as never);
    expect(await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "123456", now })).toMatchObject({ ok: false });
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a code that was consumed by a concurrent request", async () => {
    db.findFirst.mockResolvedValue(row() as never);
    db.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "123456", now })).toMatchObject({ ok: false });
  });

  it("does not accept a code issued for another purpose or target", async () => {
    db.findFirst.mockResolvedValue(row({ codeHash: hashCode("123456", "other@b.com", "VERIFY_EMAIL") }) as never);
    expect(await verifyOtp({ purpose: "VERIFY_EMAIL", target, code: "123456", now })).toMatchObject({ ok: false });
  });
});
