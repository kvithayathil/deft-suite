import { createHash } from 'node:crypto';
import type { SkillStore } from '../../src/core/ports/skill-store.js';
import type { Skill, SkillMetadata, Source } from '../../src/core/types.js';

export class InMemorySkillStore implements SkillStore {
  private skills = new Map<string, Skill>();
  private resources = new Map<string, Map<string, string>>();

  async get(name: string): Promise<Skill | null> {
    return this.skills.get(name) ?? null;
  }

  async listMetadata(): Promise<SkillMetadata[]> {
    return Array.from(this.skills.values()).map(s => s.metadata);
  }

  async exists(name: string): Promise<boolean> {
    return this.skills.has(name);
  }

  async write(name: string, skill: Skill, resources?: Record<string, string>): Promise<void> {
    const resourceEntries = resources ? Object.entries(resources) : [];
    this.skills.set(name, {
      ...skill,
      resources: resourceEntries.length > 0 ? resourceEntries.map(([resourcePath]) => resourcePath) : skill.resources,
    });

    if (resourceEntries.length > 0) {
      const resourceMap = new Map<string, string>();
      for (const [resourcePath, content] of resourceEntries) {
        resourceMap.set(resourcePath, content);
      }
      this.resources.set(name, resourceMap);
    }
  }

  async delete(name: string): Promise<void> {
    this.skills.delete(name);
    this.resources.delete(name);
  }

  async getResource(skillName: string, resourcePath: string): Promise<string | null> {
    return this.resources.get(skillName)?.get(resourcePath) ?? null;
  }

  async fetch(_name: string, _source: Source): Promise<Skill | null> {
    return null;
  }

  async listNames(): Promise<string[]> {
    return Array.from(this.skills.keys());
  }

  async computeHash(name: string): Promise<string> {
    const skill = this.skills.get(name);
    if (!skill) return '';
    return createHash('sha256').update(skill.content).digest('hex');
  }

  seedResource(skillName: string, resourcePath: string, content: string): void {
    if (!this.resources.has(skillName)) {
      this.resources.set(skillName, new Map());
    }
    this.resources.get(skillName)!.set(resourcePath, content);
  }

  seed(name: string, skill: Skill): void {
    this.skills.set(name, skill);
  }
}
