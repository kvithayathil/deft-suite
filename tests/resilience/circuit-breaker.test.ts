import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../src/resilience/circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('stays closed on success', () => {
    const cb = new CircuitBreaker();
    cb.recordSuccess();
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('opens after consecutive failures reach threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Closed);
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Open);
  });

  it('resets failure count on success', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess(); // Reset
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Closed); // Only 1 consecutive
  });

  it('transitions to half-open after cooldown', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Open);

    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe(CircuitState.HalfOpen);
  });

  it('closes on success in half-open state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe(CircuitState.HalfOpen);

    cb.recordSuccess();
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('re-opens on failure in half-open state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(5000);

    cb.recordFailure(); // Fail in half-open
    expect(cb.getState()).toBe(CircuitState.Open);
  });

  it('isAllowed returns false when open', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.isAllowed()).toBe(false);
  });

  it('isAllowed returns true when closed', () => {
    const cb = new CircuitBreaker();
    expect(cb.isAllowed()).toBe(true);
  });

  it('isAllowed returns true when half-open (test request)', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    cb.recordFailure();
    vi.advanceTimersByTime(1000);
    expect(cb.isAllowed()).toBe(true);
  });

  it('reset() returns open breaker to closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Open);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.Closed);
    expect(cb.isAllowed()).toBe(true);
  });

  it('reset() clears failure count so threshold is fresh', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.reset();

    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('respects custom cooldownMs option', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000 });
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.Open);

    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe(CircuitState.Open);

    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe(CircuitState.HalfOpen);
  });
});
