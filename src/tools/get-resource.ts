import type { ToolHandler } from './types.js';
import { resourceNotFound, skillNotFound, validationFailed } from '../core/errors.js';

interface GetResourceParams { skill: string; path: string; }

export const handleGetResource: ToolHandler<GetResourceParams> = async (params, ctx) => {
  if (!params.skill) {
    throw validationFailed([{ field: 'skill', message: 'skill name is required' }]);
  }
  if (!params.path) {
    throw validationFailed([{ field: 'path', message: 'resource path is required' }]);
  }

  const exists = await ctx.skillStore.exists(params.skill);
  if (!exists) {
    throw skillNotFound(params.skill, ['cache', 'bundled']);
  }

  const content = await ctx.skillStore.getResource(params.skill, params.path);
  if (content === null) {
    throw resourceNotFound(params.skill, params.path);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        skill: params.skill,
        path: params.path,
        content,
      }, null, 2),
    }],
  };
};
