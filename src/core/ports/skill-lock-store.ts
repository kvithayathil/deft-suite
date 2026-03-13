import type { SkillLock } from '../types.js';

export interface SkillLockStore {
  load(): Promise<SkillLock | null>;
  save(lock: SkillLock): Promise<void>;
  exists(): Promise<boolean>;
  getPath(): string;
}
