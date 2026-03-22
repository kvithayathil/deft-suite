import type { GitHubSearchResult } from '../types.js';

export interface GitHubSearch {
  search(query: string, topics: string[], limit?: number): Promise<GitHubSearchResult[]>;
  isAvailable(): boolean;
  getRateLimitRemaining(): number;
}
