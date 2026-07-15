/**
 * Rate limiter en memoria (por instancia Node).
 * Suficiente para un solo proceso Next.js; en multi-réplica conviene Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: opts.limit - existing.count,
    retryAfterSec: 0,
  };
}

/** Limpieza ocasional de buckets vencidos (evita crecimiento indefinido). */
export function pruneRateLimitBuckets(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
