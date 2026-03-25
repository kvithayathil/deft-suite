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
    rawConfig: {},
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

  it('persists rawConfig (user overrides) instead of fully merged config', async () => {
    const ctx = makeContext();
    const userOverrides = { sources: [{ type: 'git' as const, url: 'https://example.com/skills.git' }] };
    ctx.rawConfig = userOverrides;

    await handleSaveConfig({}, ctx);

    const saved = await ctx.configStore.load();
    expect(saved).toEqual(userOverrides);
  });

  it('does not duplicate CONCAT_ARRAY_KEYS across save/reload cycles (issue #6)', async () => {
    const configStore = new InMemoryConfigStore();
    const ctx = makeContext();
    (ctx as unknown as { configStore: InMemoryConfigStore }).configStore = configStore;

    ctx.rawConfig = {
      projectConfigPaths: ['.custom'],
    };

    // Simulate multiple save/reload cycles
    for (let i = 0; i < 3; i++) {
      await handleSaveConfig({}, ctx);
      // Simulate reload: load from store, update rawConfig
      const loaded = await configStore.load();
      ctx.rawConfig = loaded ?? {};
    }

    const persisted = await configStore.load();
    expect(persisted?.projectConfigPaths).toEqual(['.custom']);
  });

  it('preserves array types through save cycle — no string conversion (issue #6)', async () => {
    const ctx = makeContext();
    const sources = [{ type: 'git' as const, url: 'https://example.com/a.git' }];
    ctx.rawConfig = { sources };

    await handleSaveConfig({}, ctx);

    const saved = await ctx.configStore.load();
    expect(Array.isArray(saved?.sources)).toBe(true);
    expect(typeof saved?.sources).not.toBe('string');
    expect(saved?.sources).toEqual(sources);
  });
});
