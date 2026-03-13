import type { SearchIndex } from '../../src/core/ports/search-index.js';
import type { SkillMetadata, SearchResult } from '../../src/core/types.js';

export class InMemorySearchIndex implements SearchIndex {
  private skills: SkillMetadata[] = [];

  async rebuild(skills: SkillMetadata[]): Promise<void> {
    this.skills = [...skills];
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const lowerQuery = query.toLowerCase();
    return this.skills
      .filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit)
      .map((s, i) => ({
        name: s.name,
        description: s.description,
        trustLevel: 'bundled' as const,
        score: 1 - (i * 0.1),
      }));
  }

  async listCategories(): Promise<string[]> {
    const cats = new Set<string>();
    for (const s of this.skills) {
      const cat = s.metadata?.['category'] as string | undefined;
      if (cat) cats.add(cat);
    }
    return Array.from(cats);
  }

  async getByCategory(category: string): Promise<SearchResult[]> {
    return this.skills
      .filter(s => s.metadata?.['category'] === category)
      .map(s => ({
        name: s.name,
        description: s.description,
        trustLevel: 'bundled' as const,
        score: 1,
      }));
  }
}
