import type { ToolHandler } from './types.js';
import type { ToolContext } from './context.js';
import { blendScores, normalizeFrecency } from '../core/frecency.js';
import { searchCatalog } from '../core/catalog-searcher.js';
import { invalidQuery } from '../core/errors.js';
import type { LocalSearchResult, UnifiedSearchResult, CatalogSourceConfig } from '../core/types.js';
import type { CatalogStore } from '../core/ports/catalog-store.js';

interface SearchParams {
  query: string;
  limit?: number;
  sources?: Array<'local' | 'catalog' | 'github'>;
  refresh?: boolean;
}

export const handleSearchSkills: ToolHandler<SearchParams> = async (params, ctx) => {
  if (!params.query || params.query.trim().length === 0) {
    throw invalidQuery(params.query ?? '', 'Query cannot be empty');
  }

  const requestedSources = new Set(params.sources ?? ['local', 'catalog', 'github']);

  const unified: UnifiedSearchResult = {
    local: [],
    catalogs: {},
    github: [],
    offline: false,
  };

  if (requestedSources.has('local')) {
    await searchLocalSources(params, ctx, unified);
  }

  if (requestedSources.has('catalog')) {
    await searchCatalogSources(params, ctx, unified);
  }

  if (requestedSources.has('github')) {
    await searchGithubSources(params, ctx, unified);
  }

  if (ctx.isOffline?.()) {
    unified.offline = true;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(unified, null, 2) }],
  };
};

function applyLimit<T>(results: T[], limit: number | undefined): T[] {
  return typeof limit === 'number' ? results.slice(0, Math.max(0, limit)) : results;
}

async function searchLocalSources(
  params: SearchParams,
  ctx: ToolContext,
  unified: UnifiedSearchResult,
): Promise<void> {
  const localResults = await ctx.searchIndex.search(params.query, params.limit);
  const frecencyScores = normalizeFrecency(
    ctx.usageStore?.getFrecencyScores() ?? new Map<string, number>(),
  );

  const blendedResults: LocalSearchResult[] = localResults
    .map((result) => {
      const frecency = frecencyScores.get(result.name) ?? 0;
      return {
        ...result,
        score: blendScores(result.score, frecency),
        frecency,
        installed: true as const,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });

  unified.local = applyLimit(blendedResults, params.limit);

  ctx.usageStore?.recordSearch(params.query, unified.local.length, 'local');
}

async function searchCatalogSources(
  params: SearchParams,
  ctx: ToolContext,
  unified: UnifiedSearchResult,
): Promise<void> {
  const catalogs = ctx.config.sources.catalogs ?? [];
  if (catalogs.length === 0 || !ctx.catalogStores?.size) {
    return;
  }

  for (const catalogSource of catalogs) {
    const store = ctx.catalogStores.get(catalogSource.url);
    if (!store) {
      continue;
    }

    const sourceKey = getCatalogKey(catalogSource);

    if (params.refresh) {
      ctx.resilience?.circuitBreakers.get(catalogSource.url)?.reset();
    }

    await fetchCatalogSource(store, catalogSource, sourceKey, params, ctx, unified);
  }
}

async function fetchCatalogSource(
  store: CatalogStore,
  catalogSource: CatalogSourceConfig,
  sourceKey: string,
  params: SearchParams,
  ctx: ToolContext,
  unified: UnifiedSearchResult,
): Promise<void> {
  try {
    const cacheMinutes = catalogSource.cacheMinutes ?? 60;
    const shouldFetch = params.refresh || !store.isFresh(catalogSource, cacheMinutes);
    const catalog = shouldFetch
      ? await store.fetch(catalogSource)
      : ((await store.getCached(catalogSource)) ?? (await store.fetch(catalogSource)));

    const catalogResults = searchCatalog(catalog.skills, params.query, catalog.name);
    unified.catalogs[sourceKey] = applyLimit(catalogResults, params.limit);

    ctx.usageStore?.recordSearch(
      params.query,
      unified.catalogs[sourceKey].length,
      `catalog:${sourceKey}`,
    );
  } catch (error) {
    ctx.logger.debug('Catalog search source unavailable', {
      source: sourceKey,
      error: String(error),
    });
    unified.offline = true;
    await loadCachedCatalogResults(store, catalogSource, sourceKey, params, ctx, unified);
  }
}

async function loadCachedCatalogResults(
  store: CatalogStore,
  catalogSource: CatalogSourceConfig,
  sourceKey: string,
  params: SearchParams,
  ctx: ToolContext,
  unified: UnifiedSearchResult,
): Promise<void> {
  try {
    const cachedCatalog = await store.getCached(catalogSource);
    if (cachedCatalog) {
      const cachedResults = searchCatalog(cachedCatalog.skills, params.query, cachedCatalog.name);
      unified.catalogs[sourceKey] = applyLimit(cachedResults, params.limit);
    } else {
      unified.catalogs[sourceKey] = [];
    }
  } catch {
    unified.catalogs[sourceKey] = [];
  }
  ctx.usageStore?.recordSearch(
    params.query,
    unified.catalogs[sourceKey].length,
    `catalog:${sourceKey}`,
  );
}

async function searchGithubSources(
  params: SearchParams,
  ctx: ToolContext,
  unified: UnifiedSearchResult,
): Promise<void> {
  if (!ctx.githubSearch) {
    return;
  }

  if (ctx.githubSearch.isAvailable()) {
    const githubResults = await ctx.githubSearch.search(
      params.query,
      ctx.config.github?.topics ?? [],
      params.limit,
    );
    unified.github = githubResults;
    ctx.usageStore?.recordSearch(params.query, githubResults.length, 'github');
  } else {
    unified.offline = true;
    ctx.usageStore?.recordSearch(params.query, 0, 'github');
  }
}

function getCatalogKey(source: CatalogSourceConfig): string {
  return source.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
}
