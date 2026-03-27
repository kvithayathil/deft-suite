import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { SqliteUsageStore } from '../../src/adapters/driven/sqlite-usage-store.js';

describe('SqliteUsageStore', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'deft-usage-'));
    dbPath = join(testDir, 'usage.db');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('recordAccess creates a row then increments on subsequent calls', () => {
    const store = new SqliteUsageStore(dbPath);

    store.recordAccess('debugging-strategies');
    store.recordAccess('debugging-strategies');

    const [entry] = store.getRawData();
    expect(entry.name).toBe('debugging-strategies');
    expect(entry.score).toBe(2);
    expect(entry.accessCount).toBe(2);
  });

  it('getFrecencyScores returns computed frecency values', () => {
    const store = new SqliteUsageStore(dbPath);
    store.recordAccess('alpha');
    store.recordAccess('alpha');

    const scores = store.getFrecencyScores();
    expect(scores.get('alpha')).toBeGreaterThan(0);
  });

  it('recordSearch and getSearchStats round-trip correctly', () => {
    const store = new SqliteUsageStore(dbPath);

    store.recordSearch('debug', 3, 'local');
    store.recordSearch('debug', 1, 'catalog');

    const stats = store.getSearchStats();
    expect(stats.totalSearches).toBe(2);
    expect(stats.avgResultCount).toBe(2);
    expect(stats.sourceBreakdown.local).toBe(1);
    expect(stats.sourceBreakdown.catalog).toBe(1);
  });

  it('prune removes low-score entries and old search log rows', () => {
    const store = new SqliteUsageStore(dbPath);

    store.recordAccess('high');
    for (let i = 0; i < 200; i += 1) {
      store.recordAccess('anchor');
    }

    store.recordSearch('legacy', 1, 'local');
    const db = new Database(dbPath);
    db.prepare('UPDATE search_log SET searched_at = ?').run('2000-01-01T00:00:00.000Z');
    db.close();

    store.prune(100);

    const raw = store.getRawData();
    expect(raw.some((entry) => entry.name === 'high')).toBe(false);
    expect(raw.some((entry) => entry.name === 'anchor')).toBe(true);
    expect(store.getSearchStats().totalSearches).toBe(0);
  });

  it('reset clears a single skill and resetAll clears all data', () => {
    const store = new SqliteUsageStore(dbPath);
    store.recordAccess('one');
    store.recordAccess('two');
    store.recordSearch('q', 1, 'local');

    store.reset('one');
    expect(store.getRawData().map((entry) => entry.name)).toEqual(['two']);

    store.resetAll();
    expect(store.getRawData()).toEqual([]);
    expect(store.getSearchStats().totalSearches).toBe(0);
  });

  it('enables WAL journal mode', () => {
    const store = new SqliteUsageStore(dbPath);
    expect(store.getJournalMode().toLowerCase()).toBe('wal');
  });

  it('supports concurrent reads while another connection writes', () => {
    const writer = new SqliteUsageStore(dbPath);
    const reader = new SqliteUsageStore(dbPath);

    writer.recordAccess('parallel');
    const before = reader.getRawData();

    writer.recordAccess('parallel');
    const after = reader.getRawData();

    expect(before.length).toBeGreaterThan(0);
    expect(after[0].score).toBeGreaterThanOrEqual(before[0].score);
  });
});
