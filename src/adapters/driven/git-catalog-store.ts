import { execFile } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CatalogStore } from '../../core/ports/catalog-store.js';
import type { CatalogEntry, RegistrySource } from '../../core/types.js';

interface CacheEntry {
  catalog: CatalogEntry;
  fetchedAt: number;
}

export class GitCatalogStore implements CatalogStore {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly baseDir: string = join(tmpdir(), 'skill-mcp-catalogs')) {}

  async fetch(source: RegistrySource): Promise<CatalogEntry> {
    await mkdir(this.baseDir, { recursive: true });

    const repoDir = this.getRepoDir(source.url);
    const hasGitDir = await this.pathExists(join(repoDir, '.git'));

    if (hasGitDir) {
      await this.runGit(['-C', repoDir, 'pull', '--ff-only']);
    } else {
      await this.runGit(['clone', '--depth', '1', source.url, repoDir]);
    }

    const catalog = await this.loadCatalog(repoDir, source.url);
    this.cache.set(source.url, { catalog, fetchedAt: Date.now() });
    return catalog;
  }

  async getCached(source: RegistrySource): Promise<CatalogEntry | null> {
    return this.cache.get(source.url)?.catalog ?? null;
  }

  isFresh(source: RegistrySource, maxAgeMinutes: number): boolean {
    const cached = this.cache.get(source.url);
    if (!cached) {
      return false;
    }

    const ageMs = Date.now() - cached.fetchedAt;
    return ageMs <= maxAgeMinutes * 60_000;
  }

  clearCache(source?: RegistrySource): void {
    if (!source) {
      this.cache.clear();
      return;
    }

    this.cache.delete(source.url);
  }

  private async runGit(args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      execFile('git', args, (error) => {
        if (error) {
          reject(new Error(`Git command failed: git ${args.join(' ')} (${String(error)})`));
          return;
        }
        resolve();
      });
    });
  }

  private async loadCatalog(repoDir: string, sourceUrl: string): Promise<CatalogEntry> {
    const candidates = ['skill-catalog.json', 'marketplace.json'];

    for (const fileName of candidates) {
      const filePath = join(repoDir, fileName);
      if (!(await this.pathExists(filePath))) {
        continue;
      }

      try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        return validateCatalogEntry(parsed, sourceUrl);
      } catch (error) {
        throw new Error(`Failed to parse catalog file ${fileName} for ${sourceUrl}: ${String(error)}`);
      }
    }

    throw new Error(`No catalog file found for ${sourceUrl}; expected skill-catalog.json or marketplace.json`);
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private getRepoDir(url: string): string {
    const slug = createHash('sha1').update(url).digest('hex');
    return join(this.baseDir, slug);
  }
}

function validateCatalogEntry(value: unknown, sourceUrl: string): CatalogEntry {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: expected object`);
  }

  const entry = value as Partial<CatalogEntry>;
  if (typeof entry.name !== 'string') {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: missing name`);
  }
  if (!Array.isArray(entry.skills)) {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: missing skills array`);
  }

  for (const skill of entry.skills) {
    if (!skill || typeof skill !== 'object') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill item`);
    }

    const candidate = skill as {
      name?: unknown;
      description?: unknown;
      source?: unknown;
    };
    if (typeof candidate.name !== 'string' || typeof candidate.description !== 'string') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill fields`);
    }
    if (!candidate.source || typeof candidate.source !== 'object') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill source`);
    }
  }

  return entry as CatalogEntry;
}
