import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited, recordFailure, resetAttempts, clearAllAttempts, MAX_ATTEMPTS, WINDOW_MS,
} from "@/lib/rate-limit";

describe("login rate limit", () => {
  beforeEach(() => clearAllAttempts());

  it("allows attempts below the limit", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailure("a@x.com", 0);
    expect(isRateLimited("a@x.com", 1)).toBe(false);
  });

  it("blocks once the limit is reached", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("a@x.com", 0);
    expect(isRateLimited("a@x.com", 1)).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("  A@X.com ", 0);
    expect(isRateLimited("a@x.com", 1)).toBe(true);
  });

  it("does not affect other accounts", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("a@x.com", 0);
    expect(isRateLimited("b@x.com", 1)).toBe(false);
  });

  it("unblocks after the window expires", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("a@x.com", 0);
    expect(isRateLimited("a@x.com", WINDOW_MS + 1)).toBe(false);
  });

  it("starts a fresh window for failures after expiry", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("a@x.com", 0);
    recordFailure("a@x.com", WINDOW_MS + 10);
    expect(isRateLimited("a@x.com", WINDOW_MS + 11)).toBe(false);
  });

  it("resets on successful login", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("a@x.com", 0);
    resetAttempts("a@x.com");
    expect(isRateLimited("a@x.com", 1)).toBe(false);
  });
});
