import { InMemorySkillStore } from './in-memory-skill-store.js';
import { InMemoryConfigStore } from './in-memory-config-store.js';
import { StubScanner } from './stub-scanner.js';
import { InMemorySearchIndex } from './in-memory-search-index.js';
import { InMemorySkillLockStore } from './in-memory-skill-lock-store.js';
import { NoopLogger } from './noop-logger.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';
import type { ToolContext } from '../../src/tools/context.js';
import type { SecurityConfig } from '../../src/core/types.js';

export function makeTestContext(
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
