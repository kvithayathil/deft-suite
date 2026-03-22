import { describe, expect, it } from 'vitest';
import { InMemoryGitHubSearch } from './in-memory-github-search.js';
import type { GitHubSearchResult } from '../../src/core/types.js';

describe('InMemoryGitHubSearch', () => {
  const fixtures: GitHubSearchResult[] = [
    {
      name: 'acme/skill-search',
      description: 'Unified skill search helpers',
      source: { type: 'github', repo: 'acme/skill-search' },
      tags: ['mcp-skill', 'search'],
      score: 98,
      installable: true,
    },
    {
      name: 'acme/skill-security',
      description: 'Security-focused skill templates',
      source: { type: 'github', repo: 'acme/skill-security' },
      tags: ['mcp-skill', 'security'],
      score: 88,
      installable: true,
    },
  ];

  it('filters fixtures by query and topics', async () => {
    const search = new InMemoryGitHubSearch(fixtures);

    const result = await search.search('security', ['mcp-skill'], 10);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('acme/skill-security');
  });

  it('returns empty when unavailable', async () => {
    const search = new InMemoryGitHubSearch(fixtures, { available: false });

    const result = await search.search('skill', [], 10);

    expect(result).toEqual([]);
    expect(search.isAvailable()).toBe(false);
  });

  it('exposes configurable rate-limit remaining', () => {
    const search = new InMemoryGitHubSearch(fixtures, { rateLimitRemaining: 25 });

    expect(search.getRateLimitRemaining()).toBe(25);

    search.setRateLimitRemaining(0);
    expect(search.getRateLimitRemaining()).toBe(0);
    expect(search.isAvailable()).toBe(false);
  });
});
