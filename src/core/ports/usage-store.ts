import type { SearchStats, UsageEntry, UsageStats } from '../types.js';

export interface UsageStore {
  recordAccess(name: string): void;
  getFrecencyScores(): Map<string, number>;
  getStats(): UsageStats;
  getSearchStats(): SearchStats;
  recordSearch(query: string, resultCount: number, source: string): void;
  prune(threshold: number): void;
  reset(name: string): void;
  resetAll(): void;
  getRawData(): UsageEntry[];
}
