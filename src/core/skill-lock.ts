import type { SkillLock, SkillLockEntry } from './types.js';
import type { SkillLockStore } from './ports/skill-lock-store.js';
import type { Logger } from './ports/logger.js';

export interface VerifyResult {
  matches: boolean;
  expected: string | null;
  actual: string;
}

export class SkillLockManager {
  private lock: SkillLock;
  private loaded = false;

  constructor(
    private readonly store: SkillLockStore,
    private readonly logger: Logger,
  ) {
    this.lock = this.emptyLock();
  }

  async load(): Promise<SkillLock> {
    if (!this.loaded) {
      const stored = await this.store.load();
      if (stored) {
        this.lock = stored;
      }
      this.loaded = true;
    }
    return this.lock;
  }

  async addOrUpdate(skillName: string, entry: SkillLockEntry): Promise<void> {
    await this.load();
    this.lock.skills[skillName] = entry;
    this.lock.generatedAt = new Date().toISOString();
    await this.store.save(this.lock);
    this.logger.debug(`Lock updated for skill '${skillName}'`);
  }

  async remove(skillName: string): Promise<void> {
    await this.load();
    if (this.lock.skills[skillName]) {
      delete this.lock.skills[skillName];
      this.lock.generatedAt = new Date().toISOString();
      await this.store.save(this.lock);
      this.logger.debug(`Lock entry removed for skill '${skillName}'`);
    }
  }

  async verify(skillName: string, actualHash: string): Promise<VerifyResult> {
    await this.load();
    const entry = this.lock.skills[skillName];
    if (!entry) {
      return { matches: false, expected: null, actual: actualHash };
    }
    return {
      matches: entry.contentHash === actualHash,
      expected: entry.contentHash,
      actual: actualHash,
    };
  }

  async getEntry(skillName: string): Promise<SkillLockEntry | null> {
    await this.load();
    return this.lock.skills[skillName] ?? null;
  }

  async listLockedSkills(): Promise<string[]> {
    await this.load();
    return Object.keys(this.lock.skills);
  }

  private emptyLock(): SkillLock {
    return {
      lockVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: 'deft-mcp@1.0.0-beta.2',
      skills: {},
    };
  }
}
