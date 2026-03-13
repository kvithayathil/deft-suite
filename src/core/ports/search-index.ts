import type { SkillMetadata, SearchResult } from '../types.js';

export interface SearchIndex {
  rebuild(skills: SkillMetadata[]): Promise<void>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  listCategories(): Promise<string[]>;
  getByCategory(category: string): Promise<SearchResult[]>;
}
