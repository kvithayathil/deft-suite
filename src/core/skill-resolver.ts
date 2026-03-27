import type { SkillStore } from './ports/skill-store.js';
import type { CatalogStore } from './ports/catalog-store.js';
import type { Logger } from './ports/logger.js';
import type { Skill, Source, CatalogSourceConfig } from './types.js';

export type SourceStrategy = 'cache' | 'bundled' | 'remote' | 'path';

export interface ResolveOptions {
  source?: SourceStrategy;
  remoteSource?: Source;
  localPath?: string;
}

export interface CatalogResolutionOptions {
  catalogSources?: CatalogSourceConfig[];
  catalogStores?: Map<string, CatalogStore>;
}

/**
 * Parse a user-provided source string into ResolveOptions.
 * Supports:
 *   - 'cache', 'bundled' → direct strategy
 *   - Absolute paths (starting with /) → path strategy with localPath
 *   - GitHub URLs (https://github.com/owner/repo) → remote with git source
 *   - GitHub shorthand (owner/repo) → remote with git source
 */
export function parseSourceString(source: string): ResolveOptions {
  if (!source || source.trim().length === 0) {
    throw new Error('Source string cannot be empty');
  }

  const trimmed = source.trim();

  if (trimmed === 'cache' || trimmed === 'bundled') {
    return { source: trimmed };
  }

  if (trimmed.startsWith('/')) {
    return { source: 'path', localPath: trimmed };
  }

  if (trimmed.startsWith('https://github.com/')) {
    const match = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
    if (!match) {
      throw new Error(`Malformed GitHub URL: ${trimmed}`);
    }
    return {
      source: 'remote',
      remoteSource: { type: 'git', url: `https://github.com/${match[1]}/${match[2]}.git` },
    };
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    throw new Error(`Unsupported source URL scheme: ${trimmed}`);
  }

  // GitHub shorthand: owner/repo
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    return {
      source: 'remote',
      remoteSource: { type: 'git', url: `https://github.com/${shorthandMatch[1]}/${shorthandMatch[2]}.git` },
    };
  }

  throw new Error(`Unable to parse source string: ${trimmed}`);
}

export class SkillResolver {
  constructor(
    private readonly cacheStore: SkillStore,
    private readonly bundledStore: SkillStore,
    private readonly configuredSources: Source[],
    private readonly logger: Logger,
    private readonly catalog: CatalogResolutionOptions = {},
  ) {}

  async resolve(name: string, options?: ResolveOptions): Promise<Skill | null> {
    // When no source is specified, use the full resolution chain.
    // When a source is explicitly specified, only check that specific source.
    if (!options?.source) {
      return this.fromCacheThenSourcesThenBundled(name);
    }

    const source = options.source;

    switch (source) {
      case 'bundled':
        return this.fromBundled(name);
      case 'cache':
        return this.fromCacheOnly(name);
      case 'remote':
        return this.fromRemote(name, options?.remoteSource ?? null);
      case 'path':
        this.logger.debug(`Path-based resolution not yet implemented for '${name}'`);
        return null;
      default:
        return null;
    }
  }

  private async fromCacheOnly(name: string): Promise<Skill | null> {
    const skill = await this.cacheStore.get(name);
    if (skill) {
      this.logger.debug(`Resolved '${name}' from cache`);
    }
    return skill;
  }

  private async fromBundled(name: string): Promise<Skill | null> {
    const skill = await this.bundledStore.get(name);
    if (skill) {
      this.logger.debug(`Resolved '${name}' from bundled store`);
    }
    return skill;
  }

  private async fromCacheThenSourcesThenBundled(name: string): Promise<Skill | null> {
    // 1. Cache first
    const cached = await this.cacheStore.get(name);
    if (cached) {
      this.logger.debug(`Resolved '${name}' from cache`);
      return cached;
    }

    // 2. Try configured sources (spec §5: cache > configured sources > bundled)
    for (const src of this.configuredSources) {
      try {
        const fetched = await this.cacheStore.fetch(name, src);
        if (fetched) {
          this.logger.debug(`Resolved '${name}' from configured source: ${src.url}`);
          return fetched;
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch '${name}' from ${src.url}: ${err}`);
      }
    }

    // 2b. Try catalog stores
    const catalogHit = await this.fromCatalog(name);
    if (catalogHit) {
      return catalogHit;
    }

    // 3. Fall back to bundled
    const bundled = await this.bundledStore.get(name);
    if (bundled) {
      this.logger.debug(`Resolved '${name}' from bundled (cache + sources miss)`);
    }
    return bundled;
  }

  private async fromCatalog(name: string): Promise<Skill | null> {
    const catalogSources = this.catalog.catalogSources;
    const catalogStores = this.catalog.catalogStores;

    if (!catalogSources || catalogSources.length === 0 || !catalogStores || catalogStores.size === 0) {
      return null;
    }

    for (const catalogSource of catalogSources) {
      const store = catalogStores.get(catalogSource.url);
      if (!store) {
        continue;
      }

      try {
        const catalog = await store.getCached(catalogSource) ?? await store.fetch(catalogSource);
        const entry = catalog.skills.find((candidate) => candidate.name === name);
        if (!entry) {
          continue;
        }

        const resolvedSource = this.toResolverSource(entry.source);
        const fetched = await this.cacheStore.fetch(name, resolvedSource);
        if (fetched) {
          this.logger.debug(`Resolved '${name}' from catalog source: ${catalogSource.url}`);
          return fetched;
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve '${name}' from catalog ${catalogSource.url}: ${err}`);
      }
    }

    return null;
  }

  private toResolverSource(entrySource: { type: string; path?: string; url?: string }): Source {
    if (entrySource.type === 'path' && entrySource.path) {
      return { type: 'local', path: entrySource.path };
    }
    if (entrySource.url) {
      return { type: 'git', url: entrySource.url };
    }
    return { type: 'local' };
  }

  private async fromRemote(name: string, source: Source | null): Promise<Skill | null> {
    if (!source) {
      this.logger.warn(`Remote resolution requested for '${name}' but no source provided`);
      return null;
    }
    // Delegate to cache store's fetch method
    const skill = await this.cacheStore.fetch(name, source);
    if (skill) {
      this.logger.debug(`Resolved '${name}' from remote source`);
    }
    return skill;
  }
}
