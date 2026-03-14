import type { ToolHandler } from './types.js';
import { validationFailed } from '../core/errors.js';
import { TrustLevel, SkillState } from '../core/types.js';
import type { Source } from '../core/types.js';

interface SaveSkillParams {
  name: string;
  content: string;
  description?: string;
}

export const handleSaveSkill: ToolHandler<SaveSkillParams> = async (params, ctx) => {
  const fieldErrors: Array<{ field: string; message: string }> = [];
  if (!params.name) {
    fieldErrors.push({ field: 'name', message: 'skill name is required' });
  }
  if (!params.content) {
    fieldErrors.push({ field: 'content', message: 'skill content is required' });
  }
  if (fieldErrors.length > 0) {
    throw validationFailed(fieldErrors);
  }

  const skill = {
    metadata: {
      name: params.name,
      description: params.description ?? '',
    },
    content: params.content,
    resources: [],
    trustLevel: TrustLevel.SelfApproved,
    state: SkillState.Active,
    sourcePath: params.name,
  };

  // Write to store
  await ctx.skillStore.write(params.name, skill);
  const hash = await ctx.skillStore.computeHash(params.name);

  // Mark active in lifecycle
  ctx.lifecycle.markActive(params.name, hash);

  // Add lock entry
  await ctx.lockManager.addOrUpdate(params.name, {
    contentHash: hash,
    scanHash: hash,
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
