import { describe, it, expect, beforeEach } from 'vitest';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { TrustLevel, type SkillLock, type SkillLockEntry } from '../../src/core/types.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';

function makeLockEntry(overrides: Partial<SkillLockEntry> = {}): SkillLockEntry {
  return {
    contentHash: 'sha256:abc123',
    scanHash: 'sha256:def456',
    scanResult: 'clean',
    scanTimestamp: '2026-03-13T10:00:00Z',
    trustLevel: TrustLevel.Verified,
    source: { type: 'git', url: 'https://github.com/org/skills.git', ref: 'abc1234' },
    ...overrides,
  };
}

describe('SkillLockManager', () => {
  let store: InMemorySkillLockStore;
  let manager: SkillLockManager;

  beforeEach(() => {
    store = new InMemorySkillLockStore();
    manager = new SkillLockManager(store, new NoopLogger());
  });

  describe('load', () => {
    it('returns empty lock when no lock file exists', async () => {
      const lock = await manager.load();
      expect(lock.skills).toEqual({});
      expect(lock.lockVersion).toBe(1);
    });

    it('returns existing lock when present', async () => {
      const existing: SkillLock = {
        lockVersion: 1,
        generatedAt: '2026-03-13T10:00:00Z',
        generatedBy: 'deft-mcp@0.1.0',
        skills: { 'tdd-python': makeLockEntry() },
      };
      store = new InMemorySkillLockStore(existing);
      manager = new SkillLockManager(store, new NoopLogger());

      const lock = await manager.load();
      expect(lock.skills['tdd-python']).toBeDefined();
    });
  });

  describe('addOrUpdate', () => {
    it('adds a new skill entry', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry());
      const lock = await manager.load();
      expect(lock.skills['tdd-python']).toBeDefined();
      expect(lock.skills['tdd-python'].contentHash).toBe('sha256:abc123');
    });

    it('updates an existing skill entry', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry());
      await manager.addOrUpdate('tdd-python', makeLockEntry({ contentHash: 'sha256:new' }));
      const lock = await manager.load();
      expect(lock.skills['tdd-python'].contentHash).toBe('sha256:new');
    });

    it('persists to store after update', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry());
      const stored = await store.load();
      expect(stored?.skills['tdd-python']).toBeDefined();
    });
  });

  describe('remove', () => {
    it('removes a skill entry', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry());
      await manager.remove('tdd-python');
      const lock = await manager.load();
      expect(lock.skills['tdd-python']).toBeUndefined();
    });

    it('no-ops on missing skill', async () => {
      await expect(manager.remove('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('verify', () => {
    it('returns match when hash matches', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry({ contentHash: 'sha256:abc' }));
      const result = await manager.verify('tdd-python', 'sha256:abc');
      expect(result.matches).toBe(true);
    });

    it('returns mismatch when hash differs', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry({ contentHash: 'sha256:abc' }));
      const result = await manager.verify('tdd-python', 'sha256:different');
      expect(result.matches).toBe(false);
      expect(result.expected).toBe('sha256:abc');
      expect(result.actual).toBe('sha256:different');
    });

    it('returns not-found for unlocked skill', async () => {
      const result = await manager.verify('unknown', 'sha256:abc');
      expect(result.matches).toBe(false);
      expect(result.expected).toBeNull();
    });

    it('works when called before any write (loads from store)', async () => {
      const existing: SkillLock = {
        lockVersion: 1,
        generatedAt: '2026-03-13T10:00:00Z',
        generatedBy: 'deft-mcp@0.1.0',
        skills: { 'tdd-python': makeLockEntry({ contentHash: 'sha256:pre-existing' }) },
      };
      const preloadedStore = new InMemorySkillLockStore(existing);
      const freshManager = new SkillLockManager(preloadedStore, new NoopLogger());

      const result = await freshManager.verify('tdd-python', 'sha256:pre-existing');
      expect(result.matches).toBe(true);
    });
  });

  describe('getEntry', () => {
    it('returns entry for locked skill', async () => {
      await manager.addOrUpdate('tdd-python', makeLockEntry());
      const entry = await manager.getEntry('tdd-python');
      expect(entry).not.toBeNull();
      expect(entry?.trustLevel).toBe(TrustLevel.Verified);
    });

    it('returns null for unlocked skill', async () => {
      expect(await manager.getEntry('unknown')).toBeNull();
    });
  });
});
