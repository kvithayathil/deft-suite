import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { computeFrecencyScores, pruneEntries } from '../../core/frecency.js';
import type { UsageStore } from '../../core/ports/usage-store.js';
import type { SearchStats, UsageEntry, UsageStats } from '../../core/types.js';

interface UsageEntryRow {
  name: string;
  score: number;
  first_accessed: string;
  last_accessed: string;
  access_count: number;
}

interface SearchStatsRow {
  total_searches: number;
  avg_result_count: number | null;
}

interface SourceBreakdownRow {
  source: string;
  count: number;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export class SqliteUsageStore implements UsageStore {
  private readonly db: Database.Database;

  constructor(private readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  recordAccess(name: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO usage_entries (name, score, first_accessed, last_accessed, access_count)
       VALUES (?, 1, ?, ?, 1)
       ON CONFLICT(name) DO UPDATE SET
         score = usage_entries.score + 1,
         last_accessed = excluded.last_accessed,
         access_count = usage_entries.access_count + 1`,
    ).run(name, now, now);
  }

  getFrecencyScores(): Map<string, number> {
    return computeFrecencyScores(this.getRawData());
  }

  getStats(): UsageStats {
    const totals = this.db.prepare(
      'SELECT COUNT(*) AS total_skills, COALESCE(SUM(score), 0) AS total_score FROM usage_entries',
    ).get() as { total_skills: number; total_score: number };

    const topRows = this.db.prepare(
      `SELECT name, score, first_accessed, last_accessed, access_count
       FROM usage_entries
       ORDER BY score DESC
       LIMIT 10`,
    ).all() as UsageEntryRow[];

    return {
      totalSkills: totals.total_skills,
      totalScore: totals.total_score,
      topSkills: topRows.map(this.mapUsageEntry),
      dbSizeBytes: existsSync(this.dbPath) ? statSync(this.dbPath).size : undefined,
    };
  }

  getSearchStats(): SearchStats {
    const aggregate = this.db.prepare(
      `SELECT COUNT(*) AS total_searches,
              AVG(result_count) AS avg_result_count
       FROM search_log`,
    ).get() as SearchStatsRow;

    const rows = this.db.prepare(
      `SELECT source, COUNT(*) AS count
       FROM search_log
       GROUP BY source`,
    ).all() as SourceBreakdownRow[];

    const sourceBreakdown: Record<string, number> = {};
    for (const row of rows) {
      sourceBreakdown[row.source] = row.count;
    }

    return {
      totalSearches: aggregate.total_searches,
      avgResultCount: aggregate.avg_result_count ?? 0,
      sourceBreakdown,
    };
  }

  recordSearch(query: string, resultCount: number, source: string): void {
    this.db.prepare(
      `INSERT INTO search_log (query, result_count, source, searched_at)
       VALUES (?, ?, ?, ?)`,
    ).run(query, resultCount, source, new Date().toISOString());
  }

  prune(threshold: number): void {
    const { surviving, removed } = pruneEntries(this.getRawData(), threshold);
    const updateStmt = this.db.prepare('UPDATE usage_entries SET score = ? WHERE name = ?');
    const deleteStmt = this.db.prepare('DELETE FROM usage_entries WHERE name = ?');
    const deleteOldSearchLogStmt = this.db.prepare('DELETE FROM search_log WHERE searched_at < ?');
    const cutoff = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

    this.db.transaction(() => {
      for (const entry of surviving) {
        updateStmt.run(entry.score, entry.name);
      }
      for (const name of removed) {
        deleteStmt.run(name);
      }
      deleteOldSearchLogStmt.run(cutoff);
    })();
  }

  reset(name: string): void {
    this.db.prepare('DELETE FROM usage_entries WHERE name = ?').run(name);
  }

  resetAll(): void {
    this.db.prepare('DELETE FROM usage_entries').run();
    this.db.prepare('DELETE FROM search_log').run();
  }

  getRawData(): UsageEntry[] {
    const rows = this.db.prepare(
      `SELECT name, score, first_accessed, last_accessed, access_count
       FROM usage_entries`,
    ).all() as UsageEntryRow[];

    return rows.map(this.mapUsageEntry);
  }

  getJournalMode(): string {
    const row = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string };
    return row.journal_mode ?? '';
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_entries (
        name TEXT PRIMARY KEY,
        score REAL NOT NULL,
        first_accessed TEXT NOT NULL,
        last_accessed TEXT NOT NULL,
        access_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS search_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        result_count INTEGER NOT NULL,
        source TEXT NOT NULL,
        searched_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_search_log_searched_at ON search_log(searched_at);
      CREATE INDEX IF NOT EXISTS idx_search_log_source ON search_log(source);
    `);
  }

  private mapUsageEntry(row: UsageEntryRow): UsageEntry {
    return {
      name: row.name,
      score: row.score,
      firstAccessed: row.first_accessed,
      lastAccessed: row.last_accessed,
      accessCount: row.access_count,
    };
  }
}
