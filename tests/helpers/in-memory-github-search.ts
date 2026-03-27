import type { GitHubSearch } from '../../src/core/ports/github-search.js';
import type { GitHubSearchResult } from '../../src/core/types.js';

interface InMemoryGitHubSearchOptions {
  available?: boolean;
  rateLimitRemaining?: number;
}

export class InMemoryGitHubSearch implements GitHubSearch {
  private readonly fixtures: GitHubSearchResult[];
  private available: boolean;
  private rateLimitRemaining: number;

  constructor(fixtures: GitHubSearchResult[] = [], options?: InMemoryGitHubSearchOptions) {
    this.fixtures = [...fixtures];
    this.available = options?.available ?? true;
    this.rateLimitRemaining = options?.rateLimitRemaining ?? 5000;
  }

  async search(query: string, topics: string[], limit: number = 10): Promise<GitHubSearchResult[]> {
    if (!this.available) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const normalizedTopics = topics.map((topic) => topic.toLowerCase());

    return this.fixtures
      .filter((entry) => {
        const queryMatch =
          normalizedQuery.length === 0 ||
          entry.name.toLowerCase().includes(normalizedQuery) ||
          entry.description.toLowerCase().includes(normalizedQuery);

        const tagsLower = entry.tags.map((tag) => tag.toLowerCase());
        const topicsMatch = normalizedTopics.every((topic) => tagsLower.includes(topic));

        return queryMatch && topicsMatch;
      })
      .slice(0, Math.max(0, limit));
  }

  isAvailable(): boolean {
    return this.available && this.rateLimitRemaining > 0;
  }

  getRateLimitRemaining(): number {
    return this.rateLimitRemaining;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  setRateLimitRemaining(remaining: number): void {
    this.rateLimitRemaining = remaining;
  }
}
