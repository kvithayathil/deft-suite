import type { ToolHandler } from './types.js';
import { invalidQuery } from '../core/errors.js';

interface SearchParams { query: string; limit?: number; }

export const handleSearchSkills: ToolHandler<SearchParams> = async (params, ctx) => {
  if (!params.query || params.query.trim().length === 0) {
    throw invalidQuery(params.query ?? '', 'Query cannot be empty');
  }

  const results = await ctx.searchIndex.search(params.query);

  return {
    content: [{ type: 'text', text: JSON.stringify({ results, offline: ctx.isOffline?.() ?? false }, null, 2) }],
  };
};
