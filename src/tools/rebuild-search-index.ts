import type { ToolContext } from './context.js';

export async function rebuildSearchIndex(ctx: ToolContext): Promise<void> {
  const [bundledMeta, installedMeta] = await Promise.all([
    ctx.bundledStore.listMetadata(),
    ctx.skillStore.listMetadata(),
  ]);

  await ctx.searchIndex.rebuild([...bundledMeta, ...installedMeta]);
}
