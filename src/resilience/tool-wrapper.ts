import { TokenBucket } from './token-bucket.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { withTimeout, TimeoutTier } from './tiered-timeout.js';
import { rateLimited, networkUnavailable } from '../core/errors.js';

export interface ResilienceContext {
  rateLimiters: Map<string, TokenBucket>;
  circuitBreakers: Map<string, CircuitBreaker>;
}

export interface ResilienceOptions {
  rateLimitKey?: string;
  circuitBreakerKey?: string;
}

export async function withToolResilience<T>(
  toolName: string,
  tier: TimeoutTier,
  resilience: ResilienceContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  options?: ResilienceOptions,
): Promise<T> {
  if (options?.rateLimitKey) {
    const bucket = resilience.rateLimiters.get(options.rateLimitKey);
    if (bucket && !bucket.tryConsume()) {
      throw rateLimited(toolName, bucket.msUntilNextToken());
    }
  }

  if (options?.circuitBreakerKey) {
    const breaker = resilience.circuitBreakers.get(options.circuitBreakerKey);
    if (breaker && !breaker.isAllowed()) {
      throw networkUnavailable(
        options.circuitBreakerKey,
        'Circuit breaker is open — source is temporarily unavailable',
      );
    }
  }

  try {
    const result = await withTimeout(
      async (signal) => operation(signal),
      tier,
      toolName,
    );

    if (options?.circuitBreakerKey) {
      const breaker = resilience.circuitBreakers.get(options.circuitBreakerKey);
      breaker?.recordSuccess();
    }

    return result;
  } catch (error) {
    if (options?.circuitBreakerKey) {
      const breaker = resilience.circuitBreakers.get(options.circuitBreakerKey);
      breaker?.recordFailure();
    }
    throw error;
  }
}
