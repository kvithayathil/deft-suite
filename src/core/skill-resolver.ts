import type { SkillStore } from './ports/skill-store.js';
import type { Logger } from './ports/logger.js';
import type { Skill, Source } from './types.js';

export type SourceStrategy = 'cache' | 'bundled' | 'remote' | 'path';

export interface ResolveOptions {
  source?: SourceStrategy;
  remoteSource?: Source;
  localPath?: string;
}

export class SkillResolver {
  constructor(
    private readonly cacheStore: SkillStore,
    private readonly bundledStore: SkillStore,
    private readonly configuredSources: Source[],
    private readonly logger: Logger,
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

    // 3. Fall back to bundled
    const bundled = await this.bundledStore.get(name);
    if (bundled) {
      this.logger.debug(`Resolved '${name}' from bundled (cache + sources miss)`);
    }
    return bundled;
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
