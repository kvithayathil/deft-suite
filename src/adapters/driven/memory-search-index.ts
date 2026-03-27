import type { SearchIndex } from '../../core/ports/search-index.js';
import type { SkillMetadata, SearchResult, TrustLevel } from '../../core/types.js';

export class MemorySearchIndex implements SearchIndex {
  private skills: SkillMetadata[] = [];

  async rebuild(skills: SkillMetadata[]): Promise<void> {
    this.skills = [...skills];
  }

  async search(query: string): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    return this.skills
      .map((skill) => {
        let score = 0;
        const nameLower = skill.name.toLowerCase();
        const descLower = skill.description.toLowerCase();

        for (const term of terms) {
          if (nameLower.includes(term)) score += 2; // Name match weighted 2x
          if (descLower.includes(term)) score += 1;
        }

        return {
          name: skill.name,
          description: skill.description,
          trustLevel: 'unknown' as TrustLevel,
          score,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  async listCategories(): Promise<string[]> {
    const tags = new Set<string>();
    for (const skill of this.skills) {
      if (skill.tags) {
        for (const tag of skill.tags) {
          tags.add(tag);
        }
      }
    }
    return [...tags].sort();
  }

  async getByCategory(category: string): Promise<SearchResult[]> {
    return this.skills
      .filter((skill) => skill.tags?.includes(category))
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        trustLevel: 'unknown' as TrustLevel,
        score: 1,
      }));
  }
}
