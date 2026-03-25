import type { Config } from '../types.js';

export interface ConfigStore {
  load(): Promise<Partial<Config> | null>;
  save(config: Partial<Config>): Promise<void>;
  getPath(): string;
}
