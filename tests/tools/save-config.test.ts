import { describe, it, expect, vi } from 'vitest';
import { handleSaveConfig } from '../../src/tools/save-config.js';
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
    config: { ...DEFAULT_CONFIG },
    logger,
  };
}

describe('handleSaveConfig', () => {
  it('saves config and calls onConfigReload', async () => {
    const ctx = makeContext();
    const reloadFn = vi.fn(async () => {});
    ctx.onConfigReload = reloadFn;

    const result = await handleSaveConfig({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe(true);
    expect(reloadFn).toHaveBeenCalledOnce();
  });

  it('saves config without error when onConfigReload is not set', async () => {
    const ctx = makeContext();
    const result = await handleSaveConfig({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe(true);
  });
});
