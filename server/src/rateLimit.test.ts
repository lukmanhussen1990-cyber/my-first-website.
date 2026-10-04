import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TokenBucketRateLimiter } from './rateLimit.js';

function createClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('TokenBucketRateLimiter', () => {
  it('allows a burst up to capacity, then denies', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 3, windowMs: 3_000, now: clock.now });

    assert.deepEqual(
      [1, 2, 3].map(() => limiter.take('ip').remaining),
      [2, 1, 0],
    );
    const denied = limiter.take('ip');
    assert.equal(denied.allowed, false);
    assert.equal(denied.remaining, 0);
    assert.equal(denied.limit, 3);
    // One token refills every windowMs / capacity = 1000 ms.
    assert.equal(denied.retryAfterMs, 1_000);
  });

  it('refills continuously over time', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 20, windowMs: 5 * 60_000, now: clock.now });
    for (let i = 0; i < 20; i += 1) assert.equal(limiter.take('ip').allowed, true);
    assert.equal(limiter.take('ip').allowed, false);

    // 20 per 5 minutes = one every 15 s.
    clock.advance(14_999);
    const stillDenied = limiter.take('ip');
    assert.equal(stillDenied.allowed, false);
    assert.equal(stillDenied.retryAfterMs, 1);

    clock.advance(1);
    assert.equal(limiter.take('ip').allowed, true);
    assert.equal(limiter.take('ip').allowed, false);
  });

  it('caps refilled tokens at capacity after a long idle period', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 2, windowMs: 1_000, now: clock.now });
    limiter.take('ip');
    clock.advance(60 * 60_000);
    assert.equal(limiter.take('ip').remaining, 1);
    assert.equal(limiter.take('ip').remaining, 0);
    assert.equal(limiter.take('ip').allowed, false);
  });

  it('tracks keys independently', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 1, windowMs: 1_000, now: clock.now });
    assert.equal(limiter.take('a').allowed, true);
    assert.equal(limiter.take('a').allowed, false);
    assert.equal(limiter.take('b').allowed, true);
  });

  it('ignores a clock that steps backwards', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 1, windowMs: 1_000, now: clock.now });
    limiter.take('ip');
    clock.advance(-10_000);
    assert.equal(limiter.take('ip').allowed, false);
    clock.advance(10_000 + 1_000);
    assert.equal(limiter.take('ip').allowed, true);
  });

  it('sweeps buckets that have fully refilled', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 2, windowMs: 1_000, now: clock.now });
    limiter.take('idle');
    clock.advance(400);
    limiter.take('busy');
    limiter.take('busy');
    assert.equal(limiter.size, 2);

    clock.advance(200); // 'idle' has refilled (0.6 s elapsed >= 0.5 s needed); 'busy' has not.
    assert.equal(limiter.sweep(), 1);
    assert.equal(limiter.size, 1);
    assert.equal(limiter.take('busy').allowed, false);
  });

  it('evicts the least recently used key beyond maxKeys', () => {
    const clock = createClock();
    const limiter = new TokenBucketRateLimiter({ capacity: 1, windowMs: 60_000, maxKeys: 2, now: clock.now });
    limiter.take('a');
    limiter.take('b');
    limiter.take('a'); // touch 'a' so 'b' becomes least recently used
    limiter.take('c');
    assert.equal(limiter.size, 2);
    // 'a' kept its (empty) bucket; 'b' was evicted and starts fresh.
    assert.equal(limiter.take('a').allowed, false);
    assert.equal(limiter.take('b').allowed, true);
  });

  it('rejects invalid options', () => {
    assert.throws(() => new TokenBucketRateLimiter({ capacity: 0, windowMs: 1_000 }), RangeError);
    assert.throws(() => new TokenBucketRateLimiter({ capacity: 1, windowMs: 0 }), RangeError);
  });
});
