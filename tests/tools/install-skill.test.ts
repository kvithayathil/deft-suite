import { describe, it, expect } from 'vitest';
import { handleInstallSkill } from '../../src/tools/install-skill.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { FIXTURE_SKILLS } from '../helpers/fixture-skills.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { ErrorCode } from '../../src/core/errors.js';
import type { ToolContext } from '../../src/tools/context.js';
import { TrustLevel, SkillState, type SecurityConfig } from '../../src/core/types.js';

function makeContext(
  securityOverride?: Partial<SecurityConfig>,
  overrides: Partial<ToolContext> = {},
): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  const security = securityOverride
    ? { ...DEFAULT_CONFIG.security, ...securityOverride }
    : DEFAULT_CONFIG.security;
  return {
    skillStore,
    bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(),
    searchIndex: new InMemorySearchIndex(),
    lockManager: new SkillLockManager(new InMemorySkillLockStore(), logger),
    lifecycle: new SkillLifecycle(logger),
    resolver: new SkillResolver(skillStore, bundledStore, [], logger),
    trustEvaluator: new TrustEvaluator(security),
    manifestBuilder: new ManifestBuilder(DEFAULT_CONFIG.manifest),
    config: { ...DEFAULT_CONFIG, security },
    logger,
    ...overrides,
  };
}

describe('handleInstallSkill', () => {
  it('installs from cache successfully — resolved, scanned clean, written, lock updated, lifecycle active', async () => {
    const ctx = makeContext();

    // Seed the skill into the bundled store so resolver can find it
    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    const result = await handleInstallSkill(
      { skill: FIXTURE_SKILLS.tddPython.metadata.name },
      ctx,
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.installed).toBe('tdd-python');
    expect(parsed.registration).toContain('installed successfully');

    // Skill should be written to store
    const stored = await ctx.skillStore.exists('tdd-python');
    expect(stored).toBe(true);

    // Lock should be updated
    const lockEntry = await ctx.lockManager.getEntry('tdd-python');
    expect(lockEntry).not.toBeNull();
    expect(lockEntry?.scanResult).toBe('clean');

    // Lifecycle should be active
    const state = ctx.lifecycle.getState('tdd-python');
    expect(state?.state).toBe('active');
  });

  it('records usage access on successful install when usageStore is present', async () => {
    const usageStore = new InMemoryUsageStore();
    const ctx = makeContext(undefined, { usageStore });

    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await handleInstallSkill({ skill: 'tdd-python' }, ctx);

    const usage = usageStore.getRawData();
    expect(usage).toHaveLength(1);
    expect(usage[0].name).toBe('tdd-python');
    expect(usage[0].accessCount).toBe(1);
  });

  it('does not throw when usageStore is missing on successful install', async () => {
    const ctx = makeContext();

    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await expect(
      handleInstallSkill({ skill: 'tdd-python' }, ctx),
    ).resolves.toBeDefined();
  });

  it('rejects blocked skill (access control) — throws error', async () => {
    const ctx = makeContext({
      accessControl: {
        mode: 'blocklist',
        blocked: [{ type: 'skill', name: 'tdd-python' }],
        allowed: [],
      },
    });

    // Seed the skill so resolver could find it (but access control should block first)
    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await expect(
      handleInstallSkill({ skill: 'tdd-python' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.PermissionDenied });

    // Skill should NOT have been written
    expect(await ctx.skillStore.exists('tdd-python')).toBe(false);
  });

  it('returns ALREADY_INSTALLED for duplicate — throws when skill already exists in store', async () => {
    const ctx = makeContext();

    // Seed into skillStore (the "installed" store) to simulate already-installed
    (ctx.skillStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await expect(
      handleInstallSkill({ skill: 'tdd-python' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.AlreadyInstalled });
  });

  it('rejects skill that fails metadata validation', async () => {
    const ctx = makeContext();
    await (ctx.bundledStore as InMemorySkillStore).write('BAD-NAME', {
      metadata: { name: 'BAD-NAME', description: '' },
      content: 'body',
      resources: [],
      trustLevel: TrustLevel.Bundled,
      state: SkillState.Active,
      sourcePath: 'BAD-NAME',
    });

    await expect(
      handleInstallSkill({ skill: 'BAD-NAME' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });

  it('throws SKILL_NOT_FOUND when resolver returns null', async () => {
    const usageStore = new InMemoryUsageStore();
    const ctx = makeContext(undefined, { usageStore });

    // Do NOT seed anything — resolver will return null
    await expect(
      handleInstallSkill({ skill: 'nonexistent-skill', source: 'cache' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.SkillNotFound });

    expect(usageStore.getRawData()).toHaveLength(0);
  });

  it('quarantines skill and throws when scan fails', async () => {
    const ctx = makeContext();

    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.communitySkill.metadata.name,
      FIXTURE_SKILLS.communitySkill,
    );

    (ctx.scanner as StubScanner).failSkill('community-tool', [
      { rule: 'dangerous-exec', severity: 'critical', message: 'Dangerous exec call detected', file: 'skill.md' },
    ]);

    await expect(
      handleInstallSkill({ skill: 'community-tool' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.ScanFailed });

    // Lifecycle should be quarantined
    const state = ctx.lifecycle.getState('community-tool');
    expect(state?.state).toBe('quarantined');

    // Skill should NOT be written to store
    expect(await ctx.skillStore.exists('community-tool')).toBe(false);
  });
});
