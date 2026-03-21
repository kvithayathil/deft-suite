import { describe, it, expect, beforeEach } from 'vitest';
import { handleGetResource } from '../../src/tools/get-resource.js';
import { handleListCategories } from '../../src/tools/list-categories.js';
import { handleRemoveSkill } from '../../src/tools/remove-skill.js';
import { handleSaveSkill } from '../../src/tools/save-skill.js';
import { handlePushSkills } from '../../src/tools/push-skills.js';
import { handleUpdateConfig } from '../../src/tools/update-config.js';
import { handleSaveConfig } from '../../src/tools/save-config.js';
import { handleGetStatus } from '../../src/tools/get-status.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { FIXTURE_SKILLS, makeSkill } from '../helpers/fixture-skills.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { ErrorCode } from '../../src/core/errors.js';
import type { ToolContext } from '../../src/tools/context.js';

function makeContext(): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  return {
    skillStore, bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(),
    searchIndex: new InMemorySearchIndex(),
    lockManager: new SkillLockManager(new InMemorySkillLockStore(), logger),
    lifecycle: new SkillLifecycle(logger),
    resolver: new SkillResolver(skillStore, bundledStore, [], logger),
    trustEvaluator: new TrustEvaluator(DEFAULT_CONFIG.security),
    manifestBuilder: new ManifestBuilder(DEFAULT_CONFIG.manifest),
    config: { ...DEFAULT_CONFIG },
    logger,
  };
}

// --- get_resource ---

describe('handleGetResource', () => {
  it('returns resource content for existing skill and path', async () => {
    const ctx = makeContext();
    ctx.skillStore.seed('tdd-python', FIXTURE_SKILLS.tddPython);
    (ctx.skillStore as InMemorySkillStore).seedResource('tdd-python', 'examples/basic.md', '# Basic example');

    const result = await handleGetResource({ skill: 'tdd-python', path: 'examples/basic.md' }, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.skill).toBe('tdd-python');
    expect(parsed.path).toBe('examples/basic.md');
    expect(parsed.content).toBe('# Basic example');
  });

  it('throws RESOURCE_NOT_FOUND when resource path does not exist', async () => {
    const ctx = makeContext();
    ctx.skillStore.seed('tdd-python', FIXTURE_SKILLS.tddPython);

    await expect(handleGetResource({ skill: 'tdd-python', path: 'missing.md' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ResourceNotFound });
  });

  it('throws SKILL_NOT_FOUND when skill does not exist', async () => {
    const ctx = makeContext();

    await expect(handleGetResource({ skill: 'no-skill', path: 'anything.md' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.SkillNotFound });
  });

  it('throws VALIDATION_FAILED when skill param is missing', async () => {
    const ctx = makeContext();

    await expect(handleGetResource({ skill: '', path: 'anything.md' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });
});

// --- list_categories ---

describe('handleListCategories', () => {
  it('returns list of categories from the search index', async () => {
    const ctx = makeContext();
    await ctx.searchIndex.rebuild([
      { name: 'tdd-python', description: 'TDD', tags: ['testing'] },
      { name: 'security-baseline', description: 'Security', tags: ['security'] },
      { name: 'another-test', description: 'Another', tags: ['testing'] },
    ]);

    const result = await handleListCategories({}, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.categories).toContain('testing');
    expect(parsed.categories).toContain('security');
    expect(parsed.count).toBe(2);
  });

  it('returns empty list when no categories exist', async () => {
    const ctx = makeContext();

    const result = await handleListCategories({}, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.categories).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });
});

// --- remove_skill ---

describe('handleRemoveSkill', () => {
  it('removes an existing skill from store, lock, and lifecycle', async () => {
    const ctx = makeContext();
    ctx.skillStore.seed('tdd-python', FIXTURE_SKILLS.tddPython);
    ctx.lifecycle.markActive('tdd-python', 'abc123');

    const result = await handleRemoveSkill({ name: 'tdd-python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.removed).toBe('tdd-python');

    // Verify removal
    expect(await ctx.skillStore.exists('tdd-python')).toBe(false);
    expect(ctx.lifecycle.getState('tdd-python')).toBeNull();
  });

  it('throws SKILL_NOT_FOUND when skill does not exist', async () => {
    const ctx = makeContext();

    await expect(handleRemoveSkill({ name: 'no-such-skill' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.SkillNotFound });
  });

  it('throws VALIDATION_FAILED when name is missing', async () => {
    const ctx = makeContext();

    await expect(handleRemoveSkill({ name: '' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });
});

// --- save_skill ---

describe('handleSaveSkill', () => {
  it('saves a new skill and marks it active', async () => {
    const ctx = makeContext();

    const result = await handleSaveSkill(
      { name: 'my-skill', content: '# My Skill\n\nDoes things.', description: 'A custom skill' },
      ctx,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.saved).toBe('my-skill');
    expect(parsed.hash).toHaveLength(8);

    // Verify stored
    expect(await ctx.skillStore.exists('my-skill')).toBe(true);
    const entry = ctx.lifecycle.getState('my-skill');
    expect(entry?.state).toBe('active');
  });

  it('throws VALIDATION_FAILED when name is missing', async () => {
    const ctx = makeContext();

    await expect(handleSaveSkill({ name: '', content: '# content' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });

  it('throws VALIDATION_FAILED when content is missing', async () => {
    const ctx = makeContext();

    await expect(handleSaveSkill({ name: 'my-skill', content: '' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });
});

// --- push_skills ---

describe('handlePushSkills', () => {
  it('throws NETWORK_UNAVAILABLE when offline flag is set', async () => {
    const ctx = makeContext();
    ctx.isOffline = () => true;

    await expect(handlePushSkills({}, ctx))
      .rejects.toMatchObject({ code: ErrorCode.NetworkUnavailable });
  });

  it('throws NETWORK_UNAVAILABLE as placeholder when online (not yet implemented)', async () => {
    const ctx = makeContext();
    ctx.isOffline = () => false;

    await expect(handlePushSkills({}, ctx))
      .rejects.toMatchObject({ code: ErrorCode.NetworkUnavailable });
  });
});

// --- update_config ---

describe('handleUpdateConfig', () => {
  it('updates a top-level config key in session (no disk write)', async () => {
    const ctx = makeContext();

    const result = await handleUpdateConfig({ key: 'sync.autoUpdate', value: false }, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.updated).toBe('sync.autoUpdate');
    expect(parsed.persisted).toBe(false);

    // Verify in-memory change
    expect(ctx.config.sync.autoUpdate).toBe(false);
  });

  it('throws CONFIG_LOCKED for locked keys', async () => {
    const ctx = makeContext();

    await expect(handleUpdateConfig({ key: 'schemaVersion', value: 99 }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ConfigLocked });
  });

  it('throws VALIDATION_FAILED when key is missing', async () => {
    const ctx = makeContext();

    await expect(handleUpdateConfig({ key: '', value: 'x' }, ctx))
      .rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });
});

// --- save_config ---

describe('handleSaveConfig', () => {
  it('saves the current config to the config store', async () => {
    const ctx = makeContext();

    const result = await handleSaveConfig({}, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.saved).toBe(true);
    expect(parsed.path).toBe('<in-memory>');

    // Verify it was persisted
    const loaded = await ctx.configStore.load();
    expect(loaded).toBeDefined();
  });
});

// --- get_status ---

describe('handleGetStatus', () => {
  it('returns aggregated status with counts and skill states', async () => {
    const ctx = makeContext();
    ctx.skillStore.seed('tdd-python', FIXTURE_SKILLS.tddPython);
    ctx.skillStore.seed('security-baseline', FIXTURE_SKILLS.securityBaseline);
    ctx.lifecycle.markActive('tdd-python', 'hash1');
    ctx.lifecycle.beginScanning('security-baseline');

    const result = await handleGetStatus({}, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.summary.installed).toBe(2);
    expect(parsed.summary.active).toBe(1);
    expect(parsed.summary.scanning).toBe(1);
    expect(parsed.skills['tdd-python'].state).toBe('active');
    expect(parsed.skills['security-baseline'].state).toBe('scanning');
  });

  it('returns empty status when no skills are installed', async () => {
    const ctx = makeContext();

    const result = await handleGetStatus({}, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.summary.installed).toBe(0);
    expect(parsed.summary.active).toBe(0);
    expect(parsed.summary.locked).toBe(0);
    expect(Object.keys(parsed.skills)).toHaveLength(0);
  });
});
