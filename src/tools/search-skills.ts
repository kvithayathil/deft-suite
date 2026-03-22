import type { ToolHandler } from './types.js';
import { blendScores, normalizeFrecency } from '../core/frecency.js';
import { searchCatalog } from '../core/catalog-searcher.js';
import { invalidQuery } from '../core/errors.js';
import type { LocalSearchResult, UnifiedSearchResult, RegistrySource } from '../core/types.js';

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
  const limit = params.limit;

  const unified: UnifiedSearchResult = {
    local: [],
    catalogs: {},
    github: [],
    offline: false,
  };

  if (requestedSources.has('local')) {
    const localResults = await ctx.searchIndex.search(params.query, limit);
    const frecencyScores = normalizeFrecency(ctx.usageStore?.getFrecencyScores() ?? new Map<string, number>());

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

    unified.local = typeof limit === 'number'
      ? blendedResults.slice(0, Math.max(0, limit))
      : blendedResults;

    ctx.usageStore?.recordSearch(params.query, unified.local.length, 'local');
  }

  const registries = ctx.config.registries?.sources ?? [];
  if (requestedSources.has('catalog') && registries.length > 0 && ctx.catalogStores?.size) {
    for (const registry of registries) {
      const store = ctx.catalogStores.get(registry.url);
      if (!store) {
        continue;
      }

      const sourceKey = getRegistryKey(registry);

      try {
        const shouldFetch = params.refresh || !store.isFresh(registry, ctx.config.registries?.cacheMinutes ?? 60);
        const catalog = shouldFetch
          ? await store.fetch(registry)
          : await store.getCached(registry) ?? await store.fetch(registry);

        const catalogResults = searchCatalog(catalog.skills, params.query, catalog.name);
        unified.catalogs[sourceKey] = typeof limit === 'number'
          ? catalogResults.slice(0, Math.max(0, limit))
          : catalogResults;

        ctx.usageStore?.recordSearch(params.query, unified.catalogs[sourceKey].length, `catalog:${sourceKey}`);
      } catch (error) {
        ctx.logger.debug('Catalog search source unavailable', {
          source: sourceKey,
          error: String(error),
        });
        let fallbackResultsCount = 0;
        try {
          const cachedCatalog = await store.getCached(registry);
          if (cachedCatalog) {
            const cachedResults = searchCatalog(cachedCatalog.skills, params.query, cachedCatalog.name);
            unified.catalogs[sourceKey] = typeof limit === 'number'
              ? cachedResults.slice(0, Math.max(0, limit))
              : cachedResults;
            fallbackResultsCount = unified.catalogs[sourceKey].length;
          } else {
            unified.catalogs[sourceKey] = [];
          }
        } catch {
          unified.catalogs[sourceKey] = [];
        }

        unified.offline = true;
        ctx.usageStore?.recordSearch(params.query, fallbackResultsCount, `catalog:${sourceKey}`);
      }
    }
  }

  if (requestedSources.has('github') && ctx.githubSearch) {
    if (ctx.githubSearch.isAvailable()) {
      const githubResults = await ctx.githubSearch.search(
        params.query,
        ctx.config.github?.topics ?? [],
        limit,
      );
      unified.github = githubResults;
      ctx.usageStore?.recordSearch(params.query, githubResults.length, 'github');
    } else {
      unified.offline = true;
      ctx.usageStore?.recordSearch(params.query, 0, 'github');
    }
  }

  if (ctx.isOffline?.()) {
    unified.offline = true;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(unified, null, 2) }],
  };
};

function getRegistryKey(source: RegistrySource): string {
  return source.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
}
