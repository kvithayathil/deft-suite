import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { GitCatalogStore } from '../../src/adapters/driven/git-catalog-store.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../src/core/types.js';

describe('GitCatalogStore', () => {
  const source: CatalogSourceConfig = {
    type: 'git',
    url: 'https://github.com/acme/skill-catalog.git',
  };

  const catalog: CatalogEntry = {
    name: 'acme-catalog',
    skills: [
      {
        name: 'alpha',
        description: 'alpha skill',
        source: { type: 'github', repo: 'acme/alpha' },
      },
    ],
  };

  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'deft-git-catalog-'));
    vi.mocked(execFile).mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await rm(baseDir, { recursive: true, force: true });
  });

  function repoDir(): string {
    const slug = createHash('sha1').update(source.url).digest('hex');
    return join(baseDir, slug);
  }

  function mockGitSuccess(handler?: (args: string[]) => Promise<void> | void): void {
    vi.mocked(execFile).mockImplementation((_, args, callback) => {
      Promise.resolve(handler?.(args as string[]))
        .then(() => {
          (callback as (error: Error | null) => void)(null);
        })
        .catch((error) => {
          (callback as (error: Error) => void)(error as Error);
        });

      return {} as never;
    });
  }

  it('fetches catalog with clone when repo is not cached', async () => {
    mockGitSuccess(async (args) => {
      if (args[0] === 'clone') {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
        await writeFile(join(dir, 'skill-catalog.json'), JSON.stringify(catalog), 'utf-8');
      }
    });

    const store = new GitCatalogStore(baseDir);
    const result = await store.fetch(source);

    expect(result).toEqual(catalog);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', source.url, repoDir()],
      expect.any(Function),
    );
  });

  it('fetches catalog with pull when repo already exists', async () => {
    const dir = repoDir();
    await mkdir(join(dir, '.git'), { recursive: true });

    mockGitSuccess(async () => {
      await writeFile(join(dir, 'skill-catalog.json'), JSON.stringify(catalog), 'utf-8');
    });

    const store = new GitCatalogStore(baseDir);
    const result = await store.fetch(source);

    expect(result).toEqual(catalog);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'git',
      ['-C', dir, 'pull', '--ff-only'],
      expect.any(Function),
    );
  });

  it('returns graceful error when git is not installed', async () => {
    vi.mocked(execFile).mockImplementation((_, __, callback) => {
      (callback as (error: Error) => void)(new Error('ENOENT: git not found'));
      return {} as never;
    });

    const store = new GitCatalogStore(baseDir);
    await expect(store.fetch(source)).rejects.toThrow('Git command failed');
  });

  it('returns graceful error for invalid catalog json', async () => {
    mockGitSuccess(async () => {
      const dir = repoDir();
      await mkdir(join(dir, '.git'), { recursive: true });
      await writeFile(join(dir, 'skill-catalog.json'), '{', 'utf-8');
    });

    const store = new GitCatalogStore(baseDir);
    await expect(store.fetch(source)).rejects.toThrow('Failed to parse catalog file');
  });

  it('falls back to marketplace.json when skill-catalog.json is missing', async () => {
    mockGitSuccess(async () => {
      const dir = repoDir();
      await mkdir(join(dir, '.git'), { recursive: true });
      await writeFile(join(dir, 'marketplace.json'), JSON.stringify(catalog), 'utf-8');
    });

    const store = new GitCatalogStore(baseDir);
    const result = await store.fetch(source);

    expect(result).toEqual(catalog);
  });

  it('isFresh returns false when cache entry is expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T16:00:00Z'));

    mockGitSuccess(async () => {
      const dir = repoDir();
      await mkdir(join(dir, '.git'), { recursive: true });
      await writeFile(join(dir, 'skill-catalog.json'), JSON.stringify(catalog), 'utf-8');
    });

    const store = new GitCatalogStore(baseDir);
    await store.fetch(source);

    vi.setSystemTime(new Date('2026-03-21T17:05:00Z'));
    expect(store.isFresh(source, 60)).toBe(false);
  });

  describe('directory-scan fallback', () => {
    it('discovers skills from skills/*/SKILL.md when no catalog file exists', async () => {
      mockGitSuccess(async () => {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
        await mkdir(join(dir, 'skills', 'my-skill'), { recursive: true });
        await writeFile(
          join(dir, 'skills', 'my-skill', 'SKILL.md'),
          '---\nname: my-skill\ndescription: A discovered skill\n---\nContent',
          'utf-8',
        );
      });

      const store = new GitCatalogStore(baseDir);
      const result = await store.fetch(source);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('my-skill');
      expect(result.skills[0].description).toBe('A discovered skill');
      expect(result.skills[0].source).toEqual({ type: 'path', path: 'skills/my-skill' });
    });

    it('returns empty skills array when no skills/ directory exists', async () => {
      mockGitSuccess(async () => {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
      });

      const store = new GitCatalogStore(baseDir);
      const result = await store.fetch(source);

      expect(result.skills).toEqual([]);
      expect(result.name).toBe('skill-catalog');
    });

    it('skips directories without SKILL.md', async () => {
      mockGitSuccess(async () => {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
        await mkdir(join(dir, 'skills', 'valid-skill'), { recursive: true });
        await mkdir(join(dir, 'skills', 'no-skillmd'), { recursive: true });
        await writeFile(
          join(dir, 'skills', 'valid-skill', 'SKILL.md'),
          '---\nname: valid-skill\ndescription: valid\n---\nContent',
          'utf-8',
        );
        await writeFile(join(dir, 'skills', 'no-skillmd', 'README.md'), '# Not a skill', 'utf-8');
      });

      const store = new GitCatalogStore(baseDir);
      const result = await store.fetch(source);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('valid-skill');
    });

    it('skips skills with malformed frontmatter', async () => {
      mockGitSuccess(async () => {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
        await mkdir(join(dir, 'skills', 'good'), { recursive: true });
        await mkdir(join(dir, 'skills', 'bad'), { recursive: true });
        await writeFile(
          join(dir, 'skills', 'good', 'SKILL.md'),
          '---\nname: good\ndescription: good skill\n---\nContent',
          'utf-8',
        );
        await writeFile(join(dir, 'skills', 'bad', 'SKILL.md'), 'no frontmatter here', 'utf-8');
      });

      const store = new GitCatalogStore(baseDir);
      const result = await store.fetch(source);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('good');
    });

    it('infers catalog name from URL', async () => {
      mockGitSuccess(async () => {
        const dir = repoDir();
        await mkdir(join(dir, '.git'), { recursive: true });
      });

      const store = new GitCatalogStore(baseDir);
      const result = await store.fetch(source);

      expect(result.name).toBe('skill-catalog');
    });
  });

  describe('prune', () => {
    it('removes directories older than maxAgeDays', async () => {
      // Create a stale directory and backdate its mtime
      const staleDir = join(baseDir, 'stale-clone');
      await mkdir(staleDir, { recursive: true });
      await writeFile(join(staleDir, 'marker'), 'old', 'utf-8');

      const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
      await utimes(staleDir, sixtyDaysAgo, sixtyDaysAgo);

      const store = new GitCatalogStore(baseDir);
      const pruned = await store.prune(30);

      expect(pruned).toBe(1);

      const { readdir: rd } = await import('node:fs/promises');
      const remaining = await rd(baseDir);
      expect(remaining).not.toContain('stale-clone');
    });

    it('keeps directories newer than maxAgeDays', async () => {
      const freshDir = join(baseDir, 'fresh-clone');
      await mkdir(freshDir, { recursive: true });
      await writeFile(join(freshDir, 'marker'), 'new', 'utf-8');

      const store = new GitCatalogStore(baseDir);
      const pruned = await store.prune(30);

      expect(pruned).toBe(0);

      const { readdir: rd } = await import('node:fs/promises');
      const remaining = await rd(baseDir);
      expect(remaining).toContain('fresh-clone');
    });

    it('returns 0 when base directory does not exist', async () => {
      const store = new GitCatalogStore(join(baseDir, 'nonexistent'));
      const pruned = await store.prune(30);
      expect(pruned).toBe(0);
    });
  });
});
