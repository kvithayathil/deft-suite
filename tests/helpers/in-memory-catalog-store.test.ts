import { describe, expect, it } from 'vitest';
import { InMemoryCatalogStore } from './in-memory-catalog-store.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../src/core/types.js';

describe('InMemoryCatalogStore', () => {
  const source: CatalogSourceConfig = { type: 'static', url: 'https://example.com/catalog.json' };

  const fixture: CatalogEntry = {
    name: 'example-catalog',
    skills: [
      {
        name: 'alpha',
        description: 'alpha description',
        source: { type: 'url', url: 'https://example.com/alpha' },
      },
    ],
  };

  it('fetch returns fixture entry by source url key', async () => {
    const store = new InMemoryCatalogStore({ [source.url]: fixture });

    const entry = await store.fetch(source);
    expect(entry).toEqual(fixture);
  });

  it('getCached mirrors cached behavior expectations', async () => {
    const store = new InMemoryCatalogStore({ [source.url]: fixture });

    expect(await store.getCached(source)).toEqual(fixture);
    await store.fetch(source);
    expect(await store.getCached(source)).toEqual(fixture);

    store.clearCache(source);
    expect(await store.getCached(source)).toEqual(fixture);

    store.clearCache();
    expect(await store.getCached(source)).toEqual(fixture);
  });

  it('isFresh uses configurable freshness toggle', () => {
    const store = new InMemoryCatalogStore({ [source.url]: fixture }, { fresh: false });

    expect(store.isFresh(source, 60)).toBe(false);

    store.setFresh(true);
    expect(store.isFresh(source, 60)).toBe(true);
  });

  it('throws when fixture is missing for source', async () => {
    const store = new InMemoryCatalogStore();

    await expect(store.fetch(source)).rejects.toThrow('Catalog fixture not found');
  });
});
