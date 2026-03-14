import { describe, it, expect } from 'vitest';
import { handleGetSkill } from '../../src/tools/get-skill.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { FIXTURE_SKILLS } from '../helpers/fixture-skills.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { ErrorCode } from '../../src/core/errors.js';
import { SkillState } from '../../src/core/types.js';
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
    config: DEFAULT_CONFIG,
    logger,
  };
}

describe('handleGetSkill', () => {
  it('returns active skill with content, trust indicator, and resources', async () => {
    const ctx = makeContext();
    const skill = FIXTURE_SKILLS.tddPython;
    (ctx.skillStore as InMemorySkillStore).seed(skill.metadata.name, skill);
    ctx.lifecycle.markActive(skill.metadata.name, 'abc123');

    const result = await handleGetSkill({ name: skill.metadata.name }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.name).toBe('tdd-python');
    expect(parsed.trust).toContain('verified');
    expect(parsed.content).toBe(skill.content);
    expect(parsed.resources).toEqual(skill.resources);
    expect(parsed.stale).toBe(false);
  });

  it('returns stale version during scanning (skill previously active, now scanning)', async () => {
    const ctx = makeContext();
    const skill = FIXTURE_SKILLS.securityBaseline;
    (ctx.skillStore as InMemorySkillStore).seed(skill.metadata.name, skill);
    // First mark active, then begin scanning — lifecycle enters scanning with previousHash set
    ctx.lifecycle.markActive(skill.metadata.name, 'prev-hash-123');
    ctx.lifecycle.beginScanning(skill.metadata.name);

    const result = await handleGetSkill({ name: skill.metadata.name }, ctx);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.name).toBe('security-baseline');
    expect(parsed.stale).toBe(true);
  });

  it('throws SKILL_QUARANTINED for quarantined skill', async () => {
    const ctx = makeContext();
    const skill = FIXTURE_SKILLS.unknownSkill;
    (ctx.skillStore as InMemorySkillStore).seed(skill.metadata.name, skill);
    ctx.lifecycle.markActive(skill.metadata.name, 'hash-x');
    ctx.lifecycle.markQuarantined(skill.metadata.name, ['Dangerous instruction detected']);

    await expect(
      handleGetSkill({ name: skill.metadata.name }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.SkillQuarantined });
  });

  it('throws SKILL_NOT_FOUND for missing skill', async () => {
    const ctx = makeContext();

    await expect(
      handleGetSkill({ name: 'nonexistent-skill' }, ctx),
    ).rejects.toMatchObject({ code: ErrorCode.SkillNotFound });
  });
});
