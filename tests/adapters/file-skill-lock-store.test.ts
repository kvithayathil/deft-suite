import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSkillLockStore } from '../../src/adapters/driven/file-skill-lock-store.js';

describe('FileSkillLockStore', () => {
  let testDir: string;
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'deft-lock-'));
  });
  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns null when no lock file exists', async () => {
    const store = new FileSkillLockStore(join(testDir, 'skill-lock.json'));
    expect(await store.load()).toBeNull();
  });

  it('loads existing lock file', async () => {
    const p = join(testDir, 'skill-lock.json');
    await writeFile(
      p,
      JSON.stringify({ lockVersion: 1, generatedAt: '', generatedBy: '', skills: {} }),
    );
    const store = new FileSkillLockStore(p);
    const lock = await store.load();
    expect(lock?.lockVersion).toBe(1);
  });

  it('saves and reads back', async () => {
    const p = join(testDir, 'skill-lock.json');
    const store = new FileSkillLockStore(p);
    await store.save({
      lockVersion: 1,
      generatedAt: '2026-03-13',
      generatedBy: 'test',
      skills: {},
    });
    const lock = await store.load();
    expect(lock?.generatedBy).toBe('test');
  });

  it('exists returns correct value', async () => {
    const p = join(testDir, 'skill-lock.json');
    const store = new FileSkillLockStore(p);
    expect(await store.exists()).toBe(false);
    await store.save({ lockVersion: 1, generatedAt: '', generatedBy: '', skills: {} });
    expect(await store.exists()).toBe(true);
  });

  it('getPath returns file path', () => {
    const p = join(testDir, 'skill-lock.json');
    expect(new FileSkillLockStore(p).getPath()).toBe(p);
  });
});
