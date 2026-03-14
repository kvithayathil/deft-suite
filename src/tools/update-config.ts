import type { ToolHandler } from './types.js';
import { validationFailed, configLocked } from '../core/errors.js';

interface UpdateConfigParams {
  key: string;
  value: unknown;
}

// Keys that cannot be overridden at session level
const LOCKED_KEYS = new Set(['schemaVersion', 'metadata']);

export const handleUpdateConfig: ToolHandler<UpdateConfigParams> = async (params, ctx) => {
  if (!params.key) {
    throw validationFailed([{ field: 'key', message: 'config key is required' }]);
  }
  if (params.value === undefined) {
    throw validationFailed([{ field: 'value', message: 'config value is required' }]);
  }

  const topLevelKey = params.key.split('.')[0];
  if (LOCKED_KEYS.has(topLevelKey)) {
    throw configLocked(params.key);
  }

  // Merge into session config (in-memory only, no disk write)
  const parts = params.key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = ctx.config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = params.value;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        updated: params.key,
        value: params.value,
        persisted: false,
        message: `Config key '${params.key}' updated in session. Use save_config to persist.`,
      }, null, 2),
    }],
  };
};
