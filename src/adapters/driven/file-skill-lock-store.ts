import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SkillLockStore } from '../../core/ports/skill-lock-store.js';
import type { SkillLock } from '../../core/types.js';

export class FileSkillLockStore implements SkillLockStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<SkillLock | null> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  async save(lock: SkillLock): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPath(): string {
    return this.filePath;
  }
}
