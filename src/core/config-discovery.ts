import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './types.js';

const DEFAULT_PROJECT_CONFIG_PATHS = ['.deft', '.claude/deft', '.agents/deft'];

export interface DiscoveredConfig {
  path: string;
  config: Partial<Config>;
}

export async function discoverProjectConfig(
  projectRoot: string,
  searchPaths?: string[],
): Promise<DiscoveredConfig | null> {
  const paths = searchPaths ?? DEFAULT_PROJECT_CONFIG_PATHS;

  for (const relPath of paths) {
    const configPath = join(projectRoot, relPath, 'config.json');
    try {
      const raw = await readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as Partial<Config>;
      return { path: configPath, config };
    } catch {
      // Continue to next path.
    }
  }

  return null;
}
