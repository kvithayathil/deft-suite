import { describe, it, expect } from 'vitest';
import { withToolResilience, type ResilienceContext } from '../../src/resilience/tool-wrapper.js';
import { TokenBucket } from '../../src/resilience/token-bucket.js';
import { CircuitBreaker } from '../../src/resilience/circuit-breaker.js';
import { TimeoutTier } from '../../src/resilience/tiered-timeout.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';

describe('withToolResilience', () => {
  function makeResilience(): ResilienceContext {
    return {
      rateLimiters: new Map([['test_tool', new TokenBucket(2, 120)]]),
      circuitBreakers: new Map([['remote-source', new CircuitBreaker()]]),
    };
  }

  it('passes through for local operations without rate limiting', async () => {
    const resilience = makeResilience();
    const result = await withToolResilience(
      'test_tool',
      TimeoutTier.Local,
      resilience,
      async () => 'ok',
    );
    expect(result).toBe('ok');
  });

  it('rejects when rate limit exhausted', async () => {
    const resilience = makeResilience();
    const bucket = resilience.rateLimiters.get('test_tool')!;
    bucket.tryConsume();
    bucket.tryConsume();

    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.FreshRemote,
      resilience,
      async () => 'ok',
      { rateLimitKey: 'test_tool' },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.RateLimited);
  });

  it('rejects when circuit breaker is open', async () => {
    const resilience = makeResilience();
    const breaker = resilience.circuitBreakers.get('remote-source')!;
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.FreshRemote,
      resilience,
      async () => 'ok',
      { circuitBreakerKey: 'remote-source' },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.NetworkUnavailable);
  });

  it('wraps operation with timeout', async () => {
    const resilience = makeResilience();
    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.Local,
      resilience,
      async (signal) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          reject(signal.reason);
        });
      }),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.OperationTimeout);
  }, 10000);
});
