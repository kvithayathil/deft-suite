import { describe, it, expect } from 'vitest';
import { mergeConfigs, migrateConfig, DEFAULT_CONFIG } from '../../src/core/config-merger.js';
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

  it('concatenates sources.local arrays by default', () => {
    const global: Partial<Config> = {
      sources: { local: [{ path: '/global/skills' }], remote: [], catalogs: [] },
    };
    const project: Partial<Config> = {
      sources: { local: [{ path: './project/skills' }], remote: [], catalogs: [] },
    };
    const result = mergeConfigs(global, project);
    expect(result.sources.local).toHaveLength(2);
    expect(result.sources.local[0].path).toBe('/global/skills');
    expect(result.sources.local[1].path).toBe('./project/skills');
  });

  it('concatenates sources.remote arrays by default', () => {
    const global: Partial<Config> = {
      sources: {
        local: [],
        remote: [{ url: 'https://github.com/org/a.git', type: 'git' }],
        catalogs: [],
      },
    };
    const project: Partial<Config> = {
      sources: {
        local: [],
        remote: [{ url: 'https://github.com/org/b.git', type: 'git' }],
        catalogs: [],
      },
    };
    const result = mergeConfigs(global, project);
    expect(result.sources.remote).toHaveLength(2);
    expect(result.sources.remote[0].url).toBe('https://github.com/org/a.git');
    expect(result.sources.remote[1].url).toBe('https://github.com/org/b.git');
  });

  it('replaces sources.catalogs instead of concatenating', () => {
    const global: Partial<Config> = {
      sources: {
        local: [],
        remote: [],
        catalogs: [{ url: 'https://github.com/org/one.git', type: 'git' }],
      },
    };
    const project: Partial<Config> = {
      sources: {
        local: [],
        remote: [],
        catalogs: [{ url: 'https://example.com/catalog.json', type: 'static' }],
      },
    };
    const result = mergeConfigs(global, project);
    expect(result.sources.catalogs).toEqual([
      { url: 'https://example.com/catalog.json', type: 'static' },
    ]);
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
    expect(result.sources).toEqual({ local: [], remote: [], catalogs: [] });
    expect(result.github).toEqual({ search: false, topics: ['mcp-skill', 'agent-skill'] });
    expect(result.usage).toEqual({
      pruneThreshold: 10000,
      sessionCap: 3,
      ceilingPercent: 20,
      dbPath: '',
    });
  });

  it('deep merges github partial overrides', () => {
    const project: Partial<Config> = {
      github: { search: true } as Config['github'],
    };
    const result = mergeConfigs(undefined, project);
    expect(result.github).toEqual({ search: true, topics: ['mcp-skill', 'agent-skill'] });
  });

  it('replaces sources.catalogs instead of concatenating (project overrides global)', () => {
    const global: Partial<Config> = {
      sources: {
        local: [],
        remote: [],
        catalogs: [{ type: 'git', url: 'https://github.com/org/one.git' }],
      },
    };
    const project: Partial<Config> = {
      sources: {
        local: [],
        remote: [],
        catalogs: [{ type: 'static', url: 'https://example.com/catalog.json' }],
      },
    };
    const result = mergeConfigs(global, project);
    expect(result.sources.catalogs).toEqual([
      { type: 'static', url: 'https://example.com/catalog.json' },
    ]);
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

describe('migrateConfig', () => {
  it('converts flat sources array into structured object', () => {
    const legacy = {
      sources: [
        { type: 'local', path: '/home/user/skills', trust: 'verified' },
        { type: 'git', url: 'https://github.com/org/skills.git', branch: 'main' },
        { type: 'registry', url: 'https://api.example.com/skills' },
        { type: 'bundled', path: '/opt/bundled' },
      ],
    };

    const migrated = migrateConfig({ ...legacy });

    expect(migrated.sources).toEqual({
      local: [{ path: '/home/user/skills', trust: 'verified' }, { path: '/opt/bundled' }],
      remote: [
        { type: 'git', url: 'https://github.com/org/skills.git', branch: 'main' },
        { type: 'hosted', url: 'https://api.example.com/skills' },
      ],
      catalogs: [],
    });
  });

  it('moves registries.sources into sources.catalogs with cacheMinutes folded in', () => {
    const legacy = {
      registries: {
        cacheMinutes: 30,
        sources: [
          { url: 'https://github.com/org/catalog.git', type: 'git' },
          { url: 'https://example.com/catalog.json', type: 'static' },
        ],
      },
    };

    const migrated = migrateConfig({ ...legacy });

    expect(migrated.registries).toBeUndefined();
    expect(migrated.sources).toEqual({
      local: [],
      remote: [],
      catalogs: [
        { url: 'https://github.com/org/catalog.git', type: 'git', cacheMinutes: 30 },
        { url: 'https://example.com/catalog.json', type: 'static', cacheMinutes: 30 },
      ],
    });
  });

  it('handles both flat sources and registries together', () => {
    const legacy = {
      sources: [{ type: 'local', path: './skills' }],
      registries: {
        cacheMinutes: 60,
        sources: [{ url: 'https://catalog.test/index.json', type: 'static' }],
      },
    };

    const migrated = migrateConfig({ ...legacy });

    expect(migrated.registries).toBeUndefined();
    expect(migrated.sources).toEqual({
      local: [{ path: './skills' }],
      remote: [],
      catalogs: [{ url: 'https://catalog.test/index.json', type: 'static', cacheMinutes: 60 }],
    });
  });

  it('is a no-op for already-migrated configs', () => {
    const current = {
      sources: {
        local: [{ path: '/x' }],
        remote: [{ url: 'https://y.git', type: 'git' }],
        catalogs: [{ url: 'https://z.json', type: 'static' }],
      },
    };

    const migrated = migrateConfig({ ...current });
    expect(migrated.sources).toEqual(current.sources);
  });

  it('does not add cacheMinutes if catalog entry already has one', () => {
    const legacy = {
      registries: {
        cacheMinutes: 60,
        sources: [{ url: 'https://catalog.test', type: 'static', cacheMinutes: 15 }],
      },
    };

    const migrated = migrateConfig({ ...legacy });
    const catalogs = (migrated.sources as Record<string, unknown>).catalogs as Record<
      string,
      unknown
    >[];
    expect(catalogs[0].cacheMinutes).toBe(15);
  });
});

describe('mergeConfigs with legacy input', () => {
  it('auto-migrates legacy global config before merging', () => {
    const legacyGlobal = {
      sources: [
        { type: 'local', path: '/global/skills' },
        { type: 'git', url: 'https://github.com/org/a.git' },
      ],
      registries: {
        cacheMinutes: 45,
        sources: [{ url: 'https://catalog.example.com', type: 'static' }],
      },
    } as unknown as Partial<Config>;

    const result = mergeConfigs(legacyGlobal);

    expect(result.sources.local).toEqual([{ path: '/global/skills' }]);
    expect(result.sources.remote).toEqual([{ type: 'git', url: 'https://github.com/org/a.git' }]);
    expect(result.sources.catalogs).toEqual([
      { url: 'https://catalog.example.com', type: 'static', cacheMinutes: 45 },
    ]);
  });

  it('auto-migrates legacy project config and merges with new global', () => {
    const newGlobal: Partial<Config> = {
      sources: { local: [{ path: '/global' }], remote: [], catalogs: [] },
    };
    const legacyProject = {
      sources: [{ type: 'local', path: './project' }],
    } as unknown as Partial<Config>;

    const result = mergeConfigs(newGlobal, legacyProject);

    expect(result.sources.local).toHaveLength(2);
    expect(result.sources.local[0].path).toBe('/global');
    expect(result.sources.local[1].path).toBe('./project');
  });
});
