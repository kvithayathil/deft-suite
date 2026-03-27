import type { SkillStore, ConfigStore, Scanner, SearchIndex, Logger } from '../core/ports/index.js';
import type { Config } from '../core/types.js';
import type { SkillResolver } from '../core/skill-resolver.js';
import type { TrustEvaluator } from '../core/trust-evaluator.js';
import type { SkillLifecycle } from '../core/skill-lifecycle.js';
import type { SkillLockManager } from '../core/skill-lock.js';
import type { ManifestBuilder } from '../core/manifest-builder.js';
import type { CatalogStore } from '../core/ports/catalog-store.js';
import type { GitHubSearch } from '../core/ports/github-search.js';
import type { UsageStore } from '../core/ports/usage-store.js';

export interface ResilienceContext {
  rateLimiters: Map<string, import('../resilience/token-bucket.js').TokenBucket>;
  circuitBreakers: Map<string, import('../resilience/circuit-breaker.js').CircuitBreaker>;
}

export interface ToolContext {
  skillStore: SkillStore;
  bundledStore: SkillStore;
  configStore: ConfigStore;
  scanner: Scanner;
  searchIndex: SearchIndex;
  lockManager: SkillLockManager;
  lifecycle: SkillLifecycle;
  resolver: SkillResolver;
  trustEvaluator: TrustEvaluator;
  manifestBuilder: ManifestBuilder;
  config: Config;
  rawConfig: Partial<Config>;
  logger: Logger;
  resilience?: ResilienceContext;
  catalogStores?: Map<string, CatalogStore>;
  githubSearch?: GitHubSearch;
  usageStore?: UsageStore;
  vendorConfigOverlay?: (
    skillName: string,
    skill: import('../core/types.js').Skill,
  ) => Promise<Record<string, unknown> | undefined>;
  isOffline?: () => boolean;
  onConfigReload?: () => Promise<void>;
  clientInfo?: { name?: string; version?: string };
}
