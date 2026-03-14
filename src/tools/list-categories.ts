import type { ToolHandler } from './types.js';

export const handleListCategories: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  const categories = await ctx.searchIndex.listCategories();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        categories,
        count: categories.length,
      }, null, 2),
    }],
  };
};
