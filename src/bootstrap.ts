import { isAbsolute, join } from 'node:path';
import type { Logger } from './core/ports/logger.js';
import type { ToolContext } from './tools/context.js';
import type { CatalogStore, GitHubSearch, UsageStore } from './core/ports/index.js';
import type { CatalogSourceConfig } from './core/types.js';
import type { TokenBucket } from './resilience/token-bucket.js';
import { GitCatalogStore } from './adapters/driven/git-catalog-store.js';
import { StaticCatalogStore } from './adapters/driven/static-catalog-store.js';
import { GitHubSearchAdapter } from './adapters/driven/github-search-adapter.js';

export interface OptionalAdapterFactories {
  createUsageStore?: (dbPath: string) => Promise<UsageStore>;
  createGitCatalogStore?: (baseDir: string) => CatalogStore;
  createStaticCatalogStore?: () => CatalogStore;
  createGitHubSearch?: (options: { enabled: boolean; logger: Logger; tokenBucket?: TokenBucket }) => GitHubSearch;
}

export interface WireOptionalAdaptersOptions {
  configDir: string;
  logger: Logger;
  searchRateLimiter?: TokenBucket;
  factories?: OptionalAdapterFactories;
}

const DEFAULT_CATALOG_CACHE_DIR = 'catalogs';
const DEFAULT_USAGE_DB_NAME = 'usage.db';

async function createDefaultUsageStore(dbPath: string): Promise<UsageStore> {
  const module = await import('./adapters/driven/sqlite-usage-store.js');
  return new module.SqliteUsageStore(dbPath);
}

export async function wireOptionalAdapters(
  ctx: ToolContext,
  options: WireOptionalAdaptersOptions,
): Promise<void> {
  const factories = options.factories ?? {};

  ctx.catalogStores = createCatalogStores(ctx.config.sources.catalogs ?? [], options.configDir, factories);

  if (ctx.config.github?.search === true) {
    const createGitHubSearch = factories.createGitHubSearch
      ?? ((adapterOptions: { enabled: boolean; logger: Logger; tokenBucket?: TokenBucket }) => new GitHubSearchAdapter(adapterOptions));

    ctx.githubSearch = createGitHubSearch({
      enabled: true,
      logger: options.logger,
      tokenBucket: options.searchRateLimiter,
    });
  } else {
    ctx.githubSearch = undefined;
  }

  const usagePath = resolveUsageDbPath(options.configDir, ctx.config.usage?.dbPath ?? '');
  const createUsageStore = factories.createUsageStore ?? createDefaultUsageStore;

  try {
    ctx.usageStore = await createUsageStore(usagePath);
  } catch (error) {
    options.logger.warn('Usage tracking disabled: sqlite adapter unavailable', {
      path: usagePath,
      error: String(error),
    });
    ctx.usageStore = undefined;
  }
}

function resolveUsageDbPath(configDir: string, configuredPath: string): string {
  const trimmed = configuredPath.trim();
  if (trimmed.length === 0) {
    return join(configDir, DEFAULT_USAGE_DB_NAME);
  }

  return isAbsolute(trimmed)
    ? trimmed
    : join(configDir, trimmed);
}

function createCatalogStores(
  sources: CatalogSourceConfig[],
  configDir: string,
  factories: OptionalAdapterFactories,
): Map<string, CatalogStore> | undefined {
  if (sources.length === 0) {
    return undefined;
  }

  const stores = new Map<string, CatalogStore>();
  const createGitCatalogStore = factories.createGitCatalogStore
    ?? ((baseDir: string) => new GitCatalogStore(baseDir));
  const createStaticCatalogStore = factories.createStaticCatalogStore
    ?? (() => new StaticCatalogStore());

  for (const source of sources) {
    if (source.type === 'git') {
      stores.set(source.url, createGitCatalogStore(join(configDir, DEFAULT_CATALOG_CACHE_DIR)));
      continue;
    }

    stores.set(source.url, createStaticCatalogStore());
  }

  return stores;
}
