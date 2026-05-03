// Simple in-memory login throttle (per server instance).
// Good enough to blunt brute force on a single node; use a shared store
// (Redis/Upstash) if you run many serverless instances.
export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; first: number }>();

const norm = (key: string) => key.trim().toLowerCase();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const entry = attempts.get(norm(key));
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    attempts.delete(norm(key));
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string, now = Date.now()): void {
  const k = norm(key);
  const entry = attempts.get(k);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(k, { count: 1, first: now });
  } else {
    entry.count += 1;
  }
}

export function resetAttempts(key: string): void {
  attempts.delete(norm(key));
}

export function clearAllAttempts(): void {
  attempts.clear();
}
