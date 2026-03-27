import { describe, expect, it } from 'vitest';
import { InMemoryUsageStore } from './in-memory-usage-store.js';

describe('InMemoryUsageStore', () => {
  it('tracks access and updates usage stats', () => {
    const store = new InMemoryUsageStore();

    store.recordAccess('alpha');
    store.recordAccess('alpha');
    store.recordAccess('beta');

    const stats = store.getStats();
    expect(stats.totalSkills).toBe(2);
    expect(stats.totalScore).toBe(3);
    expect(stats.topSkills[0].name).toBe('alpha');
    expect(stats.topSkills[0].accessCount).toBe(2);
  });

  it('tracks search stats and source breakdown', () => {
    const store = new InMemoryUsageStore();

    store.recordSearch('query-1', 2, 'local');
    store.recordSearch('query-2', 4, 'catalog');
    store.recordSearch('query-3', 0, 'local');

    const searchStats = store.getSearchStats();
    expect(searchStats.totalSearches).toBe(3);
    expect(searchStats.avgResultCount).toBe(2);
    expect(searchStats.sourceBreakdown.local).toBe(2);
    expect(searchStats.sourceBreakdown.catalog).toBe(1);
  });

  it('prunes low-score entries using core frecency prune logic', () => {
    const store = new InMemoryUsageStore();

    for (let i = 0; i < 200; i += 1) {
      store.recordAccess('anchor');
    }
    store.recordAccess('low');

    store.prune(100);

    const names = store.getRawData().map((entry) => entry.name);
    expect(names).toContain('anchor');
    expect(names).not.toContain('low');
  });

  it('supports reset and resetAll', () => {
    const store = new InMemoryUsageStore();

    store.recordAccess('one');
    store.recordAccess('two');
    store.recordSearch('x', 1, 'local');

    store.reset('one');
    expect(store.getRawData().map((entry) => entry.name)).toEqual(['two']);

    store.resetAll();
    expect(store.getRawData()).toEqual([]);
    expect(store.getSearchStats().totalSearches).toBe(0);
  });
});
