import { operationTimeout } from '../core/errors.js';

export enum TimeoutTier {
  Local = 'local',
  CachedRemote = 'cached_remote',
  FreshRemote = 'fresh_remote',
  Bulk = 'bulk',
}

export const TIER_TIMEOUTS: Record<TimeoutTier, number> = {
  [TimeoutTier.Local]: 2000,
  [TimeoutTier.CachedRemote]: 5000,
  [TimeoutTier.FreshRemote]: 15000,
  [TimeoutTier.Bulk]: 30000,
};

export const MAX_TOOL_TIMEOUT = 60_000;

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  tier: TimeoutTier,
  operationName?: string,
): Promise<T> {
  const timeoutMs = TIER_TIMEOUTS[tier];
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      operationTimeout(operationName ?? tier, timeoutMs),
    );
  }, timeoutMs);

  try {
    const result = await operation(controller.signal);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
