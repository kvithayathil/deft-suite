import type { ManifestConfig, SkillMetadata } from './types.js';

export interface ManifestEntry {
  name: string;
  description: string;
}

export interface Manifest {
  skills: ManifestEntry[];
  missing: string[];
  truncated: boolean;
  warning?: string;
}

export class ManifestBuilder {
  constructor(private readonly config: ManifestConfig) {}

  build(availableSkills: SkillMetadata[]): Manifest {
    const skillMap = new Map(availableSkills.map(s => [s.name, s]));
    const skills: ManifestEntry[] = [];
    const missing: string[] = [];

    for (const name of this.config.skills) {
      const skill = skillMap.get(name);
      if (skill) {
        skills.push({ name: skill.name, description: skill.description });
      } else {
        missing.push(name);
      }
    }

    const truncated = skills.length > this.config.maxManifestSize;
    const finalSkills = truncated
      ? skills.slice(0, this.config.maxManifestSize)
      : skills;

    let warning: string | undefined;
    if (finalSkills.length > this.config.warnThreshold) {
      warning = `Manifest size (${finalSkills.length}) exceeds recommended threshold (${this.config.warnThreshold}). This increases context cost for every agent session.`;
    }

    return { skills: finalSkills, missing, truncated, warning };
  }

  toText(manifest: Manifest): string {
    const lines = [
      `Available skills: ${manifest.skills.map(s => s.name).join(', ')}`,
      'Use search_skills to find more. Use get_skill to load one.',
    ];
    if (manifest.warning) {
      lines.push(`Warning: ${manifest.warning}`);
    }
    return lines.join('\n');
  }
}
