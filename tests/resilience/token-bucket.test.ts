import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucket } from '../../src/resilience/token-bucket.js';

describe('TokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to bucket size', () => {
    const bucket = new TokenBucket(3, 3); // 3 tokens, 3/min refill
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
  });

  it('rejects requests when empty', () => {
    const bucket = new TokenBucket(2, 2);
    bucket.tryConsume();
    bucket.tryConsume();
    expect(bucket.tryConsume()).toBe(false);
  });

  it('refills tokens over time', () => {
    const bucket = new TokenBucket(2, 2); // 2/min = 1 token per 30s
    bucket.tryConsume();
    bucket.tryConsume();
    expect(bucket.tryConsume()).toBe(false);

    vi.advanceTimersByTime(30_000); // 30 seconds = 1 token refilled
    expect(bucket.tryConsume()).toBe(true);
  });

  it('does not exceed bucket size on refill', () => {
    const bucket = new TokenBucket(2, 2);
    vi.advanceTimersByTime(120_000); // 2 minutes — would refill 4, but capped at 2
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it('returns msUntilNext when empty', () => {
    const bucket = new TokenBucket(1, 60); // 60/min = 1 per second
    bucket.tryConsume();
    const ms = bucket.msUntilNextToken();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(1000);
  });

  it('returns 0 msUntilNext when tokens available', () => {
    const bucket = new TokenBucket(5, 5);
    expect(bucket.msUntilNextToken()).toBe(0);
  });
});
