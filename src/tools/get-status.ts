import type { ToolHandler } from './types.js';
import { SkillState } from '../core/types.js';

export const handleGetStatus: ToolHandler<Record<string, unknown>> = async (_params, ctx) => {
  // Aggregate lifecycle states
  const lifecycleAll = ctx.lifecycle.listAll();
  const states: Record<string, { state: string; hash: string | null; findings: string[] }> = {};
  for (const [name, entry] of lifecycleAll) {
    states[name] = {
      state: entry.state,
      hash: entry.currentHash,
      findings: entry.findings,
    };
  }

  const activeSkills = ctx.lifecycle.listByState(SkillState.Active);
  const scanningSkills = ctx.lifecycle.listByState(SkillState.Scanning);
  const quarantinedSkills = ctx.lifecycle.listByState(SkillState.Quarantined);
  const forcedSkills = ctx.lifecycle.listByState(SkillState.ActiveForced);

  // Lock info
  const lockedSkills = await ctx.lockManager.listLockedSkills();

  // Store info
  const installedNames = await ctx.skillStore.listNames();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        summary: {
          installed: installedNames.length,
          active: activeSkills.length,
          scanning: scanningSkills.length,
          quarantined: quarantinedSkills.length,
          forced: forcedSkills.length,
          locked: lockedSkills.length,
        },
        skills: states,
        lock: {
          lockedSkills,
        },
      }, null, 2),
    }],
  };
};
