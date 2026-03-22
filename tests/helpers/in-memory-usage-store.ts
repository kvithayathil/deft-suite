import { computeFrecencyScores, pruneEntries } from '../../src/core/frecency.js';
import type { UsageStore } from '../../src/core/ports/usage-store.js';
import type { SearchStats, UsageEntry, UsageStats } from '../../src/core/types.js';

interface SearchLogEntry {
  query: string;
  resultCount: number;
  source: string;
  searchedAt: string;
}

export class InMemoryUsageStore implements UsageStore {
  private readonly usage = new Map<string, UsageEntry>();
  private readonly searchLog: SearchLogEntry[] = [];

  constructor(initialEntries: UsageEntry[] = []) {
    for (const entry of initialEntries) {
      this.usage.set(entry.name, { ...entry });
    }
  }

  recordAccess(name: string): void {
    const now = new Date().toISOString();
    const existing = this.usage.get(name);

    if (!existing) {
      this.usage.set(name, {
        name,
        score: 1,
        firstAccessed: now,
        lastAccessed: now,
        accessCount: 1,
      });
      return;
    }

    this.usage.set(name, {
      ...existing,
      score: existing.score + 1,
      lastAccessed: now,
      accessCount: existing.accessCount + 1,
    });
  }

  getFrecencyScores(): Map<string, number> {
    return computeFrecencyScores(this.getRawData());
  }

  getStats(): UsageStats {
    const entries = this.getRawData().sort((a, b) => b.score - a.score);
    const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);

    return {
      totalSkills: entries.length,
      totalScore,
      topSkills: entries.slice(0, 10),
    };
  }

  getSearchStats(): SearchStats {
    const sourceBreakdown: Record<string, number> = {};
    for (const item of this.searchLog) {
      sourceBreakdown[item.source] = (sourceBreakdown[item.source] ?? 0) + 1;
    }

    const totalSearches = this.searchLog.length;
    const avgResultCount = totalSearches === 0
      ? 0
      : this.searchLog.reduce((sum, item) => sum + item.resultCount, 0) / totalSearches;

    return { totalSearches, avgResultCount, sourceBreakdown };
  }

  recordSearch(query: string, resultCount: number, source: string): void {
    this.searchLog.push({ query, resultCount, source, searchedAt: new Date().toISOString() });
  }

  prune(threshold: number): void {
    const { surviving } = pruneEntries(this.getRawData(), threshold);
    this.usage.clear();
    for (const entry of surviving) {
      this.usage.set(entry.name, entry);
    }

    const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const retained = this.searchLog.filter(item => new Date(item.searchedAt).getTime() >= cutoff);
    this.searchLog.length = 0;
    this.searchLog.push(...retained);
  }

  reset(name: string): void {
    this.usage.delete(name);
  }

  resetAll(): void {
    this.usage.clear();
    this.searchLog.length = 0;
  }

  getRawData(): UsageEntry[] {
    return [...this.usage.values()].map(entry => ({ ...entry }));
  }
}
