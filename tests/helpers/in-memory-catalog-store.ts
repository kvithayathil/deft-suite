import type { CatalogStore } from '../../src/core/ports/catalog-store.js';
import type { CatalogEntry, RegistrySource } from '../../src/core/types.js';

export class InMemoryCatalogStore implements CatalogStore {
  private readonly fixtures: Record<string, CatalogEntry>;
  private readonly cache = new Map<string, CatalogEntry>();
  private fresh = true;

  constructor(fixtures: Record<string, CatalogEntry> = {}, options?: { fresh?: boolean }) {
    this.fixtures = { ...fixtures };
    this.fresh = options?.fresh ?? true;
  }

  async fetch(source: RegistrySource): Promise<CatalogEntry> {
    const entry = this.fixtures[source.url];
    if (!entry) {
      throw new Error(`Catalog fixture not found for source: ${source.url}`);
    }

    this.cache.set(source.url, entry);
    return entry;
  }

  async getCached(source: RegistrySource): Promise<CatalogEntry | null> {
    return this.cache.get(source.url) ?? this.fixtures[source.url] ?? null;
  }

  isFresh(_source: RegistrySource, _maxAgeMinutes: number): boolean {
    return this.fresh;
  }

  clearCache(source?: RegistrySource): void {
    if (!source) {
      this.cache.clear();
      return;
    }

    this.cache.delete(source.url);
  }

  setFresh(fresh: boolean): void {
    this.fresh = fresh;
  }
}
