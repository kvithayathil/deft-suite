import { describe, expect, it } from 'vitest';
import { wireOptionalAdapters } from '../../src/bootstrap.js';
import { mergeConfigs } from '../../src/core/config-merger.js';
import type { ToolContext } from '../../src/tools/context.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { InMemoryCatalogStore } from '../helpers/in-memory-catalog-store.js';
import { InMemoryGitHubSearch } from '../helpers/in-memory-github-search.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const logger = new NoopLogger();
  const config = mergeConfigs();
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();

  return {
    skillStore,
    bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(),
    searchIndex: new InMemorySearchIndex(),
    lockManager: new SkillLockManager(new InMemorySkillLockStore(), logger),
    lifecycle: new SkillLifecycle(logger),
    resolver: new SkillResolver(skillStore, bundledStore, config.sources, logger),
    trustEvaluator: new TrustEvaluator(config.security),
    manifestBuilder: new ManifestBuilder(config.manifest),
    config,
    logger,
    ...overrides,
  };
}

describe('wireOptionalAdapters', () => {
  it('wires usage, catalog, and github adapters from config', async () => {
    const ctx = makeContext();
    ctx.config.registries = {
      cacheMinutes: 60,
      sources: [
        { url: 'https://example.com/catalog.git', type: 'git' },
        { url: 'https://example.com/catalog.json', type: 'static' },
      ],
    };
    ctx.config.github = { search: true, topics: ['mcp'] };
    ctx.config.usage = { ...ctx.config.usage!, dbPath: 'custom-usage.db' };

    const gitStore = new InMemoryCatalogStore();
    const staticStore = new InMemoryCatalogStore();
    const githubSearch = new InMemoryGitHubSearch();
    const usageStore = new InMemoryUsageStore();

    let usagePath = '';

    await wireOptionalAdapters(ctx, {
      configDir: '/tmp/deft',
      logger: ctx.logger,
      factories: {
        createUsageStore: async (path) => {
          usagePath = path;
          return usageStore;
        },
        createGitCatalogStore: () => gitStore,
        createStaticCatalogStore: () => staticStore,
        createGitHubSearch: () => githubSearch,
      },
    });

    expect(usagePath).toBe('/tmp/deft/custom-usage.db');
    expect(ctx.usageStore).toBe(usageStore);
    expect(ctx.catalogStores?.get('https://example.com/catalog.git')).toBe(gitStore);
    expect(ctx.catalogStores?.get('https://example.com/catalog.json')).toBe(staticStore);
    expect(ctx.githubSearch).toBe(githubSearch);
  });

  it('keeps absolute usage dbPath unchanged', async () => {
    const ctx = makeContext();
    ctx.config.usage = { ...ctx.config.usage!, dbPath: '/var/tmp/usage.db' };

    let usagePath = '';
    await wireOptionalAdapters(ctx, {
      configDir: '/tmp/deft',
      logger: ctx.logger,
      factories: {
        createUsageStore: async (path) => {
          usagePath = path;
          return new InMemoryUsageStore();
        },
      },
    });

    expect(usagePath).toBe('/var/tmp/usage.db');
  });

  it('falls back gracefully when usage store creation fails', async () => {
    const ctx = makeContext();
    const logger = ctx.logger as NoopLogger;

    await wireOptionalAdapters(ctx, {
      configDir: '/tmp/deft',
      logger,
      factories: {
        createUsageStore: async () => {
          throw new Error('sqlite unavailable');
        },
      },
    });

    expect(ctx.usageStore).toBeUndefined();
    expect(
      logger.messages.some(
        (entry) => entry.level === 'warn' && entry.message.includes('Usage tracking disabled'),
      ),
    ).toBe(true);
  });
});
