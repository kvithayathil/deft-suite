import { describe, it, expect } from 'vitest';
import type { ToolContext } from '../../src/tools/context.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../src/core/types.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { InMemoryGitHubSearch } from '../helpers/in-memory-github-search.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { handleSearchSkills } from '../../src/tools/search-skills.js';

const CATALOG_SOURCE: CatalogSourceConfig = {
  url: 'https://catalog.test/skills.json',
  type: 'static',
};

class FlakyCatalogStore {
  private readonly entry: CatalogEntry;

  private cached: CatalogEntry | null = null;

  private fresh = true;

  private failFetch = false;

  fetchCalls = 0;

  cachedCalls = 0;

  constructor(entry: CatalogEntry) {
    this.entry = entry;
  }

  async fetch(_source: CatalogSourceConfig): Promise<CatalogEntry> {
    this.fetchCalls += 1;
    if (this.failFetch) {
      throw new Error('remote unavailable');
    }
    this.cached = this.entry;
    return this.entry;
  }

  async getCached(_source: CatalogSourceConfig): Promise<CatalogEntry | null> {
    this.cachedCalls += 1;
    return this.cached;
  }

  isFresh(_source: CatalogSourceConfig, _maxAgeMinutes: number): boolean {
    return this.fresh;
  }

  clearCache(): void {
    this.cached = null;
  }

  setFresh(fresh: boolean): void {
    this.fresh = fresh;
  }

  setFailFetch(failFetch: boolean): void {
    this.failFetch = failFetch;
  }
}

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const logger = new NoopLogger();
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();

  const config = {
    ...DEFAULT_CONFIG,
    sources: {
      local: [],
      remote: [],
      catalogs: [CATALOG_SOURCE],
    },
    github: {
      search: true,
      topics: ['mcp-skill'],
    },
  };

  return {
    skillStore,
    bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(),
    searchIndex: new InMemorySearchIndex(),
    lockManager: new SkillLockManager(new InMemorySkillLockStore(), logger),
    lifecycle: new SkillLifecycle(logger),
    resolver: new SkillResolver(skillStore, bundledStore, [], logger),
    trustEvaluator: new TrustEvaluator(DEFAULT_CONFIG.security),
    manifestBuilder: new ManifestBuilder(DEFAULT_CONFIG.manifest),
    config,
    rawConfig: {},
    logger,
    ...overrides,
  };
}

describe('Offline Search Integration', () => {
  it('returns local results with offline flag and cached catalog fallback when remotes fail', async () => {
    const store = new FlakyCatalogStore({
      name: 'team-catalog',
      skills: [
        {
          name: 'catalog-python-skill',
          description: 'Python helper from team catalog',
          source: { type: 'url', url: 'https://catalog.test/python' },
          tags: ['python'],
        },
      ],
    });

    const ctx = makeContext({
      catalogStores: new Map([[CATALOG_SOURCE.url, store]]),
      githubSearch: new InMemoryGitHubSearch([], { available: false }),
    });

    await ctx.searchIndex.rebuild([{ name: 'local-python', description: 'Local python skill' }]);

    await handleSearchSkills({ query: 'python', sources: ['catalog'] }, ctx);

    store.setFresh(false);
    store.setFailFetch(true);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.offline).toBe(true);
    expect(parsed.local).toHaveLength(1);
    expect(parsed.local[0].name).toBe('local-python');
    expect(parsed.catalogs['catalog.test-skills.json']).toHaveLength(1);
    expect(parsed.catalogs['catalog.test-skills.json'][0].name).toBe('catalog-python-skill');
    expect(parsed.github).toEqual([]);
  });

  it('covers catalog cache lifecycle: fresh, stale, and refresh fetch paths', async () => {
    const store = new FlakyCatalogStore({
      name: 'team-catalog',
      skills: [
        {
          name: 'catalog-python-skill',
          description: 'Python helper from team catalog',
          source: { type: 'url', url: 'https://catalog.test/python' },
          tags: ['python'],
        },
      ],
    });

    const ctx = makeContext({
      catalogStores: new Map([[CATALOG_SOURCE.url, store]]),
    });

    store.setFresh(false);
    await handleSearchSkills({ query: 'python', sources: ['catalog'] }, ctx);
    expect(store.fetchCalls).toBe(1);

    store.setFresh(true);
    await handleSearchSkills({ query: 'python', sources: ['catalog'] }, ctx);
    expect(store.fetchCalls).toBe(1);
    expect(store.cachedCalls).toBe(1);

    store.setFresh(false);
    await handleSearchSkills({ query: 'python', sources: ['catalog'] }, ctx);
    expect(store.fetchCalls).toBe(2);

    await handleSearchSkills({ query: 'python', sources: ['catalog'], refresh: true }, ctx);
    expect(store.fetchCalls).toBe(3);
  });
});
