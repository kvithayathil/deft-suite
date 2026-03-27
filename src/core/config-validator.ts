import { TrustLevel } from './types.js';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function issue(
  path: string,
  message: string,
  severity: ValidationSeverity = 'error',
  expected?: string,
  actual?: string,
): ValidationIssue {
  return { path, message, severity, expected, actual };
}

function checkType(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
  expected: string,
): boolean {
  if (expected === 'array') {
    if (!Array.isArray(value)) {
      issues.push(issue(path, `Expected an array`, 'error', 'array', typeof value));
      return false;
    }
    return true;
  }

  if (expected === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issues.push(issue(path, `Expected an object`, 'error', 'object', typeof value));
      return false;
    }
    return true;
  }

  if (typeof value !== expected) {
    issues.push(issue(path, `Expected type '${expected}'`, 'error', expected, typeof value));
    return false;
  }
  return true;
}

function checkEnum(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
  allowed: readonly string[],
): boolean {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    issues.push(
      issue(
        path,
        `Must be one of: ${allowed.join(', ')}`,
        'error',
        allowed.join(' | '),
        String(value),
      ),
    );
    return false;
  }
  return true;
}

function checkUrl(issues: ValidationIssue[], path: string, value: unknown): boolean {
  if (typeof value !== 'string') {
    issues.push(issue(path, `Expected a URL string`, 'error', 'string', typeof value));
    return false;
  }
  if (!/^https?:\/\/.+/.test(value)) {
    issues.push(issue(path, `Must be a valid HTTP(S) URL`, 'warning', 'https://...', value));
    return false;
  }
  return true;
}

function validateLocalSources(
  issues: ValidationIssue[],
  sources: unknown[],
  basePath: string,
): void {
  for (let i = 0; i < sources.length; i++) {
    const entry = sources[i] as Record<string, unknown>;
    const p = `${basePath}[${i}]`;

    if (!checkType(issues, p, entry, 'object')) continue;

    if (typeof entry.path !== 'string' || entry.path.trim().length === 0) {
      issues.push(issue(`${p}.path`, `Local source requires a non-empty 'path'`));
    }

    if (entry.trust !== undefined) {
      checkEnum(issues, `${p}.trust`, entry.trust, Object.values(TrustLevel));
    }

    if (entry.sync !== undefined) {
      checkEnum(issues, `${p}.sync`, entry.sync, ['git']);
    }
  }
}

function validateRemoteSources(
  issues: ValidationIssue[],
  sources: unknown[],
  basePath: string,
): void {
  for (let i = 0; i < sources.length; i++) {
    const entry = sources[i] as Record<string, unknown>;
    const p = `${basePath}[${i}]`;

    if (!checkType(issues, p, entry, 'object')) continue;

    checkUrl(issues, `${p}.url`, entry.url);
    checkEnum(issues, `${p}.type`, entry.type, ['git', 'hosted']);

    if (entry.trust !== undefined) {
      checkEnum(issues, `${p}.trust`, entry.trust, Object.values(TrustLevel));
    }

    if (entry.branch !== undefined && typeof entry.branch !== 'string') {
      issues.push(
        issue(`${p}.branch`, `Expected a string`, 'error', 'string', typeof entry.branch),
      );
    }

    if (entry.ref !== undefined && typeof entry.ref !== 'string') {
      issues.push(issue(`${p}.ref`, `Expected a string`, 'error', 'string', typeof entry.ref));
    }
  }
}

function validateCatalogs(issues: ValidationIssue[], sources: unknown[], basePath: string): void {
  for (let i = 0; i < sources.length; i++) {
    const entry = sources[i] as Record<string, unknown>;
    const p = `${basePath}[${i}]`;

    if (!checkType(issues, p, entry, 'object')) continue;

    checkUrl(issues, `${p}.url`, entry.url);
    checkEnum(issues, `${p}.type`, entry.type, ['git', 'static']);

    if (entry.cacheMinutes !== undefined) {
      if (typeof entry.cacheMinutes !== 'number' || entry.cacheMinutes < 0) {
        issues.push(
          issue(
            `${p}.cacheMinutes`,
            `Must be a non-negative number`,
            'error',
            'number >= 0',
            String(entry.cacheMinutes),
          ),
        );
      }
    }
  }
}

function validateSources(issues: ValidationIssue[], sources: unknown): void {
  if (!checkType(issues, 'sources', sources, 'object')) return;

  const src = sources as Record<string, unknown>;

  if (src.local !== undefined) {
    if (checkType(issues, 'sources.local', src.local, 'array')) {
      validateLocalSources(issues, src.local as unknown[], 'sources.local');
    }
  }

  if (src.remote !== undefined) {
    if (checkType(issues, 'sources.remote', src.remote, 'array')) {
      validateRemoteSources(issues, src.remote as unknown[], 'sources.remote');
    }
  }

  if (src.catalogs !== undefined) {
    if (checkType(issues, 'sources.catalogs', src.catalogs, 'array')) {
      validateCatalogs(issues, src.catalogs as unknown[], 'sources.catalogs');
    }
  }

  const knownKeys = new Set(['local', 'remote', 'catalogs']);
  for (const key of Object.keys(src)) {
    if (!knownKeys.has(key)) {
      issues.push(
        issue(
          `sources.${key}`,
          `Unknown sources key '${key}'; expected: local, remote, catalogs`,
          'warning',
        ),
      );
    }
  }
}

function validateSecurity(issues: ValidationIssue[], security: unknown): void {
  if (!checkType(issues, 'security', security, 'object')) return;

  const sec = security as Record<string, unknown>;

  if (sec.minTrustLevel !== undefined) {
    checkEnum(issues, 'security.minTrustLevel', sec.minTrustLevel, Object.values(TrustLevel));
  }

  if (sec.accessControl !== undefined) {
    if (checkType(issues, 'security.accessControl', sec.accessControl, 'object')) {
      const ac = sec.accessControl as Record<string, unknown>;
      if (ac.mode !== undefined) {
        checkEnum(issues, 'security.accessControl.mode', ac.mode, ['blocklist', 'allowlist']);
      }
    }
  }
}

function validateLogging(issues: ValidationIssue[], logging: unknown): void {
  if (!checkType(issues, 'logging', logging, 'object')) return;

  const log = logging as Record<string, unknown>;

  if (log.level !== undefined) {
    checkEnum(issues, 'logging.level', log.level, ['error', 'info', 'debug']);
  }
}

export function validateConfig(config: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!checkType(issues, '', config, 'object')) {
    return { valid: false, issues };
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.schemaVersion !== undefined && cfg.schemaVersion !== 1) {
    issues.push(
      issue('schemaVersion', `Unsupported schema version`, 'error', '1', String(cfg.schemaVersion)),
    );
  }

  if (cfg.sources !== undefined) {
    validateSources(issues, cfg.sources);
  }

  if (cfg.security !== undefined) {
    validateSecurity(issues, cfg.security);
  }

  if (cfg.logging !== undefined) {
    validateLogging(issues, cfg.logging);
  }

  // Detect legacy config shapes and provide migration hints
  if ('registries' in cfg) {
    issues.push(
      issue(
        'registries',
        `'registries' has been replaced by 'sources.catalogs'. Move your registry sources into sources.catalogs.`,
        'warning',
      ),
    );
  }

  if (Array.isArray(cfg.sources)) {
    issues.push(
      issue(
        'sources',
        `'sources' is now an object with { local, remote, catalogs } instead of a flat array. See docs/configuration.md for migration guide.`,
        'error',
      ),
    );
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return '';

  const lines: string[] = ['Config validation issues:'];
  for (const i of issues) {
    const prefix = i.severity === 'error' ? '✖ ERROR' : '⚠ WARNING';
    const location = i.path.length > 0 ? ` at '${i.path}'` : '';
    lines.push(`  ${prefix}${location}: ${i.message}`);
    if (i.expected && i.actual) {
      lines.push(`    expected: ${i.expected}, got: ${i.actual}`);
    }
  }
  return lines.join('\n');
}
