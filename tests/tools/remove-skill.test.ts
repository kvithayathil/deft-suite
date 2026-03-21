import { describe, it, expect } from 'vitest';
import { handleRemoveSkill } from '../../src/tools/remove-skill.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { NoopLogger } from '../helpers/noop-logger.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';
import type { ToolContext } from '../../src/tools/context.js';

function makeContext(): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  return {
    skillStore,
    bundledStore,
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

describe('handleRemoveSkill', () => {
  it('removes existing skill successfully', async () => {
    const ctx = makeContext();
    await ctx.skillStore.write('test-skill', {
      metadata: { name: 'test-skill', description: 'test' },
      content: 'body',
      resources: [],
      trustLevel: TrustLevel.Community,
      state: SkillState.Active,
      sourcePath: 'test-skill',
    });

    const result = await handleRemoveSkill({ name: 'test-skill' }, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.removed).toBe('test-skill');
  });

  it('throws SKILL_NOT_FOUND for missing skill', async () => {
    const ctx = makeContext();
    const err = await handleRemoveSkill({ name: 'nonexistent' }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.SkillNotFound);
  });

  it('throws VALIDATION_FAILED when name is empty', async () => {
    const ctx = makeContext();
    const err = await handleRemoveSkill({ name: '' }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ValidationFailed);
  });
});
