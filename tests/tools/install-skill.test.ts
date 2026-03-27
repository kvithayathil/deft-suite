import { describe, it, expect } from 'vitest';
import { makeTestContext } from '../helpers/make-context.js';
import { handleInstallSkill } from '../../src/tools/install-skill.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { FIXTURE_SKILLS } from '../helpers/fixture-skills.js';
import { ErrorCode } from '../../src/core/errors.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';

describe('handleInstallSkill', () => {
  it('installs from cache successfully — resolved, scanned clean, written, lock updated, lifecycle active', async () => {
    const ctx = makeTestContext();

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
    const ctx = makeTestContext(undefined, { usageStore });

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
    const ctx = makeTestContext();

    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await expect(
      handleInstallSkill({ skill: 'tdd-python' }, ctx),
    ).resolves.toBeDefined();
  });

  it('rejects blocked skill (access control) — throws error', async () => {
    const ctx = makeTestContext({
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
    const ctx = makeTestContext();

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
    const ctx = makeTestContext();
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
    const ctx = makeTestContext(undefined, { usageStore });

    // Do NOT seed anything — resolver will return null
    await expect(
      handleInstallSkill({ skill: 'nonexistent-skill', source: 'cache' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.SkillNotFound });

    expect(usageStore.getRawData()).toHaveLength(0);
  });

  it('rebuilds search index after successful install', async () => {
    const ctx = makeTestContext();

    (ctx.bundledStore as InMemorySkillStore).seed(
      FIXTURE_SKILLS.tddPython.metadata.name,
      FIXTURE_SKILLS.tddPython,
    );

    await handleInstallSkill({ skill: 'tdd-python' }, ctx);

    const results = await ctx.searchIndex.search('tdd-python');
    expect(results.some((r) => r.name === 'tdd-python')).toBe(true);
  });

  it('quarantines skill and throws when scan fails', async () => {
    const ctx = makeTestContext();

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
