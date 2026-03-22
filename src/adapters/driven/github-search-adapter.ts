import { execFile } from 'node:child_process';
import type { Logger } from '../../core/ports/logger.js';
import type { GitHubSearch } from '../../core/ports/github-search.js';
import type { GitHubSearchResult } from '../../core/types.js';
import { TokenBucket } from '../../resilience/token-bucket.js';

interface GitHubSearchApiItem {
  score?: unknown;
  repository?: {
    full_name?: unknown;
    description?: unknown;
    topics?: unknown;
  };
}

interface GitHubSearchApiResponse {
  items?: unknown;
}

export interface GitHubSearchAdapterOptions {
  enabled: boolean;
  logger: Logger;
  tokenBucket?: TokenBucket;
}

export class GitHubSearchAdapter implements GitHubSearch {
  private readonly enabled: boolean;
  private readonly logger: Logger;
  private readonly tokenBucket: TokenBucket;
  private authTokenPromise?: Promise<string | null>;
  private rateLimitRemaining = 60;

  constructor(options: GitHubSearchAdapterOptions) {
    this.enabled = options.enabled;
    this.logger = options.logger;
    this.tokenBucket = options.tokenBucket ?? new TokenBucket(60, 60);
  }

  async search(query: string, topics: string[], limit: number = 10): Promise<GitHubSearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    if (this.rateLimitRemaining <= 0) {
      this.logger.debug('GitHub search skipped: remote rate limit exhausted');
      return [];
    }

    if (!this.tokenBucket.tryConsume()) {
      this.logger.debug('GitHub search skipped: local token bucket exhausted');
      return [];
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return [];
    }

    const perPage = Math.min(100, Math.max(1, limit));
    const composedQuery = this.composeQuery(trimmedQuery, topics);
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(composedQuery)}&per_page=${perPage}`;

    const headers = new Headers({
      accept: 'application/vnd.github+json',
    });

    const token = await this.getAuthToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers });
    } catch (error) {
      this.logger.warn('GitHub search request failed', { error: String(error) });
      return [];
    }

    this.updateRateLimitRemaining(response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      this.logger.debug('GitHub search returned non-OK status', {
        status: response.status,
        rateLimitRemaining: this.rateLimitRemaining,
      });
      return [];
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      this.logger.warn('GitHub search payload parse failed', { error: String(error) });
      return [];
    }

    return this.mapResponse(payload);
  }

  isAvailable(): boolean {
    return this.enabled && this.rateLimitRemaining > 0;
  }

  getRateLimitRemaining(): number {
    return this.rateLimitRemaining;
  }

  private composeQuery(query: string, topics: string[]): string {
    const topicFilters = topics
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0)
      .map((topic) => `topic:${topic}`);

    return ['SKILL.md in:path', query, ...topicFilters].join(' ');
  }

  private async getAuthToken(): Promise<string | null> {
    if (!this.authTokenPromise) {
      this.authTokenPromise = this.resolveAuthToken();
    }

    return this.authTokenPromise;
  }

  private async resolveAuthToken(): Promise<string | null> {
    try {
      const ghToken = await this.getGhAuthToken();
      if (ghToken) {
        return ghToken;
      }
    } catch (error) {
      this.logger.debug('GitHub CLI token lookup failed', { error: String(error) });
    }

    const envToken = process.env.GITHUB_TOKEN?.trim();
    if (envToken) {
      return envToken;
    }

    return null;
  }

  private async getGhAuthToken(): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      execFile('gh', ['auth', 'token'], (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const token = stdout.trim();
        resolve(token.length > 0 ? token : null);
      });
    });
  }

  private updateRateLimitRemaining(headerValue: string | null): void {
    if (headerValue == null) {
      return;
    }

    const parsed = Number.parseInt(headerValue, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      this.rateLimitRemaining = parsed;
    }
  }

  private mapResponse(payload: unknown): GitHubSearchResult[] {
    if (!payload || typeof payload !== 'object') {
      this.logger.warn('GitHub search payload invalid: expected object');
      return [];
    }

    const response = payload as GitHubSearchApiResponse;
    if (!Array.isArray(response.items)) {
      this.logger.warn('GitHub search payload invalid: expected items array');
      return [];
    }

    const mapped: GitHubSearchResult[] = [];

    for (const item of response.items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const candidate = item as GitHubSearchApiItem;
      const repository = candidate.repository;
      if (!repository || typeof repository !== 'object') {
        continue;
      }

      const repoName = typeof repository.full_name === 'string' ? repository.full_name : null;
      if (!repoName) {
        continue;
      }

      const description = typeof repository.description === 'string' ? repository.description : '';
      const tags = Array.isArray(repository.topics)
        ? repository.topics.filter((topic): topic is string => typeof topic === 'string')
        : [];

      mapped.push({
        name: repoName,
        description,
        source: { type: 'github', repo: repoName },
        tags,
        score: typeof candidate.score === 'number' ? candidate.score : 0,
        installable: true,
      });
    }

    return mapped;
  }
}
