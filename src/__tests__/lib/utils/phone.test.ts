import { describe, it, expect } from "vitest";
import { normalizePhone, maskPhone, maskEmail } from "@/lib/utils/phone";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("accepts %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(["", "12345", "5876543210", "98765432101", "abcdefghij", "+1 415 555 0100"])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull()
  );
});

describe("masking", () => {
  it("hides the middle of a phone number and email", () => {
    expect(maskPhone("+919876543210")).toBe("+91 98••••••10");
    expect(maskEmail("rahul@example.com")).toBe("ra•••@example.com");
    expect(maskEmail("a@x.com")).toBe("a•@x.com");
  });
});
