import type { SkillLockStore } from '../../src/core/ports/skill-lock-store.js';
import type { SkillLock } from '../../src/core/types.js';

export class InMemorySkillLockStore implements SkillLockStore {
  private lock: SkillLock | null = null;

  constructor(initial?: SkillLock) {
    this.lock = initial ?? null;
  }

  async load(): Promise<SkillLock | null> {
    return this.lock;
  }

  async save(lock: SkillLock): Promise<void> {
    this.lock = lock;
  }

  async exists(): Promise<boolean> {
    return this.lock !== null;
  }

  getPath(): string {
    return '<in-memory>';
  }
}
