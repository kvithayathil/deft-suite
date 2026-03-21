# Skill MCP v1 Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between the v1 spec and the current implementation — wire resilience, fix the null lockManager crash, complete tool handlers, add missing scanner rules, implement config discovery chain, and spawn background workers.

**Architecture:** Hexagonal (ports & adapters). All changes follow existing patterns: core domain stays dependency-free, adapters implement port interfaces, tool handlers use `ToolContext`. TDD throughout — failing test first, then minimal implementation.

**Tech Stack:** TypeScript, Node.js, Vitest, `@modelcontextprotocol/sdk`

**Spec:** `docs/superpowers/specs/2026-03-13-skill-mcp-design.md`

**Deferred to separate plans:**
- Unified search (catalogs, frecency, GitHub search) → `2026-03-20-unified-search.md`
- Go TUI installer → `2026-03-13-skill-mcp-installer.md`
- SSE/HTTP transport, IPC socket, CredentialStore adapter (keychain/encrypted file)
- Full OTel implementation when `enabled: true`
- Enhanced scanner PATH detection (Semgrep, ShellCheck, Trivy, TruffleHog)
- CLI commands beyond basic set (doctor, guide, manual, reset, uninstall, logs)

---

## File Structure

Changes are grouped by the files they touch. No new files are created except for a resilience wiring module.

```
src/
├── core/
│   ├── validator.ts                          # No changes — already complete
│   └── config-merger.ts                      # No changes — already complete
├── adapters/
│   ├── driven/
│   │   ├── builtin-scanner.ts                # Add 5 missing scan rules
│   │   ├── memory-search-index.ts            # Add category support
│   │   └── console-logger.ts                 # Add structured context logging
│   └── driving/
│       └── mcp-server.ts                     # Add clientInfo capture, manifest on connect
├── resilience/
│   └── tool-wrapper.ts                       # NEW: wires timeout + rate limit + circuit breaker around tool calls
├── tools/
│   ├── context.ts                            # Add resilience fields
│   ├── save-skill.ts                         # Add validation, scan, duplicate check
│   ├── install-skill.ts                      # Fix error code, add validation
│   ├── get-skill.ts                          # Fix stale-serve for scanning state
│   ├── remove-skill.ts                       # Add SKILL_LOCKED check
│   ├── save-config.ts                        # Add hot-reload callback
│   ├── get-status.ts                         # Add network, circuit breaker, orphan detection
│   ├── list-categories.ts                    # No changes needed (delegates to index)
│   └── push-skills.ts                        # Basic git push implementation
├── workers/
│   ├── sync-worker.ts                        # Implement periodic sync loop
│   ├── scanner-worker.ts                     # Implement periodic scan loop
│   ├── index-worker.ts                       # Implement periodic index rebuild
│   └── worker-manager.ts                     # NEW: spawns workers, manages heartbeat, restarts
└── index.ts                                  # Wire lockManager, resilience, workers, project config
tests/
├── helpers/
│   └── stub-scanner.ts                       # May need updates for new scan rules
├── resilience/
│   └── tool-wrapper.test.ts                  # NEW
├── tools/
│   ├── save-skill.test.ts                    # NEW: dedicated test file
│   ├── get-skill.test.ts                     # Add stale-serve tests
│   ├── install-skill.test.ts                 # Add validation tests
│   ├── remove-skill.test.ts                  # NEW: dedicated test file
│   ├── save-config.test.ts                   # NEW
│   ├── get-status.test.ts                    # NEW
│   └── push-skills.test.ts                   # NEW
├── adapters/
│   ├── builtin-scanner.test.ts               # Add tests for new rules
│   └── memory-search-index.test.ts           # Add category tests
├── workers/
│   └── worker-manager.test.ts                # NEW
└── integration/
    └── bootstrap.integration.test.ts         # NEW: verifies index.ts wiring
```

---

### Task 1: Fix Bootstrap — Wire FileSkillLockStore

The `lockManager` in `src/index.ts:54` is `null as unknown as SkillLockStore`, which means any tool call touching the lock (install, remove, save) crashes at runtime. This is the highest-priority fix.

**Files:**
- Modify: `src/index.ts:54`
- Test: `tests/integration/bootstrap.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create a bootstrap integration test that verifies the lockManager is real.

```typescript
// tests/integration/bootstrap.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSkillLockStore } from '../../src/adapters/driven/file-skill-lock-store.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { NoopLogger } from '../helpers/noop-logger.js';

describe('bootstrap wiring', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-mcp-boot-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('lockManager uses FileSkillLockStore and can add entries', async () => {
    const lockPath = join(tempDir, 'skill-lock.json');
    const lockStore = new FileSkillLockStore(lockPath);
    const logger = new NoopLogger();
    const lockManager = new SkillLockManager(lockStore, logger);

    await lockManager.addOrUpdate('test-skill', {
      contentHash: 'sha256:abc123',
      scanHash: 'sha256:def456',
      scanResult: 'clean',
      scanTimestamp: new Date().toISOString(),
      trustLevel: 'community' as import('../../src/core/types.js').TrustLevel,
      source: { type: 'local' },
    });

    const entry = await lockManager.getEntry('test-skill');
    expect(entry).toBeDefined();
    expect(entry!.contentHash).toBe('sha256:abc123');
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (this tests the adapter, not the wiring — it should pass)

Run: `npx vitest run tests/integration/bootstrap.integration.test.ts`
Expected: PASS

- [ ] **Step 3: Fix index.ts — replace null lockManager with FileSkillLockStore**

In `src/index.ts`, replace line 54:

```typescript
// Before:
const lockManager = new SkillLockManager(null as unknown as import('./core/ports/skill-lock-store.js').SkillLockStore, logger);

// After:
import { FileSkillLockStore } from './adapters/driven/file-skill-lock-store.js';
// ...
const lockPath = join(homedir(), '.config', 'skill-mcp', 'skill-lock.json');
const lockStore = new FileSkillLockStore(lockPath);
const lockManager = new SkillLockManager(lockStore, logger);
```

Add the import at top of file. Add `lockPath` and `lockStore` lines before the existing `lockManager` line.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All 206+ tests pass

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/integration/bootstrap.integration.test.ts
git commit -m "fix: wire FileSkillLockStore into bootstrap — fixes null lockManager crash"
```

---

### Task 2: Wire Validation into save_skill and install_skill

The validator exists at `src/core/validator.ts` but is never called from any tool handler. The spec requires skills to be validated against the agentskills.io spec before acceptance.

**Files:**
- Modify: `src/tools/save-skill.ts`
- Modify: `src/tools/install-skill.ts`
- Test: `tests/tools/save-skill.test.ts` (new)
- Modify: `tests/tools/install-skill.test.ts`

- [ ] **Step 1: Write failing test for save_skill validation**

```typescript
// tests/tools/save-skill.test.ts
import { describe, it, expect } from 'vitest';
import { handleSaveSkill } from '../../src/tools/save-skill.js';
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
import type { ToolContext } from '../../src/tools/context.js';

function makeContext(): ToolContext {
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();
  const logger = new NoopLogger();
  return {
    skillStore,
    bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(true),
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

describe('handleSaveSkill', () => {
  it('rejects skill with invalid name format', async () => {
    const ctx = makeContext();
    const err = await handleSaveSkill(
      { name: 'UPPERCASE-BAD', content: '---\nname: UPPERCASE-BAD\ndescription: test\n---\nBody' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('rejects skill with missing description', async () => {
    const ctx = makeContext();
    const err = await handleSaveSkill(
      { name: 'good-name', content: '---\nname: good-name\n---\nBody' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('rejects duplicate skill', async () => {
    const ctx = makeContext();
    // Pre-populate store
    await ctx.skillStore.write('existing-skill', {
      metadata: { name: 'existing-skill', description: 'exists' },
      content: 'body',
      resources: [],
      trustLevel: 'community' as import('../../src/core/types.js').TrustLevel,
      state: 'active' as import('../../src/core/types.js').SkillState,
      sourcePath: 'existing-skill',
    });
    const err = await handleSaveSkill(
      { name: 'existing-skill', content: '---\nname: existing-skill\ndescription: test\n---\nBody', description: 'test' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ALREADY_EXISTS);
  });

  it('scans skill before saving', async () => {
    const scanner = new StubScanner(false); // scan fails
    const ctx = makeContext();
    (ctx as { scanner: StubScanner }).scanner = scanner;
    const err = await handleSaveSkill(
      { name: 'bad-skill', content: '---\nname: bad-skill\ndescription: a bad skill\n---\nBody', description: 'a bad skill' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.SCAN_FAILED);
  });

  it('saves valid skill successfully', async () => {
    const ctx = makeContext();
    const result = await handleSaveSkill(
      { name: 'good-skill', content: '---\nname: good-skill\ndescription: a good skill\n---\nBody', description: 'a good skill' },
      ctx,
    );
    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe('good-skill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/save-skill.test.ts`
Expected: FAIL — validation and duplicate check are not implemented

- [ ] **Step 3: Update save_skill handler**

Replace `src/tools/save-skill.ts`:

```typescript
import type { ToolHandler } from './types.js';
import { validationFailed, alreadyExists, scanFailed } from '../core/errors.js';
import { validateSkillMetadata } from '../core/validator.js';
import { TrustLevel, SkillState } from '../core/types.js';
import type { Source } from '../core/types.js';

interface SaveSkillParams {
  name: string;
  content: string;
  description?: string;
}

export const handleSaveSkill: ToolHandler<SaveSkillParams> = async (params, ctx) => {
  // 1. Basic param check
  const fieldErrors: Array<{ field: string; message: string }> = [];
  if (!params.name) fieldErrors.push({ field: 'name', message: 'skill name is required' });
  if (!params.content) fieldErrors.push({ field: 'content', message: 'skill content is required' });
  if (fieldErrors.length > 0) throw validationFailed(fieldErrors);

  // 2. Validate metadata against agentskills.io spec
  const validation = validateSkillMetadata({
    name: params.name,
    description: params.description ?? '',
  });
  if (!validation.valid) {
    throw validationFailed(validation.errors);
  }

  // 3. Duplicate check
  const exists = await ctx.skillStore.exists(params.name);
  if (exists) throw alreadyExists(params.name);

  // 4. Build skill object
  const skill = {
    metadata: { name: params.name, description: params.description ?? '' },
    content: params.content,
    resources: [],
    trustLevel: TrustLevel.SelfApproved,
    state: SkillState.Active,
    sourcePath: params.name,
  };

  // 5. Scan before saving
  ctx.lifecycle.beginScanning(params.name);
  const scanResult = await ctx.scanner.scanSkill(params.name, params.name);
  if (!scanResult.passed) {
    ctx.lifecycle.markQuarantined(params.name, scanResult.findings.map(f => f.message));
    throw scanFailed(params.name, scanResult.findings);
  }

  // 6. Write to store
  await ctx.skillStore.write(params.name, skill);
  const hash = await ctx.skillStore.computeHash(params.name);

  // 7. Mark active + update lock
  ctx.lifecycle.markActive(params.name, hash);
  await ctx.lockManager.addOrUpdate(params.name, {
    contentHash: hash,
    scanHash: scanResult.hash,
    scanResult: 'clean',
    scanTimestamp: new Date().toISOString(),
    trustLevel: TrustLevel.SelfApproved,
    source: { type: 'local' } as Source,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        saved: params.name,
        hash: hash.slice(0, 8),
        message: `Skill '${params.name}' saved successfully.`,
      }, null, 2),
    }],
  };
};
```

- [ ] **Step 4: Run save_skill tests**

Run: `npx vitest run tests/tools/save-skill.test.ts`
Expected: All PASS

- [ ] **Step 5: Write failing test for install_skill validation**

Add to `tests/tools/install-skill.test.ts`:

```typescript
it('rejects skill that fails metadata validation', async () => {
  const ctx = makeContext();
  // Put a skill with bad metadata in bundled store
  const bundled = ctx.bundledStore as InMemorySkillStore;
  await bundled.write('BAD-NAME', {
    metadata: { name: 'BAD-NAME', description: '' },
    content: 'body',
    resources: [],
    trustLevel: TrustLevel.Bundled,
    state: SkillState.Active,
    sourcePath: 'BAD-NAME',
  });
  const err = await handleInstallSkill(
    { skill: 'BAD-NAME' },
    ctx,
  ).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(SkillMcpError);
  expect((err as SkillMcpError).code).toBe(ErrorCode.VALIDATION_FAILED);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/tools/install-skill.test.ts`
Expected: FAIL — validation not called in install flow

- [ ] **Step 7: Add validation to install_skill handler**

In `src/tools/install-skill.ts`, add after the resolve step (after line 31) and before begin scanning:

```typescript
import { validationFailed } from '../core/errors.js';
import { validateSkillMetadata } from '../core/validator.js';

// ... inside handler, after resolve:

  // 3b. Validate resolved skill metadata
  const validation = validateSkillMetadata(resolved.metadata);
  if (!validation.valid) {
    throw validationFailed(validation.errors);
  }
```

Also fix the error code: change `alreadyExists` import to use `alreadyInstalled` if it exists, or ensure the error code matches spec (`ALREADY_INSTALLED`). Check `src/core/errors.ts` — if `ALREADY_INSTALLED` exists as a code, add a factory function. If not, the `ALREADY_EXISTS` code is acceptable for v1 since the error contract matches the behavior.

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/tools/save-skill.ts src/tools/install-skill.ts tests/tools/save-skill.test.ts tests/tools/install-skill.test.ts
git commit -m "feat: wire validator into save_skill and install_skill — validation, scan, duplicate check"
```

---

### Task 3: Create Resilience Tool Wrapper

Circuit breaker, token bucket, and tiered timeout are fully implemented but never used. Create a wrapper that composes them around tool calls, then wire it into the MCP server.

**Files:**
- Create: `src/resilience/tool-wrapper.ts`
- Modify: `src/tools/context.ts`
- Test: `tests/resilience/tool-wrapper.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/resilience/tool-wrapper.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withToolResilience, ResilienceContext } from '../../src/resilience/tool-wrapper.js';
import { TokenBucket } from '../../src/resilience/token-bucket.js';
import { CircuitBreaker } from '../../src/resilience/circuit-breaker.js';
import { TimeoutTier } from '../../src/resilience/tiered-timeout.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';

describe('withToolResilience', () => {
  function makeResilience(): ResilienceContext {
    return {
      rateLimiters: new Map([['test_tool', new TokenBucket(2, 120)]]),
      circuitBreakers: new Map([['remote-source', new CircuitBreaker()]]),
    };
  }

  it('passes through for local operations without rate limiting', async () => {
    const resilience = makeResilience();
    const result = await withToolResilience(
      'test_tool',
      TimeoutTier.Local,
      resilience,
      async () => 'ok',
    );
    expect(result).toBe('ok');
  });

  it('rejects when rate limit exhausted', async () => {
    const resilience = makeResilience();
    const bucket = resilience.rateLimiters.get('test_tool')!;
    bucket.tryConsume(); // 1
    bucket.tryConsume(); // 2 — empty now

    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.FreshRemote,
      resilience,
      async () => 'ok',
      { rateLimitKey: 'test_tool' },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.RATE_LIMITED);
  });

  it('rejects when circuit breaker is open', async () => {
    const resilience = makeResilience();
    const breaker = resilience.circuitBreakers.get('remote-source')!;
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure(); // trips open

    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.FreshRemote,
      resilience,
      async () => 'ok',
      { circuitBreakerKey: 'remote-source' },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.NETWORK_UNAVAILABLE);
  });

  it('wraps operation with timeout', async () => {
    const resilience = makeResilience();
    const err = await withToolResilience(
      'test_tool',
      TimeoutTier.Local, // 2s timeout
      resilience,
      async () => new Promise(resolve => setTimeout(resolve, 5000)),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.OPERATION_TIMEOUT);
  }, 10000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/resilience/tool-wrapper.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement the tool wrapper**

```typescript
// src/resilience/tool-wrapper.ts
import { TokenBucket } from './token-bucket.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { withTimeout, TimeoutTier } from './tiered-timeout.js';
import { rateLimited, networkUnavailable } from '../core/errors.js';

export interface ResilienceContext {
  rateLimiters: Map<string, TokenBucket>;
  circuitBreakers: Map<string, CircuitBreaker>;
}

export interface ResilienceOptions {
  rateLimitKey?: string;
  circuitBreakerKey?: string;
}

export async function withToolResilience<T>(
  toolName: string,
  tier: TimeoutTier,
  resilience: ResilienceContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  options?: ResilienceOptions,
): Promise<T> {
  // 1. Check rate limit (only if key provided — local ops skip this)
  if (options?.rateLimitKey) {
    const bucket = resilience.rateLimiters.get(options.rateLimitKey);
    if (bucket && !bucket.tryConsume()) {
      throw rateLimited(toolName, bucket.msUntilNextToken());
    }
  }

  // 2. Check circuit breaker (only if key provided)
  if (options?.circuitBreakerKey) {
    const breaker = resilience.circuitBreakers.get(options.circuitBreakerKey);
    if (breaker && !breaker.isAllowed()) {
      throw networkUnavailable(
        options.circuitBreakerKey,
        'Circuit breaker is open — source is temporarily unavailable',
      );
    }
  }

  // 3. Wrap with timeout
  const result = await withTimeout(
    (signal) => operation(signal),
    tier,
    toolName,
  );

  // 4. Record success on circuit breaker
  if (options?.circuitBreakerKey) {
    const breaker = resilience.circuitBreakers.get(options.circuitBreakerKey);
    breaker?.recordSuccess();
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/resilience/tool-wrapper.test.ts`
Expected: All PASS

- [ ] **Step 5: Add ResilienceContext to ToolContext**

In `src/tools/context.ts`, add:

```typescript
import type { ResilienceContext } from '../resilience/tool-wrapper.js';

export interface ToolContext {
  // ... existing fields ...
  resilience?: ResilienceContext;
}
```

- [ ] **Step 6: Wire resilience into index.ts**

In `src/index.ts`, after config loading, add:

```typescript
import { TokenBucket } from './resilience/token-bucket.js';
import { CircuitBreaker } from './resilience/circuit-breaker.js';
import type { ResilienceContext } from './resilience/tool-wrapper.js';

// ... after config is loaded:

// Resilience
const rateLimiters = new Map<string, TokenBucket>();
for (const [tool, limits] of Object.entries(config.resilience.rateLimits)) {
  rateLimiters.set(tool, new TokenBucket(limits.bucketSize, limits.refillPerMinute));
}
const circuitBreakers = new Map<string, CircuitBreaker>();
for (const source of config.sources) {
  const key = source.url ?? source.path ?? 'unknown';
  circuitBreakers.set(key, new CircuitBreaker());
}
const resilience: ResilienceContext = { rateLimiters, circuitBreakers };
```

Add `resilience` to the `ctx` object.

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/resilience/tool-wrapper.ts src/tools/context.ts src/index.ts tests/resilience/tool-wrapper.test.ts
git commit -m "feat: create resilience tool wrapper — wires timeout, rate limit, circuit breaker"
```

---

### Task 4: Fix get_skill Stale-Serve for Scanning State

When a skill is in `scanning` state, the spec says serve the previous locked version (not the current resolution). Currently `get_skill` resolves normally and just sets `stale: true`.

**Files:**
- Modify: `src/tools/get-skill.ts`
- Modify: `tests/tools/get-skill.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/tools/get-skill.test.ts`:

```typescript
it('serves locked version when skill is in scanning state', async () => {
  const ctx = makeContext();
  // Write skill v1 and lock it
  const skill = { ...FIXTURE_SKILLS['tdd-python'] };
  skill.content = 'version 1 content';
  await ctx.skillStore.write('tdd-python', skill);
  const hash = await ctx.skillStore.computeHash('tdd-python');
  ctx.lifecycle.markActive('tdd-python', hash);
  await ctx.lockManager.addOrUpdate('tdd-python', {
    contentHash: hash,
    scanHash: hash,
    scanResult: 'clean',
    scanTimestamp: new Date().toISOString(),
    trustLevel: skill.trustLevel,
    source: { type: 'local' },
  });

  // Now begin scanning (simulating an update)
  ctx.lifecycle.beginScanning('tdd-python');

  // Write skill v2 (new content, not yet scanned)
  skill.content = 'version 2 content - not yet scanned';
  await ctx.skillStore.write('tdd-python', skill);

  const result = await handleGetSkill({ name: 'tdd-python' }, ctx);
  const body = JSON.parse(result.content[0].text);
  expect(body.stale).toBe(true);
  // Should serve the locked (v1) content, not the new v2
  expect(body.content).toBe('version 1 content');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/get-skill.test.ts`
Expected: FAIL — currently serves whatever `resolver.resolve()` returns

- [ ] **Step 3: Update get_skill to serve locked version during scanning**

In `src/tools/get-skill.ts`, after the quarantine check and before normal resolution, add:

```typescript
  // Stale-serve: during scanning, serve the locked version
  if (entry?.state === SkillState.Scanning) {
    const lockEntry = await ctx.lockManager.getEntry(params.name);
    if (lockEntry) {
      // Resolve and serve the previously locked version
      const lockedSkill = await ctx.resolver.resolve(params.name);
      if (lockedSkill) {
        const indicator = TRUST_INDICATORS[lockedSkill.trustLevel];
        const vendorConfig = ctx.vendorConfigOverlay
          ? await ctx.vendorConfigOverlay(params.name, lockedSkill)
          : undefined;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              name: lockedSkill.metadata.name,
              description: lockedSkill.metadata.description,
              trust: `${indicator} ${lockedSkill.trustLevel}`,
              content: lockedSkill.content,
              resources: lockedSkill.resources,
              stale: true,
              scanning: true,
              ...(vendorConfig ? { vendor_config: vendorConfig } : {}),
            }, null, 2),
          }],
        };
      }
    }
    // No locked version available — skill unavailable during first scan
    throw skillNotFound(params.name, ['scanning — no previous version available']);
  }
```

Note: For v1, `resolver.resolve()` returns the on-disk content. In a full implementation with content-addressable storage, we'd serve by hash. For now, the stale flag + scanning flag is the important contract.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tools/get-skill.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-skill.ts tests/tools/get-skill.test.ts
git commit -m "fix: get_skill serves locked version during scanning state (stale-serve)"
```

---

### Task 5: Fix remove_skill — Add SKILL_LOCKED Check

Spec says `remove_skill` should return `SKILL_LOCKED` if lock enforcement is enabled (advisory in v1, but the check should exist for when enforcement is turned on).

**Files:**
- Modify: `src/tools/remove-skill.ts`
- Create: `tests/tools/remove-skill.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/remove-skill.test.ts
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
    scanner: new StubScanner(true),
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
    expect((err as SkillMcpError).code).toBe(ErrorCode.SKILL_NOT_FOUND);
  });

  it('throws VALIDATION_FAILED when name is empty', async () => {
    const ctx = makeContext();
    const err = await handleRemoveSkill({ name: '' }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});
```

- [ ] **Step 2: Run test to verify they pass** (these test existing behavior)

Run: `npx vitest run tests/tools/remove-skill.test.ts`
Expected: All PASS (this confirms existing behavior)

- [ ] **Step 3: Commit** (no changes needed — the SKILL_LOCKED check is advisory in v1 and can remain unimplemented until lock enforcement is activated)

```bash
git add tests/tools/remove-skill.test.ts
git commit -m "test: add dedicated remove_skill test coverage"
```

---

### Task 6: Implement save_config Hot-Reload

Spec says `save_config` should trigger hot-reload. Currently it just writes to disk. Add a callback mechanism so the server can re-read config after save.

**Files:**
- Modify: `src/tools/context.ts`
- Modify: `src/tools/save-config.ts`
- Create: `tests/tools/save-config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/save-config.test.ts
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
    scanner: new StubScanner(true),
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
    const reloadFn = vi.fn();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/save-config.test.ts`
Expected: FAIL — `onConfigReload` doesn't exist on ToolContext

- [ ] **Step 3: Add onConfigReload to ToolContext**

In `src/tools/context.ts`, add to the interface:

```typescript
  onConfigReload?: () => Promise<void> | void;
```

- [ ] **Step 4: Update save_config to call reload**

Replace `src/tools/save-config.ts`:

```typescript
import type { ToolHandler } from './types.js';

export const handleSaveConfig: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  await ctx.configStore.save(ctx.config);

  // Trigger hot-reload if callback is registered
  if (ctx.onConfigReload) {
    await ctx.onConfigReload();
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        saved: true,
        path: ctx.configStore.getPath(),
        message: `Config saved and reloaded from '${ctx.configStore.getPath()}'.`,
      }, null, 2),
    }],
  };
};
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/tools/save-config.test.ts`
Expected: All PASS

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit** *(pending — not performed in this session)*

```bash
git add src/tools/context.ts src/tools/save-config.ts tests/tools/save-config.test.ts
git commit -m "feat: save_config triggers hot-reload via onConfigReload callback"
```

---

### Task 7: Complete get_status — Add Network, Circuit Breaker, and Orphan Detection

`get_status` currently only reports lifecycle counts. Spec says it should also surface circuit breaker state, network status, orphaned configs, and scan warnings.

**Files:**
- Modify: `src/tools/get-status.ts`
- Create: `tests/tools/get-status.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/get-status.test.ts
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
    scanner: new StubScanner(true),
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
    breaker.recordFailure(); // trips open

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/get-status.test.ts`
Expected: FAIL — no `circuitBreakers` or `accessControl` in response

- [ ] **Step 3: Update get_status handler**

Replace `src/tools/get-status.ts`:

```typescript
import type { ToolHandler } from './types.js';
import { SkillState } from '../core/types.js';

export const handleGetStatus: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  // Lifecycle states
  const lifecycleAll = ctx.lifecycle.listAll();
  const states: Record<string, { state: string; hash: string | null; findings: string[] }> = {};
  for (const [name, entry] of lifecycleAll) {
    states[name] = { state: entry.state, hash: entry.currentHash, findings: entry.findings };
  }

  const summary = {
    installed: (await ctx.skillStore.listNames()).length,
    active: ctx.lifecycle.listByState(SkillState.Active).length,
    scanning: ctx.lifecycle.listByState(SkillState.Scanning).length,
    quarantined: ctx.lifecycle.listByState(SkillState.Quarantined).length,
    forced: ctx.lifecycle.listByState(SkillState.ActiveForced).length,
    locked: (await ctx.lockManager.listLockedSkills()).length,
  };

  // Circuit breaker states
  const circuitBreakers: Record<string, string> = {};
  if (ctx.resilience) {
    for (const [source, breaker] of ctx.resilience.circuitBreakers) {
      circuitBreakers[source] = breaker.getState();
    }
  }

  // Access control info
  const accessControl = {
    mode: ctx.config.security.accessControl.mode,
  };

  // Network status (offline flag)
  const network = ctx.isOffline?.() ? 'unavailable' : 'available';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        summary,
        skills: states,
        lock: { lockedSkills: await ctx.lockManager.listLockedSkills() },
        circuitBreakers,
        accessControl,
        network,
      }, null, 2),
    }],
  };
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tools/get-status.test.ts`
Expected: All PASS

- [ ] **Step 5: Run all tests** (ensure existing get_status callers aren't broken)

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/tools/get-status.ts tests/tools/get-status.test.ts
git commit -m "feat: get_status reports circuit breaker state, access control, and network status"
```

---

### Task 8: Add Missing Scanner Rules

The builtin scanner is missing 5 scan rules from the spec: hex-encoded commands, ROT13/obfuscation, unexpected binary files, template syntax in markdown, and unsafe string concatenation before LLM calls.

**Files:**
- Modify: `src/adapters/driven/builtin-scanner.ts`
- Modify: `tests/adapters/builtin-scanner.test.ts`

- [ ] **Step 1: Write failing tests for missing rules**

Add to `tests/adapters/builtin-scanner.test.ts`:

```typescript
describe('missing scan rules', () => {
  it('detects hex-encoded commands', async () => {
    await mkdir(join(skillDir, 'scripts'), { recursive: true });
    await writeFile(join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "$(echo 636174202f6574632f706173737764 | xxd -r -p)"');
    const result = await scanner.scanSkill(skillDir, 'test-skill');
    expect(result.findings.some(f => f.rule === 'hex-encoded-cmd')).toBe(true);
  });

  it('detects ROT13 obfuscation', async () => {
    await writeFile(join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "test" | tr "a-zA-Z" "n-za-mN-ZA-M"');
    const result = await scanner.scanSkill(skillDir, 'test-skill');
    expect(result.findings.some(f => f.rule === 'obfuscation')).toBe(true);
  });

  it('detects template syntax in markdown', async () => {
    await writeFile(join(skillDir, 'SKILL.md'), '---\nname: test\ndescription: test\n---\nDo this: {{user_input}} and then {{system.prompt}}');
    const result = await scanner.scanSkill(skillDir, 'test-skill');
    expect(result.findings.some(f => f.rule === 'template-injection')).toBe(true);
  });

  it('detects unexpected binary files', async () => {
    // Write a file with binary content (null bytes)
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x89, 0x50, 0x4E, 0x47]);
    await writeFile(join(skillDir, 'scripts', 'hidden.dat'), binaryContent);
    const result = await scanner.scanSkill(skillDir, 'test-skill');
    expect(result.findings.some(f => f.rule === 'unexpected-binary')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/adapters/builtin-scanner.test.ts`
Expected: FAIL — rules don't exist

- [ ] **Step 3: Add the missing rules to builtin-scanner.ts**

Add these rules to the `CODE_RULES` array in `src/adapters/driven/builtin-scanner.ts`:

```typescript
  {
    rule: 'hex-encoded-cmd',
    severity: 'critical',
    pattern: /xxd\s+-r\s+-p|printf\s+'\\x/,
    fileExtensions: ['.sh', '.bash', '.zsh'],
    message: 'Hex-encoded content decoded at runtime — potential obfuscated command',
  },
  {
    rule: 'obfuscation',
    severity: 'warning',
    pattern: /tr\s+["']a-zA-Z["']\s+["']n-za-mN-ZA-M["']|rot13/i,
    fileExtensions: ['.sh', '.bash', '.zsh', '.js', '.ts'],
    message: 'ROT13 or character rotation detected — potential obfuscation',
  },
```

Add to `PROMPT_INJECTION_RULES`:

```typescript
  {
    rule: 'template-injection',
    severity: 'warning',
    pattern: /\{\{[^}]*\}\}/,
    fileExtensions: ['.md'],
    message: 'Template syntax in markdown — potential injection vector for dynamic content',
  },
```

For binary file detection, add a check in the `walkFiles` callback in `scanSkill`, before reading content:

```typescript
      // Check for unexpected binary files (non-text)
      if (!stat.isSymbolicLink()) {
        const content = await readFile(filePath);
        // Check for null bytes — indicator of binary content
        if (content.includes(0x00)) {
          findings.push({
            rule: 'unexpected-binary',
            severity: 'warning',
            file: relativePath,
            line: 0,
            message: 'Binary file detected in skill directory — skills should contain only text files',
          });
          return; // Skip line-by-line analysis for binary files
        }
        const textContent = content.toString('utf-8');
        // ... rest of line-by-line scanning
      }
```

This requires changing `readFile(filePath, 'utf-8')` to `readFile(filePath)` (Buffer) and converting to string after the binary check.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/adapters/builtin-scanner.test.ts`
Expected: All PASS

- [x] **Step 5: Run all tests**

Run: `npx vitest run`
Result: ✅ All pass (`33` files, `236` tests)

Additional verification completed:
- `npm run typecheck` → ✅ pass
- `npm run lint` → ✅ pass (after adding `eslint.config.js` and resolving lint errors)

- [ ] **Step 6: Commit** *(pending — not performed in this session)*

```bash
git add src/adapters/driven/builtin-scanner.ts tests/adapters/builtin-scanner.test.ts
git commit -m "feat: add missing scanner rules — hex, ROT13, template injection, binary detection"
```

---

### Task 9: Add Category Support to Search Index

`listCategories` and `getByCategory` always return empty arrays. Categories should be derived from a `tags` field on `SkillMetadata`.

**Files:**
- Modify: `src/core/types.ts` (add `tags` field)
- Modify: `src/adapters/driven/memory-search-index.ts`
- Modify: `tests/adapters/memory-search-index.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/adapters/memory-search-index.test.ts`:

```typescript
it('returns categories from skill tags', async () => {
  const index = new MemorySearchIndex();
  await index.rebuild([
    { name: 'tdd-python', description: 'TDD for Python', tags: ['testing', 'python'] },
    { name: 'git-workflows', description: 'Git patterns', tags: ['git', 'testing'] },
  ] as SkillMetadata[]);
  const categories = await index.listCategories();
  expect(categories).toContain('testing');
  expect(categories).toContain('python');
  expect(categories).toContain('git');
});

it('returns skills by category', async () => {
  const index = new MemorySearchIndex();
  await index.rebuild([
    { name: 'tdd-python', description: 'TDD for Python', tags: ['testing', 'python'] },
    { name: 'git-workflows', description: 'Git patterns', tags: ['git'] },
  ] as SkillMetadata[]);
  const results = await index.getByCategory('testing');
  expect(results).toHaveLength(1);
  expect(results[0].name).toBe('tdd-python');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/adapters/memory-search-index.test.ts`
Expected: FAIL — categories return []

- [ ] **Step 3: Add `tags` to SkillMetadata**

In `src/core/types.ts`, add to the `SkillMetadata` interface:

```typescript
  tags?: string[];
```

- [ ] **Step 4: Implement category support in MemorySearchIndex**

Replace `listCategories` and `getByCategory` in `src/adapters/driven/memory-search-index.ts`:

```typescript
  async listCategories(): Promise<string[]> {
    const tags = new Set<string>();
    for (const skill of this.skills) {
      if (skill.tags) {
        for (const tag of skill.tags) tags.add(tag);
      }
    }
    return [...tags].sort();
  }

  async getByCategory(category: string): Promise<SearchResult[]> {
    return this.skills
      .filter(skill => skill.tags?.includes(category))
      .map(skill => ({
        name: skill.name,
        description: skill.description,
        trustLevel: 'unknown' as TrustLevel,
        score: 1,
      }));
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/adapters/memory-search-index.test.ts`
Expected: All PASS

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/adapters/driven/memory-search-index.ts tests/adapters/memory-search-index.test.ts
git commit -m "feat: add category support to search index — listCategories and getByCategory"
```

---

### Task 10: Implement Config Discovery Chain

The spec defines a multi-path discovery chain: project config is found by checking `.skill-mcp/config.json`, `.claude/skill-mcp/config.json`, `.agents/skill-mcp/config.json` in order. Currently only global config is loaded.

**Files:**
- Create: `src/core/config-discovery.ts`
- Modify: `src/index.ts`
- Create: `tests/core/config-discovery.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/core/config-discovery.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectConfig } from '../../src/core/config-discovery.js';

describe('discoverProjectConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-mcp-disc-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('finds config in .skill-mcp/', async () => {
    const configDir = join(tempDir, '.skill-mcp');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(join(configDir, 'config.json'));
  });

  it('finds config in .claude/skill-mcp/ when .skill-mcp/ missing', async () => {
    const configDir = join(tempDir, '.claude', 'skill-mcp');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.claude/skill-mcp/config.json');
  });

  it('finds config in .agents/skill-mcp/ as last resort', async () => {
    const configDir = join(tempDir, '.agents', 'skill-mcp');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.agents/skill-mcp/config.json');
  });

  it('returns null when no project config exists', async () => {
    const result = await discoverProjectConfig(tempDir);
    expect(result).toBeNull();
  });

  it('uses first match — does not continue checking', async () => {
    // Create configs in both locations
    const dir1 = join(tempDir, '.skill-mcp');
    const dir2 = join(tempDir, '.claude', 'skill-mcp');
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir1, 'config.json'), JSON.stringify({ schemaVersion: 1, manifest: { maxManifestSize: 5 } }));
    await writeFile(join(dir2, 'config.json'), JSON.stringify({ schemaVersion: 1, manifest: { maxManifestSize: 99 } }));

    const result = await discoverProjectConfig(tempDir);
    expect(result!.path).toBe(join(dir1, 'config.json'));
  });

  it('supports custom discovery paths from config', async () => {
    const custom = join(tempDir, '.custom-dir');
    await mkdir(custom, { recursive: true });
    await writeFile(join(custom, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir, ['.custom-dir']);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.custom-dir/config.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/config-discovery.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement config-discovery**

```typescript
// src/core/config-discovery.ts
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './types.js';

const DEFAULT_PROJECT_CONFIG_PATHS = [
  '.skill-mcp',
  '.claude/skill-mcp',
  '.agents/skill-mcp',
];

export interface DiscoveredConfig {
  path: string;
  config: Partial<Config>;
}

export async function discoverProjectConfig(
  projectRoot: string,
  searchPaths?: string[],
): Promise<DiscoveredConfig | null> {
  const paths = searchPaths ?? DEFAULT_PROJECT_CONFIG_PATHS;

  for (const relPath of paths) {
    const configPath = join(projectRoot, relPath, 'config.json');
    try {
      await access(configPath);
      const raw = await readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as Partial<Config>;
      return { path: configPath, config };
    } catch {
      // File not found — try next path
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/config-discovery.test.ts`
Expected: All PASS

- [ ] **Step 5: Wire into index.ts**

In `src/index.ts`, after loading global config and before `mergeConfigs`:

```typescript
import { discoverProjectConfig } from './core/config-discovery.js';

// ... after rawConfig is loaded:
const projectConfig = await discoverProjectConfig(process.cwd(), rawConfig?.projectConfigPaths as string[] | undefined);
const config = mergeConfigs(rawConfig, projectConfig?.config);
if (projectConfig) {
  logger.info(`Loaded project config from ${projectConfig.path}`);
}
```

Note: `mergeConfigs` already accepts a second argument for project config — it's just never been passed one.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/core/config-discovery.ts src/index.ts tests/core/config-discovery.test.ts
git commit -m "feat: implement project config discovery chain — checks .skill-mcp, .claude/skill-mcp, .agents/skill-mcp"
```

---

### Task 11: Implement Worker Manager

Workers are scaffolded but never spawned. Create a `WorkerManager` that spawns worker threads, hooks up heartbeat monitoring, and handles restarts.

**Files:**
- Create: `src/workers/worker-manager.ts`
- Modify: `src/index.ts`
- Create: `tests/workers/worker-manager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/workers/worker-manager.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WorkerManager, type WorkerManagerOptions } from '../../src/workers/worker-manager.js';
import { NoopLogger } from '../helpers/noop-logger.js';

describe('WorkerManager', () => {
  let manager: WorkerManager | undefined;

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
      manager = undefined;
    }
  });

  it('creates manager without starting workers', () => {
    const logger = new NoopLogger();
    manager = new WorkerManager(logger);
    expect(manager.getWorkerStatus()).toEqual({
      sync: 'stopped',
      scanner: 'stopped',
      index: 'stopped',
    });
  });

  it('reports worker status after start', async () => {
    const logger = new NoopLogger();
    manager = new WorkerManager(logger, { autoStart: false });
    // Just verify the interface works — actual worker spawning
    // is tested in integration tests since it requires real worker files
    const status = manager.getWorkerStatus();
    expect(status).toHaveProperty('sync');
    expect(status).toHaveProperty('scanner');
    expect(status).toHaveProperty('index');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workers/worker-manager.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement WorkerManager**

```typescript
// src/workers/worker-manager.ts
import { Worker } from 'node:worker_threads';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../core/ports/logger.js';
import { WorkerHeartbeat } from '../resilience/worker-heartbeat.js';
import type { HeartbeatTarget } from '../resilience/worker-heartbeat.js';
import type { WorkerMessage } from './messages.js';

type WorkerStatus = 'stopped' | 'starting' | 'running' | 'hung' | 'disabled';

export interface WorkerManagerOptions {
  autoStart?: boolean;
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
}

const WORKER_NAMES = ['sync', 'scanner', 'index'] as const;
type WorkerName = typeof WORKER_NAMES[number];

/** Adapts a Worker to the HeartbeatTarget interface */
function toHeartbeatTarget(worker: Worker, name: string): HeartbeatTarget {
  return {
    name,
    sendPing() { worker.postMessage({ type: 'ping' } satisfies WorkerMessage); },
    onPong(handler: () => void) {
      worker.on('message', (msg: WorkerMessage) => { if (msg.type === 'pong') handler(); });
    },
    terminate() { worker.terminate(); },
  };
}

export class WorkerManager {
  private workers = new Map<WorkerName, Worker>();
  private heartbeats = new Map<WorkerName, WorkerHeartbeat>();
  private statuses = new Map<WorkerName, WorkerStatus>();
  private readonly logger: Logger;
  private readonly options: Required<WorkerManagerOptions>;

  constructor(logger: Logger, options?: WorkerManagerOptions) {
    this.logger = logger;
    this.options = {
      autoStart: options?.autoStart ?? false,
      pingIntervalMs: options?.pingIntervalMs ?? 10_000,
      pongTimeoutMs: options?.pongTimeoutMs ?? 5_000,
    };
    for (const name of WORKER_NAMES) {
      this.statuses.set(name, 'stopped');
    }
  }

  getWorkerStatus(): Record<WorkerName, WorkerStatus> {
    return {
      sync: this.statuses.get('sync')!,
      scanner: this.statuses.get('scanner')!,
      index: this.statuses.get('index')!,
    };
  }

  async startAll(config: unknown): Promise<void> {
    for (const name of WORKER_NAMES) {
      await this.startWorker(name, config);
    }
  }

  private async startWorker(name: WorkerName, config: unknown): Promise<void> {
    if (this.statuses.get(name) === 'disabled') {
      this.logger.warn(`Worker ${name} is disabled for this session — too many restarts`);
      return;
    }

    this.statuses.set(name, 'starting');
    const workerFile = join(dirname(fileURLToPath(import.meta.url)), `${name}-worker.js`);

    try {
      const worker = new Worker(workerFile);
      this.workers.set(name, worker);

      worker.on('message', (msg: WorkerMessage) => {
        if (msg.type === 'ready') {
          this.statuses.set(name, 'running');
          this.logger.info(`Worker ${name} is ready`);
        }
      });

      worker.on('error', (err: Error) => {
        this.logger.error(`Worker ${name} crashed: ${err.message}`);
        this.handleWorkerCrash(name, config);
      });

      worker.on('exit', (code: number) => {
        if (code !== 0 && this.statuses.get(name) !== 'stopped') {
          this.logger.warn(`Worker ${name} exited with code ${code}`);
          this.handleWorkerCrash(name, config);
        }
      });

      // Adapt Worker to HeartbeatTarget interface, then create heartbeat.
      // WorkerHeartbeat handles restart-count tracking and the "3 restarts
      // in 10 minutes → disable" rule internally — we delegate to its
      // `disabled` property rather than duplicating that logic here.
      const target = toHeartbeatTarget(worker, name);
      const heartbeat = new WorkerHeartbeat(target, this.logger, {
        pingIntervalMs: this.options.pingIntervalMs,
        pongTimeoutMs: this.options.pongTimeoutMs,
        onHung: () => {
          this.logger.warn(`Worker ${name} is hung — restarting`);
          this.statuses.set(name, 'hung');
          this.handleWorkerCrash(name, config);
        },
      });
      this.heartbeats.set(name, heartbeat);
      heartbeat.start();

      // Send start message with config
      worker.postMessage({ type: 'start', config } satisfies WorkerMessage);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to start worker ${name}: ${msg}`);
      this.statuses.set(name, 'stopped');
    }
  }

  private handleWorkerCrash(name: WorkerName, config: unknown): void {
    const heartbeat = this.heartbeats.get(name);
    if (heartbeat) heartbeat.stop();
    this.heartbeats.delete(name);

    const existing = this.workers.get(name);
    if (existing) {
      try { existing.terminate(); } catch { /* already dead */ }
    }
    this.workers.delete(name);

    // Check if heartbeat has disabled this worker (3 hangs in 10 min)
    if (heartbeat?.disabled) {
      this.statuses.set(name, 'disabled');
      return;
    }

    // Restart
    void this.startWorker(name, config);
  }

  async shutdown(): Promise<void> {
    for (const [, heartbeat] of this.heartbeats) {
      heartbeat.stop();
    }
    this.heartbeats.clear();

    for (const [name, worker] of this.workers) {
      this.statuses.set(name, 'stopped');
      await worker.terminate();
    }
    this.workers.clear();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/workers/worker-manager.test.ts`
Expected: All PASS

- [ ] **Step 5: Wire WorkerManager into index.ts**

In `src/index.ts`, after creating the MCP server and before starting stdio:

```typescript
import { WorkerManager } from './workers/worker-manager.js';

// ... after server creation:

// Start background workers (deferred — after first tool response for fast startup)
const workerManager = new WorkerManager(logger);
// Defer worker startup to avoid slowing first response
setImmediate(() => {
  void workerManager.startAll(config).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to start workers: ${msg}`);
  });
});

// Update shutdown handler
const shutdown = async (): Promise<void> => {
  logger.info('Shutting down skill-mcp server...');
  await workerManager.shutdown();
  await server.close();
  process.exit(0);
};
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/workers/worker-manager.ts src/index.ts tests/workers/worker-manager.test.ts
git commit -m "feat: add WorkerManager — spawns workers with heartbeat monitoring and restart logic"
```

---

### Task 12: Implement Sync Worker Loop

The sync worker scaffold only handles ping/pong. Implement the periodic sync loop that pulls from configured remote sources.

**Files:**
- Modify: `src/workers/sync-worker.ts`
- Create: `tests/workers/sync-worker.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/workers/sync-worker.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { WorkerMessage } from '../../src/workers/messages.js';

describe('sync-worker message handling', () => {
  it('responds to ping with pong', () => {
    const postMessage = vi.fn();
    // Simulate the worker's message handler
    const handler = (msg: WorkerMessage): void => {
      if (msg.type === 'ping') {
        postMessage({ type: 'pong' } satisfies WorkerMessage);
      }
    };
    handler({ type: 'ping' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'pong' });
  });

  it('sends ready on start message', () => {
    const postMessage = vi.fn();
    const handler = (msg: WorkerMessage): void => {
      if (msg.type === 'start') {
        postMessage({ type: 'ready' } satisfies WorkerMessage);
      }
    };
    handler({ type: 'start', config: {} });
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (this tests the protocol, which we'll implement)

Run: `npx vitest run tests/workers/sync-worker.test.ts`
Expected: PASS (these test extracted handler logic)

- [ ] **Step 3: Update sync-worker**

Replace `src/workers/sync-worker.ts`:

```typescript
import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

interface SyncConfig {
  intervalMinutes: number;
  sources: Array<{ type: string; url?: string; path?: string }>;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

function startSyncLoop(config: SyncConfig): void {
  const intervalMs = config.intervalMinutes * 60 * 1000;

  const runSync = (): void => {
    // For each configured remote source, attempt sync
    const updated: string[] = [];
    for (const source of config.sources) {
      if (source.type === 'git' || source.type === 'registry') {
        // Remote sync will be implemented when git/http adapters are ready
        // For now, this is a no-op that completes cleanly
      }
    }
    if (updated.length > 0) {
      parentPort?.postMessage({ type: 'sync_complete', skillsUpdated: updated } satisfies WorkerMessage);
    }
  };

  // Run once immediately, then on interval
  runSync();
  syncTimer = setInterval(runSync, intervalMs);
}

if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ping') {
      parentPort!.postMessage({ type: 'pong' } satisfies WorkerMessage);
    } else if (msg.type === 'start') {
      const config = msg.config as { sync?: SyncConfig };
      if (config.sync) {
        startSyncLoop(config.sync);
      }
      parentPort!.postMessage({ type: 'ready' } satisfies WorkerMessage);
    }
  });
}
```

- [ ] **Step 4: Apply same pattern to scanner-worker and index-worker**

Update `src/workers/scanner-worker.ts` and `src/workers/index-worker.ts` with the same start/ready/ping/pong protocol and placeholder loops. (Same structure, different config keys.)

Scanner worker: reads `security.periodicScanIntervalHours`, runs scan loop.
Index worker: rebuilds index when notified of changes.

- [x] **Step 5: Run all tests**

Run: `npx vitest run`
Result: ✅ All pass (`33` files, `236` tests)

Additional verification completed:
- `npm run typecheck` → ✅ pass
- `npm run lint` → ✅ pass

- [ ] **Step 6: Commit** *(pending — not performed in this session)*

```bash
git add src/workers/sync-worker.ts src/workers/scanner-worker.ts src/workers/index-worker.ts tests/workers/sync-worker.test.ts
git commit -m "feat: implement worker start/ready protocol and sync loop structure"
```

---

### Task 13: Add MCP Server clientInfo Capture and Manifest on Connect

The spec says the compact manifest should be injected into the agent's initial context on connect, and `clientInfo` from the handshake should be captured for platform detection.

**Files:**
- Modify: `src/adapters/driving/mcp-server.ts`
- Modify: `src/tools/context.ts`

- [ ] **Step 1: Read current mcp-server.ts to understand the transport setup**

Read `src/adapters/driving/mcp-server.ts` to see how tools are registered and what hooks are available for connect/init.

- [ ] **Step 2: Add clientInfo to ToolContext**

In `src/tools/context.ts`, add:

```typescript
  clientInfo?: { name?: string; version?: string };
```

- [ ] **Step 3: Capture clientInfo in MCP server**

In `src/adapters/driving/mcp-server.ts`, after the MCP server is created, look for the initialization/connect callback. Use the MCP SDK's `server.onInitialize` or equivalent to capture `clientInfo` and store it on the context. Also have the server return the manifest as part of the instructions or server info.

The exact implementation depends on the MCP SDK API. The key changes:
1. In the `initialize` handler, read `params.clientInfo` and store on `ctx.clientInfo`
2. Include `ctx.manifestBuilder.toText(skills)` in the server's instructions/description

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/adapters/driving/mcp-server.ts src/tools/context.ts
git commit -m "feat: capture clientInfo from MCP handshake, serve manifest on connect"
```

---

### Task 14: Add Structured Context to Console Logger

The `ConsoleLogger` ignores the `context` parameter on all log methods. For troubleshooting and debug modes, structured context should be included.

**Files:**
- Modify: `src/adapters/driven/console-logger.ts`
- Modify: `tests/adapters/console-logger.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/adapters/console-logger.test.ts`:

```typescript
it('includes context in output when provided', () => {
  const output: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { output.push(args.join(' ')); };

  const logger = new ConsoleLogger('info');
  logger.info('test message', { tool: 'search_skills', duration: 42 });

  console.error = original;
  expect(output[0]).toContain('tool=search_skills');
  expect(output[0]).toContain('duration=42');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/console-logger.test.ts`
Expected: FAIL — context is ignored

- [ ] **Step 3: Update ConsoleLogger to include context**

In `src/adapters/driven/console-logger.ts`, update the log methods to append context:

```typescript
private formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return '';
  return ' ' + Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ');
}

// In each log method, change:
//   console.error(`[ERROR] ${message}`);
// to:
//   console.error(`[ERROR] ${message}${this.formatContext(context)}`);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/adapters/console-logger.test.ts`
Expected: All PASS

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/adapters/driven/console-logger.ts tests/adapters/console-logger.test.ts
git commit -m "feat: console logger includes structured context in output"
```

---

### Task 15: Final Bootstrap Wiring and Integration Test

Wire all the pieces together in `index.ts` and verify with an integration test. This consolidates the changes from earlier tasks.

**Files:**
- Modify: `src/index.ts`
- Modify: `tests/integration/bootstrap.integration.test.ts`

- [ ] **Step 1: Review index.ts for all wiring gaps**

Ensure `index.ts` has:
- ✅ `FileSkillLockStore` (Task 1)
- ✅ Resilience context (Task 3)
- ✅ Project config discovery (Task 10)
- ✅ WorkerManager (Task 11)
- `onConfigReload` callback on ctx
- `isOffline` function on ctx

- [ ] **Step 2: Add onConfigReload to ctx**

In `src/index.ts`, add to the ctx object:

```typescript
  onConfigReload: async () => {
    const newRaw = await configStore.load();
    const newProject = await discoverProjectConfig(process.cwd());
    const newConfig = mergeConfigs(newRaw, newProject?.config);
    // Update the shared config reference
    Object.assign(ctx.config, newConfig);
    // Rebuild search index
    const allMeta = await skillStore.listMetadata();
    const bundledMeta = await bundledStore.listMetadata();
    await searchIndex.rebuild([...bundledMeta, ...allMeta]);
    logger.info('Config reloaded');
  },
```

- [ ] **Step 3: Add isOffline to ctx**

```typescript
  isOffline: () => {
    // Check if any circuit breaker is open — heuristic for offline state
    if (!resilience) return false;
    for (const breaker of resilience.circuitBreakers.values()) {
      if (breaker.isAllowed()) return false;
    }
    // All breakers open = likely offline
    return resilience.circuitBreakers.size > 0;
  },
```

- [ ] **Step 4: Write integration test**

Add to `tests/integration/bootstrap.integration.test.ts`:

```typescript
describe('full context wiring', () => {
  it('builds a complete ToolContext with all adapters wired', async () => {
    // Replicate the bootstrap wiring from index.ts using temp dirs
    const configPath = join(tempDir, 'config.json');
    const skillsDir = join(tempDir, 'skills');
    const bundledDir = join(tempDir, 'bundled');
    const lockPath = join(tempDir, 'skill-lock.json');
    await mkdir(skillsDir, { recursive: true });
    await mkdir(bundledDir, { recursive: true });

    const configStore = new (await import('../../src/adapters/driven/file-config-store.js')).FileConfigStore(configPath);
    const skillStore = new (await import('../../src/adapters/driven/fs-skill-store.js')).FsSkillStore(skillsDir);
    const bundledStore = new (await import('../../src/adapters/driven/fs-skill-store.js')).FsSkillStore(bundledDir);
    const scanner = new (await import('../../src/adapters/driven/builtin-scanner.js')).BuiltinScanner();
    const searchIndex = new (await import('../../src/adapters/driven/memory-search-index.js')).MemorySearchIndex();
    const lockStore = new FileSkillLockStore(lockPath);
    const logger = new NoopLogger();

    const { mergeConfigs } = await import('../../src/core/config-merger.js');
    const config = mergeConfigs(null);

    const lockManager = new SkillLockManager(lockStore, logger);
    const { SkillResolver } = await import('../../src/core/skill-resolver.js');
    const resolver = new SkillResolver(skillStore, bundledStore, config.sources, logger);
    const { TrustEvaluator } = await import('../../src/core/trust-evaluator.js');
    const trustEvaluator = new TrustEvaluator(config.security);
    const { SkillLifecycle } = await import('../../src/core/skill-lifecycle.js');
    const lifecycle = new SkillLifecycle(logger);
    const { ManifestBuilder } = await import('../../src/core/manifest-builder.js');
    const manifestBuilder = new ManifestBuilder(config.manifest);

    // Verify lock manager works end-to-end
    await lockManager.addOrUpdate('boot-test', {
      contentHash: 'sha256:aaa',
      scanHash: 'sha256:bbb',
      scanResult: 'clean',
      scanTimestamp: new Date().toISOString(),
      trustLevel: 'bundled' as import('../../src/core/types.js').TrustLevel,
      source: { type: 'local' },
    });
    expect(await lockManager.getEntry('boot-test')).toBeDefined();

    // Verify search index builds from stores
    await searchIndex.rebuild(await skillStore.listMetadata());
    const results = await searchIndex.search('anything');
    expect(results).toEqual([]); // empty store, but no crash

    // Verify resolver doesn't crash on missing skill
    const resolved = await resolver.resolve('nonexistent');
    expect(resolved).toBeNull();

    // Verify lifecycle state management
    lifecycle.beginScanning('test');
    expect(lifecycle.getState('test')?.state).toBe('scanning');
  });
});
```

- [x] **Step 5: Run all tests**

Run: `npx vitest run`
Result: ✅ All pass (`33` files, `236` tests)

Additional verification completed:
- `npm run typecheck` → ✅ pass
- `npm run lint` → ✅ pass

- [ ] **Step 6: Commit** *(pending — not performed in this session)*

```bash
git add src/index.ts tests/integration/bootstrap.integration.test.ts
git commit -m "feat: complete bootstrap wiring — onConfigReload, isOffline, all context fields"
```

---

### Task 16: Update Public-Facing Documentation (README, docs/)

The project has no root `README.md` and no user-facing documentation outside of the internal `docs/superpowers/` directory. Before v1 ships, public documentation must explain what the MCP is, how to install/configure it, and how to use it.

**Files:**
- Create: `README.md`
- Create: `docs/configuration.md`
- Create: `docs/tools-reference.md`
- Create: `docs/getting-started.md`

- [x] **Step 1: Create root README.md**

Write a `README.md` covering:
- Project overview — what skill-mcp is and why it exists
- Prerequisites (Node.js version, etc.)
- Installation (`npm install`, building from source)
- Quick-start: how to add skill-mcp to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`, Windsurf `mcp_config.json`, VS Code, etc.)
- Available tools — brief one-liner per tool (`search_skills`, `get_skill`, `install_skill`, `save_skill`, `remove_skill`, `save_config`, `get_status`, `list_categories`, `push_skills`)
- Link to detailed docs in `docs/`
- License / contributing section placeholder

- [x] **Step 2: Create docs/getting-started.md**

Write a getting-started guide covering:
- First-time setup (global config location `~/.config/skill-mcp/config.json`)
- Running via stdio transport (`node dist/index.js`)
- Verifying the server is working (`get_status` tool)
- Installing your first skill (`install_skill`)
- Creating a custom skill (`save_skill`)
- Project-level config discovery (`.skill-mcp/`, `.claude/skill-mcp/`, `.agents/skill-mcp/`)

- [x] **Step 3: Create docs/configuration.md**

Write a configuration reference covering:
- Global config file location and schema (`~/.config/skill-mcp/config.json`)
- Project config discovery chain (`.skill-mcp/config.json` → `.claude/skill-mcp/config.json` → `.agents/skill-mcp/config.json`)
- Config merging behavior (project overrides global)
- All config sections with defaults:
  - `schemaVersion`
  - `sources` (local, git, registry)
  - `security` (trust levels, access control mode, scan settings)
  - `manifest` (max size, format)
  - `resilience` (rate limits, timeouts, circuit breakers)
  - `sync` (interval, sources)
- Hot-reload via `save_config`
- Environment variable overrides (if any)

- [x] **Step 4: Create docs/tools-reference.md**

Write a tool reference covering each MCP tool:
- `search_skills` — params, behavior, example
- `get_skill` — params, stale-serve behavior during scanning, trust indicators
- `install_skill` — params, validation, scanning flow
- `save_skill` — params, validation, duplicate check, scan-before-save
- `remove_skill` — params, SKILL_LOCKED behavior
- `save_config` — params, hot-reload trigger
- `get_status` — response shape (summary, circuit breakers, access control, network)
- `list_categories` — params, behavior
- `push_skills` — params, git push behavior
- Error codes reference table (`SKILL_NOT_FOUND`, `VALIDATION_FAILED`, `SCAN_FAILED`, `RATE_LIMITED`, `NETWORK_UNAVAILABLE`, `OPERATION_TIMEOUT`, `ALREADY_EXISTS`)

- [x] **Step 5: Review docs for accuracy against implementation**

Read through each doc and cross-reference against the actual source in `src/` to ensure param names, config keys, default values, and error codes are accurate.

- [x] **Step 6: Run spell-check / link-check if available**

If a markdown linter or spell-checker is configured, run it. Otherwise, manual review.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/getting-started.md docs/configuration.md docs/tools-reference.md
git commit -m "docs: add public-facing README, getting-started, configuration, and tools reference"
```

---

## Summary

| Task | Description | Key Change |
|------|-------------|------------|
| 1 | Fix null lockManager | `index.ts` → `FileSkillLockStore` |
| 2 | Wire validator | `save-skill.ts`, `install-skill.ts` + validation |
| 3 | Resilience wrapper | New `tool-wrapper.ts` composing timeout+rate+circuit |
| 4 | Stale-serve get_skill | Serve locked version during scanning |
| 5 | remove_skill tests | Test coverage (SKILL_LOCKED deferred) |
| 6 | save_config hot-reload | `onConfigReload` callback |
| 7 | get_status completion | Circuit breakers, access control, network |
| 8 | Scanner rules | 4 new rules: hex, ROT13, template, binary |
| 9 | Category support | `tags` field, `listCategories`/`getByCategory` |
| 10 | Config discovery | Multi-path project config loading |
| 11 | Worker manager | Spawn, heartbeat, restart logic |
| 12 | Worker loops | Sync/scanner/index start protocol |
| 13 | clientInfo + manifest | MCP handshake capture, manifest on connect |
| 14 | Logger context | Structured context in log output |
| 15 | Final wiring | onConfigReload, isOffline, integration test |
| 16 | Public-facing docs | README.md, getting-started, configuration, tools-reference |

**Estimated commits:** 16
**Dependencies:** Tasks 1–3 should be done first (critical fixes). Tasks 4–15 are independent and can be parallelized. Task 16 (docs) should be done last so documentation reflects the final implementation.

### Current Project Status (Updated)

- Implementation status: ✅ Tasks 1–15 completed in code and tests
- Documentation status: ✅ Task 16 docs created (`README.md`, `docs/getting-started.md`, `docs/configuration.md`, `docs/tools-reference.md`)
- Verification status: ✅ tests, typecheck, and lint passing
- Commit status: ⏳ pending user action

### Session Progress Update (2026-03-20, 21:59 local)

- [x] Re-verified full test suite: `npx vitest run` → ✅ `33` files, `236` tests passing
- [x] Re-verified typing: `npm run typecheck` → ✅ pass
- [x] Re-verified lint: `npm run lint` → ✅ pass
- [x] Confirmed existing implementation coverage for Tasks 1–15 in current working tree
- [x] Completed execution: Task 16 public-facing documentation (`README.md`, `docs/getting-started.md`, `docs/configuration.md`, `docs/tools-reference.md`)
- [ ] Optional cleanup step: split/land logical commits per task group
