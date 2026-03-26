import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaticCatalogStore } from '../../src/adapters/driven/static-catalog-store.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../src/core/types.js';

describe('StaticCatalogStore', () => {
  const source: CatalogSourceConfig = {
    type: 'static',
    url: 'https://example.com/skills/catalog.json',
  };

  const catalog: CatalogEntry = {
    name: 'community-catalog',
    skills: [
      {
        name: 'test-skill',
        description: 'A useful test skill',
        source: { type: 'github', repo: 'acme/test-skill' },
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches and parses catalog successfully', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(catalog), {
        status: 200,
        headers: {
          etag: '"etag-1"',
          'last-modified': 'Tue, 21 Mar 2026 15:00:00 GMT',
        },
      }),
    );

    const store = new StaticCatalogStore();
    const result = await store.fetch(source);

    expect(result).toEqual(catalog);
    expect(await store.getCached(source)).toEqual(catalog);
    expect(store.isFresh(source, 60)).toBe(true);
  });

  it('throws graceful error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const store = new StaticCatalogStore();
    await expect(store.fetch(source)).rejects.toThrow('Failed to fetch catalog');
  });

  it('throws graceful error on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not found', { status: 404 }));

    const store = new StaticCatalogStore();
    await expect(store.fetch(source)).rejects.toThrow('HTTP 404');
  });

  it('throws graceful error on invalid JSON payload', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const store = new StaticCatalogStore();
    await expect(store.fetch(source)).rejects.toThrow('Failed to parse catalog');
  });

  it('returns cached content on 304 and refreshes freshness timestamp', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const store = new StaticCatalogStore();
    await store.fetch(source);
    const second = await store.fetch(source);

    expect(second).toEqual(catalog);
    expect(store.isFresh(source, 1)).toBe(true);
  });

  it('clearCache clears one source or all cache entries', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(catalog), { status: 200 }));

    const store = new StaticCatalogStore();
    await store.fetch(source);
    expect(await store.getCached(source)).toEqual(catalog);

    store.clearCache(source);
    expect(await store.getCached(source)).toBeNull();

    await store.fetch(source);
    store.clearCache();
    expect(await store.getCached(source)).toBeNull();
  });
});
