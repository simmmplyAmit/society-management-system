// Login throttle: MAX_ATTEMPTS failures per account within WINDOW_MS, counted from the first failure.
//
// With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, the count lives in Upstash Redis,
// so the limit holds across serverless instances. Without them (development, tests), or if
// Upstash can't be reached, it falls back to a per-instance in-memory count rather than no limit.
// Keys are SHA-256 hashes of the normalised email, so the store never holds email addresses.
export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
const UPSTASH_TIMEOUT_MS = 1500;

const attempts = new Map<string, { count: number; first: number }>();

const norm = (key: string) => key.trim().toLowerCase();

// ─────────────────────────────────────────────
// In-memory fallback (also what tests exercise through the `now` argument)
// ─────────────────────────────────────────────

function memIsLimited(k: string, now: number): boolean {
  const entry = attempts.get(k);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    attempts.delete(k);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function memRecord(k: string, now: number): void {
  const entry = attempts.get(k);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(k, { count: 1, first: now });
  else entry.count += 1;
}

// ─────────────────────────────────────────────
// Upstash Redis over its REST API (no client library needed)
// ─────────────────────────────────────────────

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisKey(k: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `login-fail:${hex}`;
}

/** Runs commands in one pipeline request. Returns null on any failure so callers fall back to memory. */
async function pipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  const cfg = upstash();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const body = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = body.find((r) => r.error);
    if (failed) throw new Error(failed.error);
    return body.map((r) => r.result);
  } catch (err) {
    console.error("[rate-limit] Upstash unavailable, using in-memory limit:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export async function isRateLimited(key: string, now = Date.now()): Promise<boolean> {
  const k = norm(key);
  const r = await pipeline([["GET", await redisKey(k)]]);
  if (r) return Number(r[0] ?? 0) >= MAX_ATTEMPTS;
  return memIsLimited(k, now);
}

export async function recordFailure(key: string, now = Date.now()): Promise<void> {
  const k = norm(key);
  const rk = await redisKey(k);
  // NX: the window starts at the first failure and is not extended by later ones
  const r = await pipeline([["INCR", rk], ["PEXPIRE", rk, WINDOW_MS, "NX"]]);
  if (!r) memRecord(k, now);
}

export async function resetAttempts(key: string): Promise<void> {
  const k = norm(key);
  attempts.delete(k);
  await pipeline([["DEL", await redisKey(k)]]);
}

export function clearAllAttempts(): void {
  attempts.clear();
}
