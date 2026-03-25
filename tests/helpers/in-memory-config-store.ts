import type { ConfigStore } from '../../src/core/ports/config-store.js';
import type { Config } from '../../src/core/types.js';

export class InMemoryConfigStore implements ConfigStore {
  private config: Partial<Config> | null = null;

  constructor(initial?: Partial<Config>) {
    this.config = initial ?? null;
  }

  async load(): Promise<Partial<Config> | null> {
    return this.config;
  }

  async save(config: Partial<Config>): Promise<void> {
    this.config = config;
  }

  getPath(): string {
    return '<in-memory>';
  }
}
