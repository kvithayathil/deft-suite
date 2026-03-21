import { describe, it, expect } from 'vitest';
import { handleGetStatus } from '../../src/tools/get-status.js';
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
import { CircuitBreaker } from '../../src/resilience/circuit-breaker.js';
import { TokenBucket } from '../../src/resilience/token-bucket.js';
import type { ToolContext } from '../../src/tools/context.js';
import type { ResilienceContext } from '../../src/resilience/tool-wrapper.js';

function makeContext(): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  const resilience: ResilienceContext = {
    rateLimiters: new Map([['search_skills', new TokenBucket(20, 20)]]),
    circuitBreakers: new Map([['https://github.com/org/skills.git', new CircuitBreaker()]]),
  };

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
    resilience,
  };
}

describe('handleGetStatus', () => {
  it('includes circuit breaker state in response', async () => {
    const ctx = makeContext();
    const result = await handleGetStatus({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body).toHaveProperty('circuitBreakers');
    expect(body.circuitBreakers).toHaveProperty('https://github.com/org/skills.git');
  });

  it('reports open circuit breakers', async () => {
    const ctx = makeContext();
    const breaker = ctx.resilience!.circuitBreakers.get('https://github.com/org/skills.git')!;
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    const result = await handleGetStatus({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.circuitBreakers['https://github.com/org/skills.git']).toBe('open');
  });

  it('includes access control mode', async () => {
    const ctx = makeContext();
    const result = await handleGetStatus({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.accessControl).toEqual({ mode: 'blocklist' });
  });
});
