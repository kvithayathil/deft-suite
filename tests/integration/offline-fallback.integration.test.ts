import { describe, it, expect } from 'vitest';
import type { ToolContext } from '../../src/tools/context.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { makeSkill } from '../helpers/fixture-skills.js';
import { mergeConfigs } from '../../src/core/config-merger.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { handleSearchSkills } from '../../src/tools/search-skills.js';
import { handleInstallSkill } from '../../src/tools/install-skill.js';
import { handlePushSkills } from '../../src/tools/push-skills.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const logger = new NoopLogger();
  const config = mergeConfigs();
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const configStore = new InMemoryConfigStore();
  const scanner = new StubScanner();
  const searchIndex = new InMemorySearchIndex();
  const lockStore = new InMemorySkillLockStore();

  const resolver = new SkillResolver(skillStore, bundledStore, config.sources, logger);
  const trustEvaluator = new TrustEvaluator(config.security);
  const lifecycle = new SkillLifecycle(logger);
  const lockManager = new SkillLockManager(lockStore, logger);
  const manifestBuilder = new ManifestBuilder(config.manifest);

  return {
    skillStore,
    bundledStore,
    configStore,
    scanner,
    searchIndex,
    lockManager,
    lifecycle,
    resolver,
    trustEvaluator,
    manifestBuilder,
    config,
    rawConfig: {},
    logger,
    ...overrides,
  };
}

describe('Offline Fallback Integration', () => {
  describe('search_skills when offline', () => {
    it('returns results from local index with offline: true flag', async () => {
      const ctx = makeContext({ isOffline: () => true });

      // Seed the local search index with some skills
      await ctx.searchIndex.rebuild([
        { name: 'tdd-python', description: 'Python TDD patterns and pytest workflows' },
        { name: 'security-baseline', description: 'Security-aware patterns for skill authoring' },
      ]);

      const result = await handleSearchSkills({ query: 'python' }, ctx);

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.offline).toBe(true);
      expect(parsed.local).toHaveLength(1);
      expect(parsed.local[0].name).toBe('tdd-python');
      expect(parsed.catalogs).toEqual({});
      expect(parsed.github).toEqual([]);
    });

    it('returns all matching results from local index when offline', async () => {
      const ctx = makeContext({ isOffline: () => true });

      await ctx.searchIndex.rebuild([
        { name: 'tdd-python', description: 'Python TDD patterns' },
        { name: 'tdd-typescript', description: 'TypeScript TDD patterns' },
        { name: 'security-baseline', description: 'Security patterns' },
      ]);

      const result = await handleSearchSkills({ query: 'tdd' }, ctx);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.offline).toBe(true);
      expect(parsed.local).toHaveLength(2);
      expect(parsed.local.map((r: { name: string }) => r.name)).toContain('tdd-python');
      expect(parsed.local.map((r: { name: string }) => r.name)).toContain('tdd-typescript');
    });

    it('returns offline: false when online', async () => {
      const ctx = makeContext({ isOffline: () => false });

      await ctx.searchIndex.rebuild([
        { name: 'tdd-python', description: 'Python TDD patterns' },
      ]);

      const result = await handleSearchSkills({ query: 'python' }, ctx);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.offline).toBe(false);
    });
  });

  describe('push_skills when offline', () => {
    it('throws NETWORK_UNAVAILABLE error when offline', async () => {
      const ctx = makeContext({ isOffline: () => true });

      await expect(handlePushSkills({}, ctx)).rejects.toThrow(SkillMcpError);

      try {
        await handlePushSkills({}, ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(SkillMcpError);
        expect((err as SkillMcpError).code).toBe(ErrorCode.NetworkUnavailable);
      }
    });

    it('throws NETWORK_UNAVAILABLE even when online (push not yet implemented)', async () => {
      const ctx = makeContext({ isOffline: () => false });

      await expect(handlePushSkills({}, ctx)).rejects.toThrow(SkillMcpError);

      try {
        await handlePushSkills({}, ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(SkillMcpError);
        expect((err as SkillMcpError).code).toBe(ErrorCode.NetworkUnavailable);
      }
    });
  });

  describe('install_skill from bundled store when offline', () => {
    it('installs a skill from bundled store without network access', async () => {
      const ctx = makeContext({ isOffline: () => true });

      // Seed the skill in the bundled store only (not in skillStore)
      const bundledSkill = makeSkill({
        metadata: { name: 'bundled-helper', description: 'A helpful bundled skill' },
        trustLevel: TrustLevel.Bundled,
        state: SkillState.Active,
        sourcePath: '.agents/skills/bundled-helper',
      });
      (ctx.bundledStore as InstanceType<typeof InMemorySkillStore>).seed('bundled-helper', bundledSkill);

      const result = await handleInstallSkill({ skill: 'bundled-helper' }, ctx);

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.installed).toBe('bundled-helper');
    });

    it('skill is available in skillStore after installing from bundled store offline', async () => {
      const ctx = makeContext({ isOffline: () => true });

      const bundledSkill = makeSkill({
        metadata: { name: 'offline-skill', description: 'Skill installed while offline' },
        trustLevel: TrustLevel.Bundled,
        state: SkillState.Active,
        sourcePath: '.agents/skills/offline-skill',
      });
      (ctx.bundledStore as InstanceType<typeof InMemorySkillStore>).seed('offline-skill', bundledSkill);

      await handleInstallSkill({ skill: 'offline-skill' }, ctx);

      const installed = await ctx.skillStore.get('offline-skill');
      expect(installed).not.toBeNull();
      expect(installed!.metadata.name).toBe('offline-skill');
    });

    it('lock entry is created after offline install from bundled store', async () => {
      const ctx = makeContext({ isOffline: () => true });

      const bundledSkill = makeSkill({
        metadata: { name: 'cached-skill', description: 'A cached bundled skill' },
        trustLevel: TrustLevel.Bundled,
        state: SkillState.Active,
        sourcePath: '.agents/skills/cached-skill',
      });
      (ctx.bundledStore as InstanceType<typeof InMemorySkillStore>).seed('cached-skill', bundledSkill);

      await handleInstallSkill({ skill: 'cached-skill' }, ctx);

      const lockEntry = await ctx.lockManager.getEntry('cached-skill');
      expect(lockEntry).not.toBeNull();
      expect(lockEntry!.scanResult).toBe('clean');
    });

    it('lifecycle is active after offline install from bundled store', async () => {
      const ctx = makeContext({ isOffline: () => true });

      const bundledSkill = makeSkill({
        metadata: { name: 'active-skill', description: 'Skill that should be active' },
        trustLevel: TrustLevel.Bundled,
        state: SkillState.Active,
        sourcePath: '.agents/skills/active-skill',
      });
      (ctx.bundledStore as InstanceType<typeof InMemorySkillStore>).seed('active-skill', bundledSkill);

      await handleInstallSkill({ skill: 'active-skill' }, ctx);

      const state = ctx.lifecycle.getState('active-skill');
      expect(state).not.toBeNull();
      expect(state!.state).toBe(SkillState.Active);
    });
  });
});
