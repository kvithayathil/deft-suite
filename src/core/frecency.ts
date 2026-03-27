import type { UsageEntry } from './types.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export function computeFrecency(entry: UsageEntry, now: Date = new Date()): number {
  const lastAccessedMs = new Date(entry.lastAccessed).getTime();
  if (!Number.isFinite(lastAccessedMs)) {
    return entry.score / 4;
  }

  const elapsedMs = now.getTime() - lastAccessedMs;

  if (elapsedMs < HOUR_MS) {
    return entry.score * 4;
  }
  if (elapsedMs < DAY_MS) {
    return entry.score * 2;
  }
  if (elapsedMs < WEEK_MS) {
    return entry.score / 2;
  }
  return entry.score / 4;
}

export function computeFrecencyScores(
  entries: UsageEntry[],
  now: Date = new Date(),
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const entry of entries) {
    scores.set(entry.name, computeFrecency(entry, now));
  }
  return scores;
}

export function normalizeFrecency(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) {
    return new Map<string, number>();
  }

  const values = [...scores.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    const normalized = new Map<string, number>();
    for (const [name, score] of scores.entries()) {
      normalized.set(name, score > 0 ? 1 : 0);
    }
    return normalized;
  }

  const normalized = new Map<string, number>();
  for (const [name, score] of scores.entries()) {
    normalized.set(name, (score - min) / range);
  }
  return normalized;
}

export function blendScores(keywordScore: number, frecency: number, weight: number = 0.3): number {
  const clampedWeight = Math.max(0, Math.min(1, weight));
  return keywordScore * (1 - clampedWeight) + frecency * clampedWeight;
}

export function pruneEntries(
  entries: UsageEntry[],
  threshold: number,
): { surviving: UsageEntry[]; removed: string[] } {
  const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
  if (threshold <= 0 || totalScore <= threshold) {
    return {
      surviving: [...entries],
      removed: [],
    };
  }

  const decayFactor = totalScore / (threshold * 0.9);
  const surviving: UsageEntry[] = [];
  const removed: string[] = [];

  for (const entry of entries) {
    const nextScore = entry.score / decayFactor;
    if (nextScore < 1) {
      removed.push(entry.name);
      continue;
    }
    surviving.push({
      ...entry,
      score: nextScore,
    });
  }

  return { surviving, removed };
}

export function applySessionCap(currentBumps: number, cap: number): boolean {
  return currentBumps < cap;
}

export function applyCeiling(
  entryScore: number,
  totalScore: number,
  ceilingPercent: number,
): number {
  if (totalScore <= 0) {
    return entryScore;
  }
  const maxAllowed = totalScore * (Math.max(0, ceilingPercent) / 100);
  return Math.min(entryScore, maxAllowed);
}
