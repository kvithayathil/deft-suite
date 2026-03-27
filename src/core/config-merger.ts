import { TrustLevel, type Config } from './types.js';
import { validateConfig } from './config-validator.js';

export const DEFAULT_CONFIG: Config = {
  schemaVersion: 1,
  manifest: {
    skills: [
      'mcp-guide',
      'skill-writer',
      'security-baseline',
      'mcp-debug',
      'git-workflows',
      'cli-discovery',
      'core-cli-tools',
      'agent-hooks',
    ],
    maxManifestSize: 10,
    warnThreshold: 8,
  },
  sources: { local: [], remote: [], catalogs: [] },
  github: { search: false, topics: ['mcp-skill', 'agent-skill'] },
  usage: { pruneThreshold: 10000, sessionCap: 3, ceilingPercent: 20, dbPath: '' },
  sync: { intervalMinutes: 60, autoUpdate: true },
  security: {
    minTrustLevel: TrustLevel.Community,
    scanOnInstall: true,
    periodicScanIntervalHours: 24,
    accessControl: { mode: 'blocklist', blocked: [], allowed: [] },
  },
  platformDirectories: {
    'claude-code': '.claude/deft',
    windsurf: '.windsurf/deft',
    cursor: '.cursor/deft',
    opencode: '.opencode/deft',
    zed: '.zed/deft',
    copilot: '.copilot/deft',
    default: '.agents/deft',
  },
  projectConfigPaths: ['.deft', '.claude/deft', '.agents/deft'],
  push: { remote: 'origin', branch: 'main', autoCommit: false },
  logging: {
    level: 'error',
    file: '~/.cache/deft/logs/deft.log',
    maxFileSize: '10MB',
    maxFiles: 3,
    structured: false,
  },
  telemetry: {
    enabled: false,
    exporterEndpoint: null,
    exporterProtocol: 'grpc',
    serviceName: 'deft-mcp',
    sampleRate: 1.0,
  },
  resilience: {
    rateLimits: {
      search_skills: { bucketSize: 20, refillPerMinute: 20 },
      install_skill: { bucketSize: 10, refillPerMinute: 10 },
      push_skills: { bucketSize: 5, refillPerMinute: 5 },
    },
  },
  backup: { enabled: false, target: 'git', interval: 'daily', onConfigChange: true },
  metadata: {
    createdOn: process.platform,
    createdBy: 'deft-mcp@1.0.0-beta.4',
    platforms: [process.platform],
    arch: process.arch,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Auto-migrate legacy config shapes to the current structure.
 * Mutates and returns the same object for convenience.
 *
 * Handles:
 *  - `sources` as flat array → split into `{ local, remote, catalogs }`
 *  - `registries.sources` → moved into `sources.catalogs`
 *  - `registries.cacheMinutes` → folded into each catalog entry
 */
export function migrateConfig(raw: Record<string, unknown>): Record<string, unknown> {
  // 1. Flat sources array → structured object
  if (Array.isArray(raw.sources)) {
    const local: Record<string, unknown>[] = [];
    const remote: Record<string, unknown>[] = [];

    for (const entry of raw.sources as Record<string, unknown>[]) {
      const type = entry.type as string | undefined;
      if (type === 'local' || type === 'bundled') {
        const migrated: Record<string, unknown> = {};
        if (entry.path) migrated.path = entry.path;
        if (entry.trust) migrated.trust = entry.trust;
        local.push(migrated);
      } else if (type === 'git' || type === 'registry' || type === 'hosted') {
        const migrated: Record<string, unknown> = {
          type: type === 'registry' ? 'hosted' : type,
        };
        if (entry.url) migrated.url = entry.url;
        if (entry.branch) migrated.branch = entry.branch;
        if (entry.ref) migrated.ref = entry.ref;
        if (entry.trust) migrated.trust = entry.trust;
        remote.push(migrated);
      }
    }

    raw.sources = { local, remote, catalogs: [] };
  }

  // 2. registries → sources.catalogs
  if (isPlainObject(raw.registries)) {
    const reg = raw.registries as Record<string, unknown>;
    const regSources = reg.sources as Record<string, unknown>[] | undefined;
    const cacheMinutes = reg.cacheMinutes as number | undefined;

    if (Array.isArray(regSources) && regSources.length > 0) {
      const catalogs = regSources.map((s) => {
        const migrated = { ...s };
        if (cacheMinutes !== undefined && migrated.cacheMinutes === undefined) {
          migrated.cacheMinutes = cacheMinutes;
        }
        return migrated;
      });

      // Ensure sources is an object before assigning catalogs
      if (!isPlainObject(raw.sources)) {
        raw.sources = { local: [], remote: [], catalogs };
      } else {
        (raw.sources as Record<string, unknown>).catalogs = catalogs;
      }
    }

    delete raw.registries;
  }

  return raw;
}

// Array paths that use concatenation semantics (all others replace)
const CONCAT_ARRAY_PATHS = new Set(['projectConfigPaths', 'sources.local', 'sources.remote']);

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  pathPrefix = '',
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key.endsWith(':replace')) continue;
    const baseVal = base[key];
    const overrideVal = override[key];
    const fullPath = pathPrefix.length > 0 ? `${pathPrefix}.${key}` : key;
    if (Array.isArray(baseVal) && Array.isArray(overrideVal)) {
      const replaceKey = `${key}:replace`;
      if (override[replaceKey] === true) {
        result[key] = overrideVal;
      } else if (CONCAT_ARRAY_PATHS.has(fullPath)) {
        result[key] = [...baseVal, ...overrideVal];
      } else {
        result[key] = overrideVal;
      }
    } else if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(baseVal, overrideVal, fullPath);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function mergeConfigs(
  global?: Partial<Config> | null,
  project?: Partial<Config> | null,
): Config {
  let result = { ...DEFAULT_CONFIG } as Record<string, unknown>;
  const envOverrides = loadEnvOverrides();
  if (envOverrides) {
    result = deepMerge(result, envOverrides as Record<string, unknown>);
  }
  if (global) {
    result = deepMerge(result, migrateConfig({ ...(global as Record<string, unknown>) }));
  }
  if (project) {
    result = deepMerge(result, migrateConfig({ ...(project as Record<string, unknown>) }));
    enforceAccessControlPrecedence(result, global);
  }
  return result as unknown as Config;
}

export function mergeAndValidateConfigs(
  global?: Partial<Config> | null,
  project?: Partial<Config> | null,
): { config: Config; validation: ReturnType<typeof validateConfig> } {
  const config = mergeConfigs(global, project);
  const validation = validateConfig(config);
  return { config, validation };
}

export { validateConfig, formatValidationIssues } from './config-validator.js';

function loadEnvOverrides(): Partial<Config> | null {
  const overrides: Record<string, unknown> = {};
  const logLevel = process.env.DEFT_LOG_LEVEL;
  if (logLevel) {
    overrides.logging = { level: logLevel };
  }
  const minTrust = process.env.DEFT_MIN_TRUST;
  if (minTrust) {
    overrides.security = { minTrustLevel: minTrust };
  }
  return Object.keys(overrides).length > 0 ? (overrides as Partial<Config>) : null;
}

function enforceAccessControlPrecedence(
  merged: Record<string, unknown>,
  global?: Partial<Config> | null,
): void {
  if (!global) return;
  const mergedSec = (merged as Record<string, Record<string, unknown>>).security?.accessControl as
    | Record<string, unknown>
    | undefined;
  const globalSec = (global as Record<string, Record<string, unknown>>).security?.accessControl as
    | Record<string, unknown>
    | undefined;
  if (!mergedSec || !globalSec) return;

  if (globalSec.mode === 'blocklist' && mergedSec.blocked && globalSec.blocked) {
    const mergedBlocked = mergedSec.blocked as Array<Record<string, unknown>>;
    const globalBlocked = globalSec.blocked as Array<Record<string, unknown>>;
    for (const entry of globalBlocked) {
      const key = (entry.url ?? entry.name) as string;
      if (!mergedBlocked.some((e) => ((e.url ?? e.name) as string) === key)) {
        mergedBlocked.push(entry);
      }
    }
  }

  if (globalSec.mode === 'allowlist' && mergedSec.allowed && globalSec.allowed) {
    const globalAllowed = globalSec.allowed as Array<Record<string, unknown>>;
    const globalKeys = new Set(globalAllowed.map((e) => (e.url ?? e.name) as string));
    mergedSec.allowed = (mergedSec.allowed as Array<Record<string, unknown>>).filter((e) =>
      globalKeys.has((e.url ?? e.name) as string),
    );
  }
}
