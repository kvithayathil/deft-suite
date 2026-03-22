import type { CatalogEntry, RegistrySource } from '../types.js';

export interface CatalogStore {
  fetch(source: RegistrySource): Promise<CatalogEntry>;
  getCached(source: RegistrySource): Promise<CatalogEntry | null>;
  isFresh(source: RegistrySource, maxAgeMinutes: number): boolean;
  clearCache(source?: RegistrySource): void;
}
