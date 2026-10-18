import { describe, it, expect, afterEach } from "vitest";
import { isFullyVerified } from "@/lib/verification";

const d = new Date();

describe("isFullyVerified", () => {
  const original = process.env.REQUIRE_VERIFICATION;
  afterEach(() => {
    if (original === undefined) delete process.env.REQUIRE_VERIFICATION;
    else process.env.REQUIRE_VERIFICATION = original;
  });

  it("needs both email and mobile verified", () => {
    expect(isFullyVerified({ role: "OWNER", emailVerifiedAt: d, phoneVerifiedAt: d })).toBe(true);
    expect(isFullyVerified({ role: "OWNER", emailVerifiedAt: d, phoneVerifiedAt: null })).toBe(false);
    expect(isFullyVerified({ role: "ADMIN", emailVerifiedAt: null, phoneVerifiedAt: d })).toBe(false);
  });

  it("exempts the super admin", () => {
    expect(isFullyVerified({ role: "SUPER_ADMIN", emailVerifiedAt: null, phoneVerifiedAt: null })).toBe(true);
  });

  it("can be switched off with REQUIRE_VERIFICATION=false", () => {
    process.env.REQUIRE_VERIFICATION = "false";
    expect(isFullyVerified({ role: "OWNER", emailVerifiedAt: null, phoneVerifiedAt: null })).toBe(true);
  });
});
