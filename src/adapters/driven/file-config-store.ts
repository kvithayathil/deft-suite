import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ConfigStore } from '../../core/ports/config-store.js';
import type { Config } from '../../core/types.js';

export class FileConfigStore implements ConfigStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Partial<Config> | null> {
    try {
      return this.expandEnvVars(
        JSON.parse(await readFile(this.filePath, 'utf-8')),
      ) as Partial<Config>;
    } catch {
      return null;
    }
  }

  async save(config: Partial<Config>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  getPath(): string {
    return this.filePath;
  }

  private expandEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string')
      return obj.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, n) => process.env[n] ?? `$${n}`);
    if (Array.isArray(obj)) return obj.map((i) => this.expandEnvVars(i));
    if (typeof obj === 'object' && obj !== null) {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) r[k] = this.expandEnvVars(v);
      return r;
    }
    return obj;
  }
}
