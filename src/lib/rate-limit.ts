type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    return false;
  }

  return limit <= entry.count;
}

export function recordFailedAttempt(key: string, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    cleanupExpiredAttempts(now);
    return;
  }

  entry.count += 1;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

function cleanupExpiredAttempts(now: number) {
  for (const [key, entry] of Array.from(attempts.entries())) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}
