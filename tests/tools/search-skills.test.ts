import { describe, it, expect } from 'vitest';
import { handleSearchSkills } from '../../src/tools/search-skills.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { FIXTURE_SKILLS } from '../helpers/fixture-skills.js';
import { InMemoryCatalogStore } from '../helpers/in-memory-catalog-store.js';
import { InMemoryGitHubSearch } from '../helpers/in-memory-github-search.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import type { CatalogSourceConfig } from '../../src/core/types.js';
import type { ToolContext } from '../../src/tools/context.js';

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  const config = {
    ...DEFAULT_CONFIG,
    sources: {
      local: [],
      remote: [],
      catalogs: [{ url: 'https://catalog.test/skills.json', type: 'static' as const }],
    },
    github: {
      search: true,
      topics: ['mcp-skill'],
    },
  };

  return {
    skillStore, bundledStore,
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

const CATALOG_SOURCE: CatalogSourceConfig = { url: 'https://catalog.test/skills.json', type: 'static' };

describe('handleSearchSkills', () => {
  it('returns grouped local-only response when remotes are not configured', async () => {
    const ctx = makeContext();
    ctx.catalogStores = undefined;
    ctx.githubSearch = undefined;

    await ctx.searchIndex.rebuild([
      FIXTURE_SKILLS.tddPython.metadata,
      FIXTURE_SKILLS.securityBaseline.metadata,
    ]);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.local.length).toBeGreaterThan(0);
    expect(parsed.local[0].name).toBe('tdd-python');
    expect(parsed.local[0].installed).toBe(true);
    expect(parsed.catalogs).toEqual({});
    expect(parsed.github).toEqual([]);
    expect(parsed.offline).toBe(false);
  });

  it('returns local, catalog, and github groups when all sources are configured', async () => {
    const ctx = makeContext();
    ctx.catalogStores = new Map([
      [
        CATALOG_SOURCE.url,
        new InMemoryCatalogStore({
          [CATALOG_SOURCE.url]: {
            name: 'team-catalog',
            skills: [
              {
                name: 'catalog-python-skill',
                description: 'Python tool from team catalog',
                source: { type: 'url', url: 'https://catalog.test/python' },
                tags: ['python'],
              },
            ],
          },
        }),
      ],
    ]);
    ctx.githubSearch = new InMemoryGitHubSearch([
      {
        name: 'owner/python-skill',
        description: 'Community python skill',
        source: { type: 'github', repo: 'owner/python-skill' },
        tags: ['mcp-skill'],
        score: 10,
        installable: true,
      },
    ]);
    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.local).toHaveLength(1);
    expect(parsed.catalogs['catalog.test-skills.json']).toHaveLength(1);
    expect(parsed.github).toHaveLength(1);
    expect(parsed.offline).toBe(false);
  });

  it('applies frecency blending to reorder local results', async () => {
    const usageStore = new InMemoryUsageStore();
    usageStore.recordAccess('security-baseline');
    usageStore.recordAccess('tdd-python');
    usageStore.recordAccess('tdd-python');
    usageStore.recordAccess('tdd-python');

    const ctx = makeContext({ usageStore });
    await ctx.searchIndex.rebuild([
      { name: 'security-baseline', description: 'python security flow' },
      { name: 'tdd-python', description: 'python testing flow' },
    ]);

    const result = await handleSearchSkills({ query: 'python', sources: ['local'] }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.local).toHaveLength(2);
    expect(parsed.local[0].name).toBe('tdd-python');
    expect(parsed.local[0].score).toBeGreaterThan(parsed.local[1].score);
  });

  it('respects sources filter and excludes catalog/github when omitted', async () => {
    const ctx = makeContext();
    ctx.catalogStores = new Map([[CATALOG_SOURCE.url, new InMemoryCatalogStore()]]);
    ctx.githubSearch = new InMemoryGitHubSearch([
      {
        name: 'owner/python-skill',
        description: 'Community python skill',
        source: { type: 'github', repo: 'owner/python-skill' },
        tags: ['mcp-skill'],
        score: 10,
        installable: true,
      },
    ]);

    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    const result = await handleSearchSkills({ query: 'python', sources: ['local'] }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.local).toHaveLength(1);
    expect(parsed.catalogs).toEqual({});
    expect(parsed.github).toEqual([]);
  });

  it('uses catalog fetch path when refresh is true', async () => {
    class CountingCatalogStore extends InMemoryCatalogStore {
      fetchCalls = 0;
      cachedCalls = 0;

      async fetch(source: CatalogSourceConfig) {
        this.fetchCalls += 1;
        return super.fetch(source);
      }

      async getCached(source: CatalogSourceConfig) {
        this.cachedCalls += 1;
        return super.getCached(source);
      }
    }

    const store = new CountingCatalogStore({
      [CATALOG_SOURCE.url]: {
        name: 'team-catalog',
        skills: [
          {
            name: 'catalog-python-skill',
            description: 'Python tool from team catalog',
            source: { type: 'url', url: 'https://catalog.test/python' },
            tags: ['python'],
          },
        ],
      },
    });

    const ctx = makeContext({
      catalogStores: new Map([[CATALOG_SOURCE.url, store]]),
    });
    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    await handleSearchSkills({ query: 'python', sources: ['catalog'], refresh: true }, ctx);

    expect(store.fetchCalls).toBe(1);
    expect(store.cachedCalls).toBe(0);
  });

  it('resets catalog circuit breaker when refresh is true', async () => {
    const { CircuitBreaker } = await import('../../src/resilience/circuit-breaker.js');
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure();
    expect(breaker.isAllowed()).toBe(false);

    const ctx = makeContext({
      catalogStores: new Map([[CATALOG_SOURCE.url, new InMemoryCatalogStore({
        [CATALOG_SOURCE.url]: {
          name: 'team-catalog',
          skills: [
            {
              name: 'catalog-python-skill',
              description: 'Python tool from team catalog',
              source: { type: 'url', url: 'https://catalog.test/python' },
              tags: ['python'],
            },
          ],
        },
      })]]),
      resilience: {
        rateLimiters: new Map(),
        circuitBreakers: new Map([[CATALOG_SOURCE.url, breaker]]),
      },
    });
    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    await handleSearchSkills({ query: 'python', sources: ['catalog'], refresh: true }, ctx);

    expect(breaker.isAllowed()).toBe(true);
  });

  it('sets offline when remote sources are unavailable and records per-source search stats', async () => {
    const usageStore = new InMemoryUsageStore();
    const ctx = makeContext({
      usageStore,
      catalogStores: new Map([[CATALOG_SOURCE.url, new InMemoryCatalogStore()]]),
      githubSearch: new InMemoryGitHubSearch([], { available: false }),
    });
    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.offline).toBe(true);

    const stats = usageStore.getSearchStats();
    expect(stats.totalSearches).toBe(3);
    expect(stats.sourceBreakdown.local).toBe(1);
    expect(stats.sourceBreakdown.github).toBe(1);
    expect(stats.sourceBreakdown['catalog:catalog.test-skills.json']).toBe(1);
  });
});
