import { execFile } from 'node:child_process';
import { access, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import type { CatalogStore } from '../../core/ports/catalog-store.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../core/types.js';

interface CacheEntry {
  catalog: CatalogEntry;
  fetchedAt: number;
}

export class GitCatalogStore implements CatalogStore {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly baseDir: string = join(tmpdir(), 'deft-catalogs')) {}

  async fetch(source: CatalogSourceConfig): Promise<CatalogEntry> {
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

  async getCached(source: CatalogSourceConfig): Promise<CatalogEntry | null> {
    return this.cache.get(source.url)?.catalog ?? null;
  }

  isFresh(source: CatalogSourceConfig, maxAgeMinutes: number): boolean {
    const cached = this.cache.get(source.url);
    if (!cached) {
      return false;
    }

    const ageMs = Date.now() - cached.fetchedAt;
    return ageMs <= maxAgeMinutes * 60_000;
  }

  clearCache(source?: CatalogSourceConfig): void {
    if (!source) {
      this.cache.clear();
      return;
    }

    this.cache.delete(source.url);
  }

  async prune(maxAgeDays: number): Promise<number> {
    if (!(await this.pathExists(this.baseDir))) {
      return 0;
    }

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const cutoffMs = Date.now() - maxAgeDays * 86_400_000;
    let pruned = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const dirPath = join(this.baseDir, entry.name);
      try {
        const info = await stat(dirPath);
        if (info.mtimeMs < cutoffMs) {
          await rm(dirPath, { recursive: true, force: true });
          pruned++;
        }
      } catch {
        continue;
      }
    }

    return pruned;
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

    // Fallback: scan skills/ directory for SKILL.md files
    return this.scanSkillDirectories(repoDir, sourceUrl);
  }

  private async scanSkillDirectories(repoDir: string, sourceUrl: string): Promise<CatalogEntry> {
    const skillsDir = join(repoDir, 'skills');
    if (!(await this.pathExists(skillsDir))) {
      return {
        name: inferCatalogName(sourceUrl),
        skills: [],
      };
    }

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skills: CatalogEntry['skills'] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = join(skillsDir, entry.name);
      const skillFile = join(skillDir, 'SKILL.md');
      if (!(await this.pathExists(skillFile))) {
        continue;
      }

      try {
        const raw = await readFile(skillFile, 'utf-8');
        const metadata = parseSkillFrontmatter(raw);
        skills.push({
          name: metadata.name,
          description: metadata.description,
          source: {
            type: 'path',
            path: `skills/${entry.name}`,
          },
        });
      } catch {
        continue;
      }
    }

    return {
      name: inferCatalogName(sourceUrl),
      skills,
    };
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

function parseSkillFrontmatter(raw: string): { name: string; description: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('No frontmatter found in SKILL.md');
  }

  const parsed = parseYaml(match[1]) as Record<string, unknown>;
  if (typeof parsed?.name !== 'string' || typeof parsed?.description !== 'string') {
    throw new Error('SKILL.md frontmatter missing name or description');
  }

  return { name: parsed.name, description: parsed.description };
}

function inferCatalogName(url: string): string {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? 'unknown-catalog';
}
