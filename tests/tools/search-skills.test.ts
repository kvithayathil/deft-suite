import { describe, it, expect } from 'vitest';
import { handleSearchSkills } from '../../src/tools/search-skills.js';
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

describe('handleSearchSkills', () => {
  it('returns matching skills', async () => {
    const ctx = makeContext();
    await ctx.searchIndex.rebuild([
      FIXTURE_SKILLS.tddPython.metadata,
      FIXTURE_SKILLS.securityBaseline.metadata,
    ]);

    const result = await handleSearchSkills({ query: 'python' }, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].name).toBe('tdd-python');
  });

  it('returns empty results for no match', async () => {
    const ctx = makeContext();
    await ctx.searchIndex.rebuild([FIXTURE_SKILLS.tddPython.metadata]);

    const result = await handleSearchSkills({ query: 'zzz-nothing' }, ctx);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.results).toHaveLength(0);
  });
});
