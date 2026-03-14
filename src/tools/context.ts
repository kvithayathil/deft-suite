import type { SkillStore, ConfigStore, Scanner, SearchIndex, SkillLockStore, Logger } from '../core/ports/index.js';
import type { Config } from '../core/types.js';
import type { SkillResolver } from '../core/skill-resolver.js';
import type { TrustEvaluator } from '../core/trust-evaluator.js';
import type { SkillLifecycle } from '../core/skill-lifecycle.js';
import type { SkillLockManager } from '../core/skill-lock.js';
import type { ManifestBuilder } from '../core/manifest-builder.js';

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
  logger: Logger;
  vendorConfigOverlay?: (skillName: string, skill: import('../core/types.js').Skill) => Promise<Record<string, unknown> | undefined>;
  isOffline?: () => boolean;
}
