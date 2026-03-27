import { describe, it, expect } from 'vitest';
import { makeTestContext } from '../helpers/make-context.js';
import { handleSaveSkill } from '../../src/tools/save-skill.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';

function makeContext() {
  return makeTestContext();
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

  it('passes resources to skill store during save', async () => {
    const ctx = makeContext();
    const result = await handleSaveSkill(
      {
        name: 'res-skill',
        content: '---\nname: res-skill\ndescription: skill with resources\n---\nBody',
        description: 'skill with resources',
        resources: {
          'scripts/setup.sh': '#!/bin/bash\necho hello',
          'README.md': '# Resource readme',
        },
      },
      ctx,
    );

    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe('res-skill');

    const stored = await ctx.skillStore.get('res-skill');
    expect(stored).not.toBeNull();
    expect(stored!.resources).toContain('scripts/setup.sh');
    expect(stored!.resources).toContain('README.md');

    const setupContent = await ctx.skillStore.getResource('res-skill', 'scripts/setup.sh');
    expect(setupContent).toContain('echo hello');
  });

  it('rebuilds search index after successful save', async () => {
    const ctx = makeTestContext();

    await handleSaveSkill(
      {
        name: 'searchable-skill',
        content: '---\nname: searchable-skill\ndescription: can be found\n---\nBody',
        description: 'can be found',
      },
      ctx,
    );

    const results = await ctx.searchIndex.search('searchable-skill');
    expect(results.some((r) => r.name === 'searchable-skill')).toBe(true);
  });
});
