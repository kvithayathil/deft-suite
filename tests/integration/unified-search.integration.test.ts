import { describe, it, expect } from 'vitest';
import type { ToolContext } from '../../src/tools/context.js';
import type { RegistrySource } from '../../src/core/types.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { InMemoryCatalogStore } from '../helpers/in-memory-catalog-store.js';
import { InMemoryGitHubSearch } from '../helpers/in-memory-github-search.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { handleSearchSkills } from '../../src/tools/search-skills.js';

const CATALOG_SOURCE: RegistrySource = { url: 'https://catalog.test/skills.json', type: 'static' };

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const logger = new NoopLogger();
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();

  const config = {
    ...DEFAULT_CONFIG,
    registries: {
      cacheMinutes: 60,
      sources: [CATALOG_SOURCE],
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
    logger,
    ...overrides,
  };
}

describe('Unified Search Integration', () => {
  it('returns grouped response with ordering across local, catalog, and github', async () => {
    const usageStore = new InMemoryUsageStore();
    usageStore.recordAccess('tdd-python');
    usageStore.recordAccess('tdd-python');
    usageStore.recordAccess('security-python');

    const ctx = makeContext({
      usageStore,
      catalogStores: new Map([
        [
          CATALOG_SOURCE.url,
          new InMemoryCatalogStore({
            [CATALOG_SOURCE.url]: {
              name: 'team-catalog',
              skills: [
                {
                  name: 'catalog-python-skill',
                  description: 'Python helper from team catalog',
                  source: { type: 'url', url: 'https://catalog.test/python' },
                  tags: ['python'],
                },
              ],
            },
          }),
        ],
      ]),
      githubSearch: new InMemoryGitHubSearch([
        {
          name: 'owner/python-skill',
          description: 'Community python skill',
          source: { type: 'github', repo: 'owner/python-skill' },
          tags: ['mcp-skill'],
          score: 10,
          installable: true,
        },
      ]),
    });

    await ctx.searchIndex.rebuild([
      { name: 'security-python', description: 'python security checks' },
      { name: 'tdd-python', description: 'python tdd workflows' },
    ]);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.local).toHaveLength(2);
    expect(parsed.local[0].name).toBe('tdd-python');
    expect(parsed.catalogs['catalog.test-skills.json']).toHaveLength(1);
    expect(parsed.catalogs['catalog.test-skills.json'][0].name).toBe('catalog-python-skill');
    expect(parsed.github).toHaveLength(1);
    expect(parsed.github[0].name).toBe('owner/python-skill');
    expect(parsed.offline).toBe(false);
  });

  it('updates local ranking over time as frecency changes', async () => {
    const now = Date.now();
    const usageStore = new InMemoryUsageStore([
      {
        name: 'stale-python',
        score: 8,
        firstAccessed: new Date(now - (10 * 24 * 60 * 60 * 1000)).toISOString(),
        lastAccessed: new Date(now - (10 * 24 * 60 * 60 * 1000)).toISOString(),
        accessCount: 8,
      },
      {
        name: 'recent-python',
        score: 4,
        firstAccessed: new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString(),
        lastAccessed: new Date(now - (10 * 60 * 1000)).toISOString(),
        accessCount: 4,
      },
    ]);

    const ctx = makeContext({ usageStore });
    await ctx.searchIndex.rebuild([
      { name: 'stale-python', description: 'python reference material' },
      { name: 'recent-python', description: 'python practical workflows' },
    ]);

    const before = await handleSearchSkills({ query: 'python', sources: ['local'] }, ctx);
    const beforeParsed = JSON.parse(before.content[0].text);

    expect(beforeParsed.local[0].name).toBe('recent-python');

    usageStore.recordAccess('stale-python');

    const after = await handleSearchSkills({ query: 'python', sources: ['local'] }, ctx);
    const afterParsed = JSON.parse(after.content[0].text);

    expect(afterParsed.local[0].name).toBe('stale-python');
  });
});
