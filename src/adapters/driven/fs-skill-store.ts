import { readFile, writeFile, readdir, mkdir, rm, access } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { SkillStore } from '../../core/ports/skill-store.js';
import type { Skill, SkillMetadata, Source } from '../../core/types.js';
import { TrustLevel, SkillState } from '../../core/types.js';

export class FsSkillStore implements SkillStore {
  constructor(private readonly basePath: string) {}

  private resolveSafePath(baseDir: string, targetPath: string): string {
    if (isAbsolute(targetPath)) {
      throw new Error(`Invalid absolute path: ${targetPath}`);
    }

    const resolvedBase = resolve(baseDir);
    const resolvedTarget = resolve(baseDir, targetPath);
    const relativePath = relative(resolvedBase, resolvedTarget);

    if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      throw new Error(`Invalid path traversal detected: ${targetPath}`);
    }

    return resolvedTarget;
  }

  async get(name: string): Promise<Skill | null> {
    try {
      const safePath = this.resolveSafePath(this.basePath, name);
      return this.readSkillFromDir(safePath);
    } catch {
      return null;
    }
  }

  async listMetadata(): Promise<SkillMetadata[]> {
    const names = await this.listNames();
    const results: SkillMetadata[] = [];
    for (const n of names) {
      const s = await this.get(n);
      if (s) results.push(s.metadata);
    }
    return results;
  }

  async exists(name: string): Promise<boolean> {
    try {
      const safePath = this.resolveSafePath(this.basePath, name);
      await access(join(safePath, 'SKILL.md'));
      return true;
    } catch {
      return false;
    }
  }

  async write(name: string, skill: Skill, resources?: Record<string, string>): Promise<void> {
    const dir = this.resolveSafePath(this.basePath, name);
    await mkdir(dir, { recursive: true });
    const fm = stringifyYaml(skill.metadata).trim();
    await writeFile(join(dir, 'SKILL.md'), `---\n${fm}\n---\n${skill.content}`, 'utf-8');

    if (resources) {
      for (const [resourcePath, content] of Object.entries(resources)) {
        const safeResourcePath = this.resolveSafePath(dir, resourcePath);
        await mkdir(resolve(safeResourcePath, '..'), { recursive: true });
        await writeFile(safeResourcePath, content, 'utf-8');
      }
    }
  }

  async delete(name: string): Promise<void> {
    try {
      const safePath = this.resolveSafePath(this.basePath, name);
      await rm(safePath, { recursive: true, force: true });
    } catch {
      // Ignore if path is invalid or already deleted
    }
  }

  async getResource(skillName: string, resourcePath: string): Promise<string | null> {
    try {
      const safeSkillPath = this.resolveSafePath(this.basePath, skillName);
      const safeResourcePath = this.resolveSafePath(safeSkillPath, resourcePath);
      return await readFile(safeResourcePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async fetch(name: string, source: Source): Promise<Skill | null> {
    if (source.type !== 'local' || !source.path) {
      return null;
    }

    try {
      const safePath = this.resolveSafePath(source.path, name);
      return this.readSkillFromDir(safePath);
    } catch {
      return null;
    }
  }

  async listNames(): Promise<string[]> {
    try {
      const entries = await readdir(this.basePath, { withFileTypes: true });
      const names: string[] = [];
      for (const e of entries) {
        if (e.isDirectory() && (await this.exists(e.name))) names.push(e.name);
      }
      return names;
    } catch {
      return [];
    }
  }

  async computeHash(name: string): Promise<string> {
    const safePath = this.resolveSafePath(this.basePath, name);
    const content = await readFile(join(safePath, 'SKILL.md'), 'utf-8');
    return `sha256:${createHash('sha256').update(content).digest('hex')}`;
  }

  private async readSkillFromDir(skillPath: string): Promise<Skill | null> {
    try {
      const raw = await readFile(join(skillPath, 'SKILL.md'), 'utf-8');
      const { metadata, content } = this.parseSkillMd(raw);
      const resources = await this.listResources(skillPath);
      return {
        metadata,
        content,
        resources,
        trustLevel: TrustLevel.Unknown,
        state: SkillState.Active,
        sourcePath: skillPath,
      };
    } catch {
      return null;
    }
  }

  private parseSkillMd(raw: string): { metadata: SkillMetadata; content: string } {
    const normalized = raw.replace(/\r\n/g, '\n');
    const m = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { metadata: { name: '', description: '' }, content: normalized };
    const metadata = parseYaml(m[1]) as SkillMetadata;
    if (!metadata.name || !metadata.description) {
      throw new Error(
        `SKILL.md missing required fields: name=${metadata.name}, description=${metadata.description}`,
      );
    }
    return { metadata, content: m[2].trim() };
  }

  private async listResources(skillPath: string): Promise<string[]> {
    const resources: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const fp = join(dir, e.name);
        if (e.isDirectory()) await walk(fp);
        else if (e.name !== 'SKILL.md') resources.push(relative(skillPath, fp));
      }
    };
    await walk(skillPath);
    return resources;
  }
}
