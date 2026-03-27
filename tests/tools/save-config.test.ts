import { makeTestContext } from "../helpers/make-context.js";
import { describe, it, expect, vi } from 'vitest';
import { handleSaveConfig } from '../../src/tools/save-config.js';

describe('handleSaveConfig', () => {
  it('saves config and calls onConfigReload', async () => {
    const ctx = makeTestContext();
    const reloadFn = vi.fn(async () => {});
    ctx.onConfigReload = reloadFn;

    const result = await handleSaveConfig({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe(true);
    expect(reloadFn).toHaveBeenCalledOnce();
  });

  it('saves config without error when onConfigReload is not set', async () => {
    const ctx = makeTestContext();
    const result = await handleSaveConfig({}, ctx);
    const body = JSON.parse(result.content[0].text);
    expect(body.saved).toBe(true);
  });
});
