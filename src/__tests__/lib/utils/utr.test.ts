import { describe, it, expect } from "vitest";
import { normalizeUtr } from "@/lib/utils/utr";

describe("normalizeUtr", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeUtr(" 4123 4567 8901 ")).toBe("412345678901");
    expect(normalizeUtr("abc12345xyz")).toBe("ABC12345XYZ");
  });
  it.each(["", "1234567", "12345678901234567890123", "1234-5678-9012", "abc 12$45678"])("rejects %s", (v) =>
    expect(normalizeUtr(v)).toBeNull()
  );
});
