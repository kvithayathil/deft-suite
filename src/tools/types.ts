import type { ToolContext } from './context.js';

export type ToolResult = { content: Array<{ type: 'text'; text: string }> };
export type ToolHandler<P = Record<string, unknown>> = (params: P, ctx: ToolContext) => Promise<ToolResult>;
