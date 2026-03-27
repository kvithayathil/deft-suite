import type { CatalogEntry, CatalogSourceConfig } from '../types.js';

export interface CatalogStore {
  fetch(source: CatalogSourceConfig): Promise<CatalogEntry>;
  getCached(source: CatalogSourceConfig): Promise<CatalogEntry | null>;
  isFresh(source: CatalogSourceConfig, maxAgeMinutes: number): boolean;
  clearCache(source?: CatalogSourceConfig): void;
  prune?(maxAgeDays: number): Promise<number>;
}
