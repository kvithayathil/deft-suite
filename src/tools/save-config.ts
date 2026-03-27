import type { ToolHandler } from './types.js';

export const handleSaveConfig: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  await ctx.configStore.save(ctx.rawConfig);

  if (ctx.onConfigReload) {
    await ctx.onConfigReload();
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            saved: true,
            path: ctx.configStore.getPath(),
            message: `Config saved and reloaded from '${ctx.configStore.getPath()}'.`,
          },
          null,
          2,
        ),
      },
    ],
  };
};
