import { TrustLevel, type Config } from './types.js';

export const DEFAULT_CONFIG: Config = {
  schemaVersion: 1,
  manifest: {
    skills: ['mcp-guide', 'skill-writer', 'security-baseline', 'mcp-debug', 'git-workflows', 'cli-discovery', 'core-cli-tools'],
    maxManifestSize: 10,
    warnThreshold: 8,
  },
  sources: [],
  registries: { cacheMinutes: 60, sources: [] },
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
  logging: { level: 'error', file: '~/.cache/deft/logs/deft.log', maxFileSize: '10MB', maxFiles: 3, structured: false },
  telemetry: { enabled: false, exporterEndpoint: null, exporterProtocol: 'grpc', serviceName: 'deft-mcp', sampleRate: 1.0 },
  resilience: {
    rateLimits: {
      search_skills: { bucketSize: 20, refillPerMinute: 20 },
      install_skill: { bucketSize: 10, refillPerMinute: 10 },
      push_skills: { bucketSize: 5, refillPerMinute: 5 },
    },
  },
  backup: { enabled: false, target: 'git', interval: 'daily', onConfigChange: true },
  metadata: { createdOn: process.platform, createdBy: 'deft-mcp@1.0.0-beta', platforms: [process.platform], arch: process.arch },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Top-level array keys that use concatenation semantics (all others replace)
const CONCAT_ARRAY_KEYS = new Set(['sources', 'projectConfigPaths']);

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>, topLevel = false): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key.endsWith(':replace')) continue;
    const baseVal = base[key];
    const overrideVal = override[key];
    if (Array.isArray(baseVal) && Array.isArray(overrideVal)) {
      const replaceKey = `${key}:replace`;
      if (override[replaceKey] === true) {
        result[key] = overrideVal;
      } else if (topLevel && CONCAT_ARRAY_KEYS.has(key)) {
        result[key] = [...baseVal, ...overrideVal];
      } else {
        result[key] = overrideVal;
      }
    } else if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(baseVal, overrideVal, false);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function mergeConfigs(global?: Partial<Config> | null, project?: Partial<Config> | null): Config {
  let result = { ...DEFAULT_CONFIG } as Record<string, unknown>;
  const envOverrides = loadEnvOverrides();
  if (envOverrides) {
    result = deepMerge(result, envOverrides as Record<string, unknown>, true);
  }
  if (global) {
    result = deepMerge(result, global as Record<string, unknown>, true);
  }
  if (project) {
    result = deepMerge(result, project as Record<string, unknown>, true);
    enforceAccessControlPrecedence(result, global);
  }
  return result as unknown as Config;
}

function loadEnvOverrides(): Partial<Config> | null {
  const overrides: Record<string, unknown> = {};
  const logLevel = process.env.DEFT_LOG_LEVEL;
  if (logLevel) { overrides.logging = { level: logLevel }; }
  const minTrust = process.env.DEFT_MIN_TRUST;
  if (minTrust) { overrides.security = { minTrustLevel: minTrust }; }
  return Object.keys(overrides).length > 0 ? overrides as Partial<Config> : null;
}

function enforceAccessControlPrecedence(merged: Record<string, unknown>, global?: Partial<Config> | null): void {
  if (!global) return;
  const mergedSec = (merged as Record<string, Record<string, unknown>>).security?.accessControl as Record<string, unknown> | undefined;
  const globalSec = (global as Record<string, Record<string, unknown>>).security?.accessControl as Record<string, unknown> | undefined;
  if (!mergedSec || !globalSec) return;

  if (globalSec.mode === 'blocklist' && mergedSec.blocked && globalSec.blocked) {
    const mergedBlocked = mergedSec.blocked as Array<Record<string, unknown>>;
    const globalBlocked = globalSec.blocked as Array<Record<string, unknown>>;
    for (const entry of globalBlocked) {
      const key = (entry.url ?? entry.name) as string;
      if (!mergedBlocked.some(e => ((e.url ?? e.name) as string) === key)) {
        mergedBlocked.push(entry);
      }
    }
  }

  if (globalSec.mode === 'allowlist' && mergedSec.allowed && globalSec.allowed) {
    const globalAllowed = globalSec.allowed as Array<Record<string, unknown>>;
    const globalKeys = new Set(globalAllowed.map(e => ((e.url ?? e.name) as string)));
    mergedSec.allowed = (mergedSec.allowed as Array<Record<string, unknown>>).filter(
      e => globalKeys.has(((e.url ?? e.name) as string)),
    );
  }
}
