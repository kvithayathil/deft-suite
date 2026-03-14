import type { ToolHandler } from './types.js';
import { skillNotFound, validationFailed } from '../core/errors.js';

interface RemoveSkillParams { name: string; }

export const handleRemoveSkill: ToolHandler<RemoveSkillParams> = async (params, ctx) => {
  if (!params.name) {
    throw validationFailed([{ field: 'name', message: 'skill name is required' }]);
  }

  const exists = await ctx.skillStore.exists(params.name);
  if (!exists) {
    throw skillNotFound(params.name, ['cache']);
  }

  // Delete from store
  await ctx.skillStore.delete(params.name);

  // Remove from lock
  await ctx.lockManager.remove(params.name);

  // Remove from lifecycle
  ctx.lifecycle.remove(params.name);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        removed: params.name,
        message: `Skill '${params.name}' has been removed successfully.`,
      }, null, 2),
    }],
  };
};
