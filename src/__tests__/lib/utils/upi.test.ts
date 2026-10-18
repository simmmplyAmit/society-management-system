import { describe, it, expect } from "vitest";
import { isValidUpiId, buildUpiLink } from "@/lib/utils/upi";

describe("isValidUpiId", () => {
  it.each(["society@okhdfcbank", "sunrise.residency@upi", "a-b_c.1@ybl"])("accepts %s", (id) => {
    expect(isValidUpiId(id)).toBe(true);
  });
  it.each(["", "nope", "@upi", "a@", "a b@upi", "a@@upi", null, undefined])("rejects %s", (id) => {
    expect(isValidUpiId(id as string | null | undefined)).toBe(false);
  });
});

describe("buildUpiLink", () => {
  it("builds a full deep link with encoded fields", () => {
    const link = buildUpiLink({ upiId: "soc@upi", payeeName: "Sunrise Residency", amount: 1500, note: "Maintenance dues" });
    expect(link).toBe("upi://pay?pa=soc%40upi&pn=Sunrise%20Residency&am=1500.00&cu=INR&tn=Maintenance%20dues");
  });
  it("returns null for an invalid UPI id", () => {
    expect(buildUpiLink({ upiId: "bad", amount: 10 })).toBeNull();
    expect(buildUpiLink({ upiId: null })).toBeNull();
  });
  it("omits the amount when zero, negative or not numeric", () => {
    expect(buildUpiLink({ upiId: "ab@upi", amount: 0 })).not.toContain("am=");
    expect(buildUpiLink({ upiId: "ab@upi", amount: -5 })).not.toContain("am=");
    expect(buildUpiLink({ upiId: "ab@upi", amount: "abc" })).not.toContain("am=");
  });
  it("accepts string amounts and formats to two decimals", () => {
    expect(buildUpiLink({ upiId: "ab@upi", amount: "250.5" })).toContain("am=250.50");
  });
});
