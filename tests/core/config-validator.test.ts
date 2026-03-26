import { describe, it, expect } from 'vitest';
import { validateConfig, formatValidationIssues } from '../../src/core/config-validator.js';

describe('validateConfig', () => {
  it('returns valid for empty object (minimal config)', () => {
    const result = validateConfig({});
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns invalid for non-object config', () => {
    const result = validateConfig('not an object');
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain('Expected an object');
  });

  it('returns invalid for null config', () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for array config', () => {
    const result = validateConfig([]);
    expect(result.valid).toBe(false);
  });

  it('validates schemaVersion must be 1', () => {
    const result = validateConfig({ schemaVersion: 2 });
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toBe('schemaVersion');
  });

  it('accepts schemaVersion 1', () => {
    const result = validateConfig({ schemaVersion: 1 });
    expect(result.valid).toBe(true);
  });

  describe('sources validation', () => {
    it('rejects non-object sources', () => {
      const result = validateConfig({ sources: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.issues[0].path).toBe('sources');
    });

    it('rejects array sources (legacy format)', () => {
      const result = validateConfig({ sources: [] });
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('flat array'))).toBe(true);
    });

    it('validates sources.local entries', () => {
      const result = validateConfig({
        sources: {
          local: [{ path: '' }],
        },
      });
      expect(result.issues.some(i => i.path.includes('local') && i.message.includes('path'))).toBe(true);
    });

    it('accepts valid local source', () => {
      const result = validateConfig({
        sources: {
          local: [{ path: '/some/path', trust: 'verified' }],
        },
      });
      expect(result.valid).toBe(true);
    });

    it('validates local source trust enum', () => {
      const result = validateConfig({
        sources: {
          local: [{ path: '/path', trust: 'invalid-trust' }],
        },
      });
      expect(result.issues.some(i => i.path.includes('trust'))).toBe(true);
    });

    it('validates local source sync enum', () => {
      const result = validateConfig({
        sources: {
          local: [{ path: '/path', sync: 'invalid' }],
        },
      });
      expect(result.issues.some(i => i.path.includes('sync'))).toBe(true);
    });

    it('validates sources.remote entries require url and type', () => {
      const result = validateConfig({
        sources: {
          remote: [{ url: 'not-a-url', type: 'invalid' }],
        },
      });
      expect(result.issues.some(i => i.path.includes('url'))).toBe(true);
      expect(result.issues.some(i => i.path.includes('type'))).toBe(true);
    });

    it('accepts valid remote source', () => {
      const result = validateConfig({
        sources: {
          remote: [{ url: 'https://github.com/org/repo', type: 'git' }],
        },
      });
      expect(result.valid).toBe(true);
    });

    it('validates remote source branch must be string', () => {
      const result = validateConfig({
        sources: {
          remote: [{ url: 'https://example.com', type: 'git', branch: 123 }],
        },
      });
      expect(result.issues.some(i => i.path.includes('branch'))).toBe(true);
    });

    it('validates remote source ref must be string', () => {
      const result = validateConfig({
        sources: {
          remote: [{ url: 'https://example.com', type: 'git', ref: 123 }],
        },
      });
      expect(result.issues.some(i => i.path.includes('ref'))).toBe(true);
    });

    it('validates sources.catalogs entries', () => {
      const result = validateConfig({
        sources: {
          catalogs: [{ url: 'invalid', type: 'invalid' }],
        },
      });
      expect(result.issues.some(i => i.path.includes('url'))).toBe(true);
      expect(result.issues.some(i => i.path.includes('type'))).toBe(true);
    });

    it('accepts valid catalog source', () => {
      const result = validateConfig({
        sources: {
          catalogs: [{ url: 'https://registry.example.com', type: 'static', cacheMinutes: 30 }],
        },
      });
      expect(result.valid).toBe(true);
    });

    it('validates catalog cacheMinutes must be non-negative', () => {
      const result = validateConfig({
        sources: {
          catalogs: [{ url: 'https://example.com', type: 'static', cacheMinutes: -1 }],
        },
      });
      expect(result.issues.some(i => i.path.includes('cacheMinutes'))).toBe(true);
    });

    it('warns on unknown sources keys', () => {
      const result = validateConfig({
        sources: {
          local: [],
          unknownKey: [],
        },
      });
      expect(result.issues.some(i => i.path.includes('unknownKey') && i.severity === 'warning')).toBe(true);
    });

    it('rejects non-object entries in local array', () => {
      const result = validateConfig({
        sources: {
          local: ['not-an-object'],
        },
      });
      expect(result.issues.some(i => i.path.includes('local[0]'))).toBe(true);
    });

    it('rejects non-object entries in remote array', () => {
      const result = validateConfig({
        sources: {
          remote: [null],
        },
      });
      expect(result.issues.some(i => i.path.includes('remote[0]'))).toBe(true);
    });

    it('rejects non-object entries in catalogs array', () => {
      const result = validateConfig({
        sources: {
          catalogs: [42],
        },
      });
      expect(result.issues.some(i => i.path.includes('catalogs[0]'))).toBe(true);
    });

    it('rejects non-array local', () => {
      const result = validateConfig({
        sources: { local: 'not-array' },
      });
      expect(result.issues.some(i => i.path === 'sources.local')).toBe(true);
    });

    it('rejects non-array remote', () => {
      const result = validateConfig({
        sources: { remote: {} },
      });
      expect(result.issues.some(i => i.path === 'sources.remote')).toBe(true);
    });

    it('rejects non-array catalogs', () => {
      const result = validateConfig({
        sources: { catalogs: 123 },
      });
      expect(result.issues.some(i => i.path === 'sources.catalogs')).toBe(true);
    });
  });

  describe('security validation', () => {
    it('rejects non-object security', () => {
      const result = validateConfig({ security: 'invalid' });
      expect(result.issues.some(i => i.path === 'security')).toBe(true);
    });

    it('validates minTrustLevel enum', () => {
      const result = validateConfig({
        security: { minTrustLevel: 'invalid' },
      });
      expect(result.issues.some(i => i.path.includes('minTrustLevel'))).toBe(true);
    });

    it('accepts valid minTrustLevel', () => {
      const result = validateConfig({
        security: { minTrustLevel: 'verified' },
      });
      expect(result.valid).toBe(true);
    });

    it('validates accessControl.mode enum', () => {
      const result = validateConfig({
        security: {
          accessControl: { mode: 'invalid' },
        },
      });
      expect(result.issues.some(i => i.path.includes('accessControl.mode'))).toBe(true);
    });

    it('accepts valid accessControl', () => {
      const result = validateConfig({
        security: {
          accessControl: { mode: 'blocklist' },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-object accessControl', () => {
      const result = validateConfig({
        security: { accessControl: 'invalid' },
      });
      expect(result.issues.some(i => i.path === 'security.accessControl')).toBe(true);
    });
  });

  describe('logging validation', () => {
    it('rejects non-object logging', () => {
      const result = validateConfig({ logging: [] });
      expect(result.issues.some(i => i.path === 'logging')).toBe(true);
    });

    it('validates logging.level enum', () => {
      const result = validateConfig({
        logging: { level: 'invalid' },
      });
      expect(result.issues.some(i => i.path.includes('level'))).toBe(true);
    });

    it('accepts valid logging level', () => {
      const result = validateConfig({
        logging: { level: 'debug' },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('legacy config detection', () => {
    it('warns about registries key', () => {
      const result = validateConfig({
        registries: { sources: [] },
      });
      expect(result.issues.some(i => i.path === 'registries' && i.severity === 'warning')).toBe(true);
    });
  });
});

describe('formatValidationIssues', () => {
  it('returns empty string for no issues', () => {
    expect(formatValidationIssues([])).toBe('');
  });

  it('formats error issues', () => {
    const output = formatValidationIssues([
      { path: 'sources', message: 'Test error', severity: 'error' },
    ]);
    expect(output).toContain('ERROR');
    expect(output).toContain('sources');
    expect(output).toContain('Test error');
  });

  it('formats warning issues', () => {
    const output = formatValidationIssues([
      { path: 'registries', message: 'Deprecated', severity: 'warning' },
    ]);
    expect(output).toContain('WARNING');
  });

  it('includes expected/actual when present', () => {
    const output = formatValidationIssues([
      { path: 'test', message: 'Type mismatch', severity: 'error', expected: 'string', actual: 'number' },
    ]);
    expect(output).toContain('expected: string');
    expect(output).toContain('got: number');
  });

  it('handles empty path', () => {
    const output = formatValidationIssues([
      { path: '', message: 'Root error', severity: 'error' },
    ]);
    expect(output).toContain('Root error');
    expect(output).not.toContain("at ''");
  });
});
