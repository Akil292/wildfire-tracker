type RateLimitEntry = { attempts: number; resetAt: number };

const attempts = new Map<string, RateLimitEntry>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string, now = Date.now()): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    return false;
  }
  return entry.attempts >= MAX_ATTEMPTS;
}

export function recordAttempt(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.attempts += 1;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
