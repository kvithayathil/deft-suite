import type { Skill, SkillMetadata, Source } from '../types.js';

export interface SkillStore {
  get(name: string): Promise<Skill | null>;
  listMetadata(): Promise<SkillMetadata[]>;
  exists(name: string): Promise<boolean>;
  write(name: string, skill: Skill): Promise<void>;
  delete(name: string): Promise<void>;
  getResource(skillName: string, resourcePath: string): Promise<string | null>;
  fetch(name: string, source: Source): Promise<Skill | null>;
  listNames(): Promise<string[]>;
  computeHash(name: string): Promise<string>;
}
