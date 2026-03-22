import { describe, it, expect } from 'vitest';
import {
  applyCeiling,
  applySessionCap,
  blendScores,
  computeFrecency,
  computeFrecencyScores,
  normalizeFrecency,
  pruneEntries,
} from '../../src/core/frecency.js';
import type { UsageEntry } from '../../src/core/types.js';

function makeEntry(name: string, score: number, lastAccessed: Date): UsageEntry {
  const timestamp = lastAccessed.toISOString();
  return {
    name,
    score,
    lastAccessed: timestamp,
    firstAccessed: timestamp,
    accessCount: Math.max(1, Math.round(score)),
  };
}

describe('frecency', () => {
  const now = new Date('2026-03-21T12:00:00.000Z');

  describe('computeFrecency', () => {
    it('applies x4 for entries used within 1 hour', () => {
      const entry = makeEntry('recent-hour', 5, new Date('2026-03-21T11:30:00.000Z'));
      expect(computeFrecency(entry, now)).toBe(20);
    });

    it('applies x2 for entries used within 1 day', () => {
      const entry = makeEntry('recent-day', 5, new Date('2026-03-21T01:00:00.000Z'));
      expect(computeFrecency(entry, now)).toBe(10);
    });

    it('applies /2 for entries used within 1 week', () => {
      const entry = makeEntry('recent-week', 8, new Date('2026-03-18T12:00:00.000Z'));
      expect(computeFrecency(entry, now)).toBe(4);
    });

    it('applies /4 for entries older than 1 week', () => {
      const entry = makeEntry('stale', 8, new Date('2026-03-01T12:00:00.000Z'));
      expect(computeFrecency(entry, now)).toBe(2);
    });

    it('uses boundary behavior at exactly 1 hour, 1 day, and 1 week', () => {
      const atHour = makeEntry('at-hour', 4, new Date('2026-03-21T11:00:00.000Z'));
      const atDay = makeEntry('at-day', 4, new Date('2026-03-20T12:00:00.000Z'));
      const atWeek = makeEntry('at-week', 4, new Date('2026-03-14T12:00:00.000Z'));

      expect(computeFrecency(atHour, now)).toBe(8);
      expect(computeFrecency(atDay, now)).toBe(2);
      expect(computeFrecency(atWeek, now)).toBe(1);
    });
  });

  describe('computeFrecencyScores', () => {
    it('computes frecency scores for all entries', () => {
      const entries: UsageEntry[] = [
        makeEntry('alpha', 2, new Date('2026-03-21T11:30:00.000Z')),
        makeEntry('beta', 6, new Date('2026-03-19T12:00:00.000Z')),
      ];

      const scores = computeFrecencyScores(entries, now);
      expect(scores.get('alpha')).toBe(8);
      expect(scores.get('beta')).toBe(3);
    });
  });

  describe('normalizeFrecency', () => {
    it('returns empty map for empty input', () => {
      expect(normalizeFrecency(new Map())).toEqual(new Map());
    });

    it('normalizes a single positive entry to 1', () => {
      const normalized = normalizeFrecency(new Map([['only', 7]]));
      expect(normalized.get('only')).toBe(1);
    });

    it('normalizes multiple entries into 0..1 range', () => {
      const normalized = normalizeFrecency(new Map([
        ['low', 2],
        ['mid', 6],
        ['high', 10],
      ]));

      expect(normalized.get('low')).toBe(0);
      expect(normalized.get('mid')).toBe(0.5);
      expect(normalized.get('high')).toBe(1);
    });
  });

  describe('blendScores', () => {
    it('blends scores using default weight (0.3)', () => {
      const result = blendScores(0.8, 1);
      expect(result).toBeCloseTo(0.86, 6);
    });

    it('blends scores using custom weight', () => {
      const result = blendScores(0.8, 1, 0.5);
      expect(result).toBeCloseTo(0.9, 6);
    });
  });

  describe('pruneEntries', () => {
    it('removes low-score entries and preserves high-score ones after decay', () => {
      const entries: UsageEntry[] = [
        makeEntry('high', 95, new Date('2026-03-21T10:00:00.000Z')),
        makeEntry('low', 0.5, new Date('2026-03-21T10:00:00.000Z')),
      ];

      const { surviving, removed } = pruneEntries(entries, 50);
      expect(removed).toEqual(['low']);
      expect(surviving).toHaveLength(1);
      expect(surviving[0].name).toBe('high');
    });

    it('decays total to roughly 90% of threshold when pruning applies', () => {
      const entries: UsageEntry[] = [
        makeEntry('a', 5000, new Date('2026-03-21T10:00:00.000Z')),
        makeEntry('b', 4000, new Date('2026-03-21T10:00:00.000Z')),
        makeEntry('c', 3000, new Date('2026-03-21T10:00:00.000Z')),
      ];

      const threshold = 10000;
      const { surviving } = pruneEntries(entries, threshold);
      const total = surviving.reduce((sum, entry) => sum + entry.score, 0);
      expect(total).toBeCloseTo(threshold * 0.9, 6);
    });
  });

  describe('manipulation mitigations', () => {
    it('enforces session cap', () => {
      expect(applySessionCap(0, 3)).toBe(true);
      expect(applySessionCap(2, 3)).toBe(true);
      expect(applySessionCap(3, 3)).toBe(false);
    });

    it('enforces score ceiling based on percent of total', () => {
      const clamped = applyCeiling(40, 100, 20);
      expect(clamped).toBe(20);
      expect(applyCeiling(15, 100, 20)).toBe(15);
    });
  });
});
