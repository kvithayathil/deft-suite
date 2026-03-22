import { describe, it, expect } from 'vitest';
import { mergeConfigs, DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { TrustLevel } from '../../src/core/types.js';
import type { Config } from '../../src/core/types.js';

describe('mergeConfigs', () => {
  it('returns defaults when no overrides', () => {
    const result = mergeConfigs();
    expect(result.schemaVersion).toBe(1);
    expect(result.manifest.maxManifestSize).toBe(10);
    expect(result.security.minTrustLevel).toBe(TrustLevel.Community);
  });

  it('global overrides defaults', () => {
    const global: Partial<Config> = {
      manifest: { skills: ['my-skill'], maxManifestSize: 15, warnThreshold: 12 },
    };
    const result = mergeConfigs(global);
    expect(result.manifest.skills).toEqual(['my-skill']);
    expect(result.manifest.maxManifestSize).toBe(15);
  });

  it('project overrides global', () => {
    const global: Partial<Config> = {
      manifest: { skills: ['global-skill'], maxManifestSize: 15, warnThreshold: 12 },
    };
    const project: Partial<Config> = {
      manifest: { skills: ['project-skill'], maxManifestSize: 5, warnThreshold: 4 },
    };
    const result = mergeConfigs(global, project);
    expect(result.manifest.skills).toEqual(['project-skill']);
    expect(result.manifest.maxManifestSize).toBe(5);
  });

  it('concatenates source arrays by default', () => {
    const global: Partial<Config> = {
      sources: [{ type: 'git', url: 'https://github.com/org/a.git' }],
    };
    const project: Partial<Config> = {
      sources: [{ type: 'local', path: './custom' }],
    };
    const result = mergeConfigs(global, project);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].url).toBe('https://github.com/org/a.git');
    expect(result.sources[1].path).toBe('./custom');
  });

  it('replaces arrays when :replace flag is set', () => {
    const global: Partial<Config> = {
      sources: [{ type: 'git', url: 'https://github.com/org/a.git' }],
    };
    const project = {
      sources: [{ type: 'local' as const, path: './only-this' }],
      'sources:replace': true,
    };
    const result = mergeConfigs(global, project as Partial<Config>);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].path).toBe('./only-this');
  });

  it('deep merges nested objects', () => {
    const global: Partial<Config> = {
      security: { minTrustLevel: TrustLevel.Community } as Config['security'],
    };
    const project: Partial<Config> = {
      security: { scanOnInstall: false } as Config['security'],
    };
    const result = mergeConfigs(global, project);
    expect(result.security.minTrustLevel).toBe(TrustLevel.Community);
    expect(result.security.scanOnInstall).toBe(false);
  });

  it('includes unified search defaults', () => {
    const result = mergeConfigs();
    expect(result.registries).toEqual({ cacheMinutes: 60, sources: [] });
    expect(result.github).toEqual({ search: false, topics: ['mcp-skill', 'agent-skill'] });
    expect(result.usage).toEqual({ pruneThreshold: 10000, sessionCap: 3, ceilingPercent: 20, dbPath: '' });
  });

  it('deep merges github partial overrides', () => {
    const project: Partial<Config> = {
      github: { search: true } as Config['github'],
    };
    const result = mergeConfigs(undefined, project);
    expect(result.github).toEqual({ search: true, topics: ['mcp-skill', 'agent-skill'] });
  });

  it('replaces registries.sources instead of concatenating', () => {
    const global: Partial<Config> = {
      registries: {
        cacheMinutes: 60,
        sources: [{ type: 'git', url: 'https://github.com/org/one.git' }],
      },
    };
    const project: Partial<Config> = {
      registries: {
        cacheMinutes: 30,
        sources: [{ type: 'static', url: 'https://example.com/catalog.json' }],
      },
    };
    const result = mergeConfigs(global, project);
    expect(result.registries?.cacheMinutes).toBe(30);
    expect(result.registries?.sources).toEqual([{ type: 'static', url: 'https://example.com/catalog.json' }]);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has schemaVersion 1', () => {
    expect(DEFAULT_CONFIG.schemaVersion).toBe(1);
  });

  it('has sensible manifest defaults', () => {
    expect(DEFAULT_CONFIG.manifest.maxManifestSize).toBe(10);
    expect(DEFAULT_CONFIG.manifest.warnThreshold).toBe(8);
  });

  it('has bundled skills in manifest', () => {
    expect(DEFAULT_CONFIG.manifest.skills).toContain('mcp-guide');
    expect(DEFAULT_CONFIG.manifest.skills).toContain('skill-writer');
    expect(DEFAULT_CONFIG.manifest.skills).toContain('security-baseline');
  });

  it('defaults to blocklist access control', () => {
    expect(DEFAULT_CONFIG.security.accessControl.mode).toBe('blocklist');
  });

  it('has telemetry disabled', () => {
    expect(DEFAULT_CONFIG.telemetry.enabled).toBe(false);
  });
});
