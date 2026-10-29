import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isRateLimited, recordFailure, resetAttempts, clearAllAttempts, MAX_ATTEMPTS, WINDOW_MS,
} from "@/lib/rate-limit";

const fail = async (key: string, times: number, now: number) => {
  for (let i = 0; i < times; i++) await recordFailure(key, now);
};

describe("login rate limit (in-memory fallback)", () => {
  beforeEach(() => clearAllAttempts());

  it("allows attempts below the limit", async () => {
    await fail("a@x.com", MAX_ATTEMPTS - 1, 0);
    expect(await isRateLimited("a@x.com", 1)).toBe(false);
  });

  it("blocks once the limit is reached", async () => {
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    expect(await isRateLimited("a@x.com", 1)).toBe(true);
  });

  it("is case- and whitespace-insensitive", async () => {
    await fail("  A@X.com ", MAX_ATTEMPTS, 0);
    expect(await isRateLimited("a@x.com", 1)).toBe(true);
  });

  it("does not affect other accounts", async () => {
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    expect(await isRateLimited("b@x.com", 1)).toBe(false);
  });

  it("unblocks after the window expires", async () => {
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    expect(await isRateLimited("a@x.com", WINDOW_MS + 1)).toBe(false);
  });

  it("starts a fresh window for failures after expiry", async () => {
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    await recordFailure("a@x.com", WINDOW_MS + 10);
    expect(await isRateLimited("a@x.com", WINDOW_MS + 11)).toBe(false);
  });

  it("resets on successful login", async () => {
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    await resetAttempts("a@x.com");
    expect(await isRateLimited("a@x.com", 1)).toBe(false);
  });
});

describe("login rate limit (Upstash)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearAllAttempts();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const reply = (...results: unknown[]) => ({ ok: true, json: async () => results.map((result) => ({ result })) });
  const body = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body as string) as (string | number)[][];

  it("counts failures in Redis with a window that starts at the first failure", async () => {
    fetchMock.mockResolvedValue(reply(1, 1));
    await recordFailure(" A@X.com ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    const [[incr, key], expire] = body(0);
    expect(incr).toBe("INCR");
    expect(expire).toEqual(["PEXPIRE", key, WINDOW_MS, "NX"]);
  });

  it("never sends the email itself, only a hash that is the same for any casing", async () => {
    fetchMock.mockResolvedValue(reply(1, 1));
    await recordFailure("A@X.com");
    await recordFailure("a@x.com");
    const [k1, k2] = [body(0)[0][1], body(1)[0][1]];
    expect(k1).toBe(k2);
    expect(String(k1)).toMatch(/^login-fail:[0-9a-f]{64}$/);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("a@x.com");
  });

  it("blocks when the shared count reaches the limit", async () => {
    fetchMock.mockResolvedValueOnce(reply(String(MAX_ATTEMPTS)));
    expect(await isRateLimited("a@x.com")).toBe(true);
    fetchMock.mockResolvedValueOnce(reply(null));
    expect(await isRateLimited("a@x.com")).toBe(false);
  });

  it("clears the shared count on a successful login", async () => {
    fetchMock.mockResolvedValue(reply(1));
    await resetAttempts("a@x.com");
    expect(body(0)[0][0]).toBe("DEL");
  });

  it("falls back to the in-memory limit when Upstash fails", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    await fail("a@x.com", MAX_ATTEMPTS, 0);
    expect(await isRateLimited("a@x.com", 1)).toBe(true);

    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ error: "ERR wrong type" }] });
    expect(await isRateLimited("b@x.com", 1)).toBe(false);
  });
});
