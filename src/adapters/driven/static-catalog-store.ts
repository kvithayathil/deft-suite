import type { CatalogStore } from '../../core/ports/catalog-store.js';
import type { CatalogEntry, CatalogSourceConfig } from '../../core/types.js';

interface CacheEntry {
  catalog: CatalogEntry;
  fetchedAt: number;
  etag?: string;
  lastModified?: string;
}

export class StaticCatalogStore implements CatalogStore {
  private readonly cache = new Map<string, CacheEntry>();

  async fetch(source: CatalogSourceConfig): Promise<CatalogEntry> {
    const key = source.url;
    const cached = this.cache.get(key);

    const headers = new Headers();
    if (cached?.etag) {
      headers.set('If-None-Match', cached.etag);
    }
    if (cached?.lastModified) {
      headers.set('If-Modified-Since', cached.lastModified);
    }

    let response: Response;
    try {
      response = await fetch(source.url, { method: 'GET', headers });
    } catch (error) {
      throw new Error(`Failed to fetch catalog from ${source.url}: ${String(error)}`);
    }

    if (response.status === 304 && cached) {
      cached.fetchedAt = Date.now();
      this.cache.set(key, cached);
      return cached.catalog;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch catalog from ${source.url}: HTTP ${response.status}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`Failed to parse catalog from ${source.url}: ${String(error)}`);
    }

    const catalog = validateCatalogEntry(data, source.url);
    const entry: CacheEntry = {
      catalog,
      fetchedAt: Date.now(),
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined,
    };

    this.cache.set(key, entry);
    return catalog;
  }

  async getCached(source: CatalogSourceConfig): Promise<CatalogEntry | null> {
    return this.cache.get(source.url)?.catalog ?? null;
  }

  isFresh(source: CatalogSourceConfig, maxAgeMinutes: number): boolean {
    const cached = this.cache.get(source.url);
    if (!cached) {
      return false;
    }

    const ageMs = Date.now() - cached.fetchedAt;
    return ageMs <= maxAgeMinutes * 60_000;
  }

  clearCache(source?: CatalogSourceConfig): void {
    if (!source) {
      this.cache.clear();
      return;
    }

    this.cache.delete(source.url);
  }
}

function validateCatalogEntry(value: unknown, sourceUrl: string): CatalogEntry {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: expected object`);
  }

  const entry = value as Partial<CatalogEntry>;
  if (typeof entry.name !== 'string') {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: missing name`);
  }
  if (!Array.isArray(entry.skills)) {
    throw new Error(`Invalid catalog payload from ${sourceUrl}: missing skills array`);
  }

  for (const skill of entry.skills) {
    if (!skill || typeof skill !== 'object') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill item`);
    }

    const candidate = skill as {
      name?: unknown;
      description?: unknown;
      source?: unknown;
    };
    if (typeof candidate.name !== 'string' || typeof candidate.description !== 'string') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill fields`);
    }
    if (!candidate.source || typeof candidate.source !== 'object') {
      throw new Error(`Invalid catalog payload from ${sourceUrl}: invalid skill source`);
    }
  }

  return entry as CatalogEntry;
}
