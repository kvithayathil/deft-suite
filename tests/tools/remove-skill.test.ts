import { describe, it, expect } from 'vitest';
import { makeTestContext } from '../helpers/make-context.js';
import { handleRemoveSkill } from '../../src/tools/remove-skill.js';
import { SkillMcpError, ErrorCode } from '../../src/core/errors.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';

describe('handleRemoveSkill', () => {
  it('removes existing skill successfully', async () => {
    const ctx = makeTestContext();
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
    const ctx = makeTestContext();
    const err = await handleRemoveSkill({ name: 'nonexistent' }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.SkillNotFound);
  });

  it('throws VALIDATION_FAILED when name is empty', async () => {
    const ctx = makeTestContext();
    const err = await handleRemoveSkill({ name: '' }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkillMcpError);
    expect((err as SkillMcpError).code).toBe(ErrorCode.ValidationFailed);
  });

  it('rebuilds search index after successful remove', async () => {
    const ctx = makeTestContext();
    await ctx.skillStore.write('to-remove', {
      metadata: { name: 'to-remove', description: 'to remove' },
      content: 'body',
      resources: [],
      trustLevel: TrustLevel.Community,
      state: SkillState.Active,
      sourcePath: 'to-remove',
    });

    await ctx.searchIndex.rebuild([{ name: 'to-remove', description: 'to remove' }]);

    await handleRemoveSkill({ name: 'to-remove' }, ctx);

    const results = await ctx.searchIndex.search('to-remove');
    expect(results.some((result) => result.name === 'to-remove')).toBe(false);
  });
});
