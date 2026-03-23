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

describe('handleSaveSkill', () => {
  it('rejects skill with invalid name format', async () => {
    const ctx = makeContext();
    const err = await handleSaveSkill(
      { name: 'UPPERCASE-BAD', content: '---\nname: UPPERCASE-BAD\ndescription: test\n---\nBody' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ValidationFailed);
  });

  it('rejects skill with missing description', async () => {
    const ctx = makeContext();
    const err = await handleSaveSkill(
      { name: 'good-name', content: '---\nname: good-name\n---\nBody' },
      ctx,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ValidationFailed);
  });

  it('rejects duplicate skill', async () => {
    const ctx = makeContext();
    await ctx.skillStore.write('existing-skill', {
      metadata: { name: 'existing-skill', description: 'exists' },
      content: 'body',
      resources: [],
      trustLevel: TrustLevel.Community,
      state: SkillState.Active,
      sourcePath: 'existing-skill',
    });

    const err = await handleSaveSkill(
      {
        name: 'existing-skill',
        content: '---\nname: existing-skill\ndescription: test\n---\nBody',
        description: 'test',
      },
      ctx,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.AlreadyExists);
  });

  it('scans skill after writing and rolls back on failure', async () => {
    const ctx = makeContext();
    (ctx.scanner as StubScanner).failSkill('bad-skill', [
      { rule: 'scan', severity: 'critical', message: 'Bad file', file: 'SKILL.md' },
    ]);

    const err = await handleSaveSkill(
      {
        name: 'bad-skill',
        content: '---\nname: bad-skill\ndescription: a bad skill\n---\nBody',
        description: 'a bad skill',
      },
      ctx,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ScanFailed);
    // Verify rollback: skill should be deleted after failed scan
    const exists = await ctx.skillStore.exists('bad-skill');
    expect(exists).toBe(false);
  });

  it('extracts description from frontmatter when not passed explicitly', async () => {
    const ctx = makeContext();
    const result = await handleSaveSkill(
      {
        name: 'fm-desc-skill',
        content: '---\nname: fm-desc-skill\ndescription: Extracted from frontmatter\n---\nBody',
      },
      ctx,
    );

    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe('fm-desc-skill');
    const stored = await ctx.skillStore.get('fm-desc-skill');
    expect(stored!.metadata.description).toBe('Extracted from frontmatter');
  });

  it('saves valid skill successfully', async () => {
    const ctx = makeContext();
    const result = await handleSaveSkill(
      {
        name: 'good-skill',
        content: '---\nname: good-skill\ndescription: a good skill\n---\nBody',
        description: 'a good skill',
      },
      ctx,
    );

    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe('good-skill');
  });
});
