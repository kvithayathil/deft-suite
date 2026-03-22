import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenBucket } from '../../src/resilience/token-bucket.js';
import { NoopLogger } from '../helpers/noop-logger.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { GitHubSearchAdapter } from '../../src/adapters/driven/github-search-adapter.js';

describe('GitHubSearchAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(execFile).mockReset();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  function mockGhToken(value: string | Error): void {
    vi.mocked(execFile).mockImplementation((_, __, callback) => {
      if (value instanceof Error) {
        (callback as (error: Error | null, stdout?: string) => void)(value, '');
      } else {
        (callback as (error: Error | null, stdout?: string) => void)(null, `${value}\n`);
      }

      return {} as never;
    });
  }

  it('builds query with SKILL.md path and topic filters', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    await adapter.search('database', ['mcp-skill', 'sql'], 5);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('SKILL.md%20in%3Apath%20database%20topic%3Amcp-skill%20topic%3Asql');
    expect(String(url)).toContain('per_page=5');
  });

  it('prefers gh auth token over GITHUB_TOKEN', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    await adapter.search('search', [], 10);

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer gh-token');
  });

  it('falls back to GITHUB_TOKEN env var when gh auth token fails', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    mockGhToken(new Error('gh not installed'));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    await adapter.search('search', [], 10);

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer env-token');
  });

  it('works unauthenticated when neither gh token nor env token exists', async () => {
    mockGhToken(new Error('gh not installed'));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    await adapter.search('search', [], 10);

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('authorization')).toBeNull();
  });

  it('maps API items into GitHubSearchResult', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({
        items: [
          {
            score: 42,
            repository: {
              full_name: 'acme/skill-repo',
              description: 'skill repo',
              topics: ['mcp-skill', 'search'],
            },
          },
        ],
      }), { status: 200 }),
    );

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    const result = await adapter.search('skill', ['mcp-skill'], 10);

    expect(result).toEqual([
      {
        name: 'acme/skill-repo',
        description: 'skill repo',
        source: { type: 'github', repo: 'acme/skill-repo' },
        tags: ['mcp-skill', 'search'],
        score: 42,
        installable: true,
      },
    ]);
  });

  it('tracks rate limit remaining from response headers and exposes availability', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'x-ratelimit-remaining': '0' },
      }),
    );

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });
    await adapter.search('skill', [], 10);

    expect(adapter.getRateLimitRemaining()).toBe(0);
    expect(adapter.isAvailable()).toBe(false);
  });

  it('returns empty when disabled', async () => {
    const adapter = new GitHubSearchAdapter({ enabled: false, logger: new NoopLogger() });

    const result = await adapter.search('skill', [], 10);

    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns empty and does not throw on network failure', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });

    await expect(adapter.search('skill', [], 10)).resolves.toEqual([]);
  });

  it('returns empty and does not throw on non-OK status', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(new Response('forbidden', { status: 403 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });

    await expect(adapter.search('skill', [], 10)).resolves.toEqual([]);
  });

  it('returns empty and does not throw on malformed payload', async () => {
    mockGhToken('gh-token');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ nope: 'bad' }), { status: 200 }));

    const adapter = new GitHubSearchAdapter({ enabled: true, logger: new NoopLogger() });

    await expect(adapter.search('skill', [], 10)).resolves.toEqual([]);
  });

  it('returns empty when local token bucket is exhausted', async () => {
    const tokenBucket = new TokenBucket(0, 60);
    const adapter = new GitHubSearchAdapter({
      enabled: true,
      logger: new NoopLogger(),
      tokenBucket,
    });

    const result = await adapter.search('skill', [], 10);

    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
