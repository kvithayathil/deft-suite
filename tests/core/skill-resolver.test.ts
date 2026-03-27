import { describe, it, expect } from 'vitest';
import {
  SkillResolver,
  parseSourceString,
  type ResolveOptions,
  type CatalogResolutionOptions,
} from '../../src/core/skill-resolver.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { FIXTURE_SKILLS } from '../helpers/fixture-skills.js';
import type { Source, CatalogEntry, CatalogSourceConfig } from '../../src/core/types.js';
import type { CatalogStore } from '../../src/core/ports/catalog-store.js';

describe('SkillResolver', () => {
  function setup(configuredSources: Source[] = [], catalog?: CatalogResolutionOptions) {
    const cacheStore = new InMemorySkillStore();
    const bundledStore = new InMemorySkillStore();
    const logger = new NoopLogger();
    const resolver = new SkillResolver(
      cacheStore,
      bundledStore,
      configuredSources,
      logger,
      catalog,
    );
    return { resolver, cacheStore, bundledStore, logger };
  }

  it('resolves from cache first by default', async () => {
    const { resolver, cacheStore } = setup();
    await cacheStore.write('tdd-python', FIXTURE_SKILLS.tddPython);

    const result = await resolver.resolve('tdd-python');
    expect(result).not.toBeNull();
    expect(result!.metadata.name).toBe('tdd-python');
  });

  it('checks configured sources after cache miss', async () => {
    const configuredSources: Source[] = [
      { type: 'git', url: 'https://github.com/example/skills.git' },
    ];
    const { resolver, cacheStore } = setup(configuredSources);

    // Skill is not in cache or bundled, so resolver attempts configured sources.
    // Since InMemorySkillStore.fetch stubs remote, we seed it to simulate a hit.
    await cacheStore.seed('remote-skill', FIXTURE_SKILLS.tddPython);

    const result = await resolver.resolve('remote-skill');
    // In a real scenario, configured sources would be tried.
    // This test verifies the resolution chain includes them.
    expect(result).not.toBeNull();
  });

  it('falls back to bundled if not in cache or configured sources', async () => {
    const { resolver, bundledStore } = setup();
    await bundledStore.write('mcp-guide', FIXTURE_SKILLS.securityBaseline);

    const result = await resolver.resolve('mcp-guide');
    expect(result).not.toBeNull();
  });

  it('returns null if skill not found anywhere', async () => {
    const { resolver } = setup();
    const result = await resolver.resolve('nonexistent');
    expect(result).toBeNull();
  });

  it('respects source: "bundled" — only checks bundled store', async () => {
    const { resolver, cacheStore } = setup();
    await cacheStore.write('tdd-python', FIXTURE_SKILLS.tddPython);

    const result = await resolver.resolve('tdd-python', { source: 'bundled' });
    expect(result).toBeNull(); // Not in bundled store
  });

  it('respects source: "cache" — only checks cache store', async () => {
    const { resolver, cacheStore, bundledStore } = setup();
    await bundledStore.write('mcp-guide', FIXTURE_SKILLS.securityBaseline);

    const result = await resolver.resolve('mcp-guide', { source: 'cache' });
    expect(result).toBeNull(); // Not in cache store
  });

  describe('catalog resolution', () => {
    function makeCatalogStore(catalog: CatalogEntry): CatalogStore {
      return {
        fetch: async () => catalog,
        getCached: async () => catalog,
        isFresh: () => true,
        clearCache: () => {},
      };
    }

    it('resolves skill from catalog when not in cache or configured sources', async () => {
      const catalogUrl = 'https://github.com/example/catalog.git';
      const catalogSource: CatalogSourceConfig = { url: catalogUrl, type: 'git' };
      const catalog: CatalogEntry = {
        name: 'example-catalog',
        skills: [
          {
            name: 'catalog-skill',
            description: 'from catalog',
            source: { type: 'path', path: 'skills/catalog-skill' },
          },
        ],
      };

      const store = makeCatalogStore(catalog);
      const catalogStores = new Map<string, CatalogStore>([[catalogUrl, store]]);

      const { resolver, cacheStore } = setup([], {
        catalogSources: [catalogSource],
        catalogStores,
      });

      // Seed the skill so cacheStore.fetch can find it via the resolved source
      cacheStore.seed('catalog-skill', FIXTURE_SKILLS.tddPython);

      const result = await resolver.resolve('catalog-skill');
      expect(result).not.toBeNull();
      expect(result!.metadata.name).toBe('tdd-python');
    });

    it('returns null when catalog has no matching skill', async () => {
      const catalogUrl = 'https://github.com/example/empty.git';
      const catalogSource: CatalogSourceConfig = { url: catalogUrl, type: 'git' };
      const catalog: CatalogEntry = { name: 'empty', skills: [] };

      const store = makeCatalogStore(catalog);
      const catalogStores = new Map<string, CatalogStore>([[catalogUrl, store]]);

      const { resolver } = setup([], {
        catalogSources: [catalogSource],
        catalogStores,
      });

      const result = await resolver.resolve('nonexistent');
      expect(result).toBeNull();
    });

    it('skips catalog resolution when no catalog stores configured', async () => {
      const { resolver } = setup();
      const result = await resolver.resolve('anything');
      expect(result).toBeNull();
    });
  });

  describe('parseSourceString', () => {
    it('parses "cache" as cache strategy', () => {
      expect(parseSourceString('cache')).toEqual({ source: 'cache' });
    });

    it('parses "bundled" as bundled strategy', () => {
      expect(parseSourceString('bundled')).toEqual({ source: 'bundled' });
    });

    it('parses absolute path as path strategy', () => {
      const result = parseSourceString('/home/user/skills');
      expect(result.source).toBe('path');
      expect(result.localPath).toBe('/home/user/skills');
    });

    it('parses GitHub URL into remote git source', () => {
      const result = parseSourceString('https://github.com/acme/skills');
      expect(result.source).toBe('remote');
      expect(result.remoteSource).toEqual({
        type: 'git',
        url: 'https://github.com/acme/skills.git',
      });
    });

    it('parses GitHub URL with .git suffix', () => {
      const result = parseSourceString('https://github.com/acme/skills.git');
      expect(result.source).toBe('remote');
      expect(result.remoteSource?.url).toBe('https://github.com/acme/skills.git');
    });

    it('parses GitHub shorthand (owner/repo)', () => {
      const result = parseSourceString('acme/my-skills');
      expect(result.source).toBe('remote');
      expect(result.remoteSource).toEqual({
        type: 'git',
        url: 'https://github.com/acme/my-skills.git',
      });
    });

    it('throws on empty string', () => {
      expect(() => parseSourceString('')).toThrow('empty');
    });

    it('throws on whitespace-only string', () => {
      expect(() => parseSourceString('   ')).toThrow('empty');
    });

    it('throws on malformed GitHub URL (no repo)', () => {
      expect(() => parseSourceString('https://github.com/acme')).toThrow('Malformed GitHub URL');
    });

    it('throws on unsupported URL scheme', () => {
      expect(() => parseSourceString('https://gitlab.com/acme/repo')).toThrow(
        'Unsupported source URL',
      );
    });

    it('throws on unrecognized format', () => {
      expect(() => parseSourceString('not-a-valid-source')).toThrow('Unable to parse');
    });
  });
});
