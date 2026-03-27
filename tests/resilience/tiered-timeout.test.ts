import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TimeoutTier,
  TIER_TIMEOUTS,
  withTimeout,
  MAX_TOOL_TIMEOUT,
} from '../../src/resilience/tiered-timeout.js';

describe('TimeoutTier constants', () => {
  it('defines correct timeout values', () => {
    expect(TIER_TIMEOUTS[TimeoutTier.Local]).toBe(2000);
    expect(TIER_TIMEOUTS[TimeoutTier.CachedRemote]).toBe(5000);
    expect(TIER_TIMEOUTS[TimeoutTier.FreshRemote]).toBe(15000);
    expect(TIER_TIMEOUTS[TimeoutTier.Bulk]).toBe(30000);
  });

  it('has max tool timeout of 60s', () => {
    expect(MAX_TOOL_TIMEOUT).toBe(60000);
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when operation completes before timeout', async () => {
    const op = async () => 'done';
    const result = await withTimeout(op, TimeoutTier.Local);
    expect(result).toBe('done');
  });

  it('rejects with OperationTimeout when operation exceeds timeout', async () => {
    const op = async (signal: AbortSignal) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('late'), 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      });
    };

    const promise = withTimeout(op, TimeoutTier.Local); // 2s timeout
    vi.advanceTimersByTime(2001);
    await expect(promise).rejects.toThrow('timed out');
  });

  it('passes AbortSignal to the operation', async () => {
    let receivedSignal: AbortSignal | null = null;
    const op = async (signal: AbortSignal) => {
      receivedSignal = signal;
      return 'ok';
    };
    await withTimeout(op, TimeoutTier.Local);
    expect(receivedSignal).not.toBeNull();
    expect(receivedSignal!.aborted).toBe(false);
  });
});
