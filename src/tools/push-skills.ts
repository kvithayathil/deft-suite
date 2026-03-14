import type { ToolHandler } from './types.js';
import { networkUnavailable } from '../core/errors.js';

export const handlePushSkills: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  if (ctx.isOffline?.()) {
    throw networkUnavailable(ctx.config.push.remote, 'device is offline');
  }

  // Placeholder: network push not yet implemented
  throw networkUnavailable(ctx.config.push.remote, 'push is not yet implemented');
};
