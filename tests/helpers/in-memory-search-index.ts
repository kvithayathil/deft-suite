import type { SearchIndex } from '../../src/core/ports/search-index.js';
import { TrustLevel, type SkillMetadata, type SearchResult } from '../../src/core/types.js';

export class InMemorySearchIndex implements SearchIndex {
  private skills: SkillMetadata[] = [];

  async rebuild(skills: SkillMetadata[]): Promise<void> {
    this.skills = [...skills];
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const lowerQuery = query.toLowerCase();
    return this.skills
      .filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.description.toLowerCase().includes(lowerQuery),
      )
      .slice(0, limit)
      .map((s, i) => ({
        name: s.name,
        description: s.description,
        trustLevel: TrustLevel.Bundled,
        score: 1 - i * 0.1,
      }));
  }

  async listCategories(): Promise<string[]> {
    const cats = new Set<string>();
    for (const s of this.skills) {
      for (const tag of s.tags ?? []) {
        cats.add(tag);
      }
    }
    return Array.from(cats).sort();
  }

  async getByCategory(category: string): Promise<SearchResult[]> {
    return this.skills
      .filter((s) => s.tags?.includes(category))
      .map((s) => ({
        name: s.name,
        description: s.description,
        trustLevel: TrustLevel.Bundled,
        score: 1,
      }));
  }
}
