export interface RateLimitDecision {
  allowed: boolean;
  /** Bucket size (requests per window). */
  limit: number;
  /** Whole requests left after this one. */
  remaining: number;
  /** When denied: ms until one request is available again; otherwise 0. */
  retryAfterMs: number;
}

export interface TokenBucketOptions {
  /** Requests allowed per window; also the burst size. */
  capacity: number;
  /** Time for an empty bucket to refill completely. */
  windowMs: number;
  /** Upper bound on tracked keys so a flood of addresses can't exhaust memory. */
  maxKeys?: number;
  now?: () => number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * In-memory token bucket keyed by client (IP). Each key starts full with
 * `capacity` tokens which refill continuously at `capacity / windowMs`.
 * State is per process — run one instance, or put a shared limiter in front.
 */
export class TokenBucketRateLimiter {
  readonly capacity: number;
  readonly windowMs: number;
  private readonly refillPerMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  // Map iteration order = insertion order; `take` re-inserts, so the first key is the least recently used.
  private readonly buckets = new Map<string, Bucket>();

  constructor({ capacity, windowMs, maxKeys = 50_000, now = Date.now }: TokenBucketOptions) {
    if (!Number.isFinite(capacity) || capacity < 1) throw new RangeError('capacity must be >= 1');
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be > 0');
    this.capacity = capacity;
    this.windowMs = windowMs;
    this.refillPerMs = capacity / windowMs;
    this.maxKeys = Math.max(1, maxKeys);
    this.now = now;
  }

  /** Consumes one token for `key` if available. */
  take(key: string): RateLimitDecision {
    const now = this.now();
    const bucket = this.refill(key, now);
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    this.evictOverflow();

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, limit: this.capacity, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }
    return {
      allowed: false,
      limit: this.capacity,
      remaining: 0,
      retryAfterMs: Math.ceil((1 - bucket.tokens) / this.refillPerMs),
    };
  }

  /** Drops buckets that have refilled completely (they behave exactly like new ones). Returns how many were removed. */
  sweep(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs >= this.capacity) {
        this.buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.buckets.size;
  }

  private refill(key: string, now: number): Bucket {
    const existing = this.buckets.get(key);
    if (!existing) return { tokens: this.capacity, updatedAt: now };
    // Clamp elapsed time so a clock that steps backwards never drains a bucket.
    const elapsed = Math.max(0, now - existing.updatedAt);
    return {
      tokens: Math.min(this.capacity, existing.tokens + elapsed * this.refillPerMs),
      updatedAt: now,
    };
  }

  private evictOverflow(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) return;
      this.buckets.delete(oldest.value);
    }
  }
}
