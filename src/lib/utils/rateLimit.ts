/**
 * In-memory sliding-window rate limiter, shared by the login action and the
 * public contact endpoint (section 37).
 *
 * Deliberately simple (KISS): a single Node process is all Rejoice needs. If the
 * site is ever scaled to multiple instances, swap the Map for Redis here — every
 * caller goes through this one function.
 */
const buckets = new Map<string, number[]>();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    const retryAfterMs = hits[0] + windowMs - now;
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the Map cannot grow without bound.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - hits.length, retryAfterMs: 0 };
}

export function resetRateLimit(key?: string) {
  if (key) buckets.delete(key);
  else buckets.clear();
}

/** Best-effort client IP from proxy headers. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
