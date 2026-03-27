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

  const summary = {
    installed: (await ctx.skillStore.listNames()).length,
    active: ctx.lifecycle.listByState(SkillState.Active).length,
    scanning: ctx.lifecycle.listByState(SkillState.Scanning).length,
    quarantined: ctx.lifecycle.listByState(SkillState.Quarantined).length,
    forced: ctx.lifecycle.listByState(SkillState.ActiveForced).length,
    locked: (await ctx.lockManager.listLockedSkills()).length,
  };

  // Lock info
  const lockedSkills = await ctx.lockManager.listLockedSkills();

  // Circuit breaker info
  const circuitBreakers: Record<string, string> = {};
  if (ctx.resilience) {
    for (const [source, breaker] of ctx.resilience.circuitBreakers) {
      circuitBreakers[source] = breaker.getState();
    }
  }

  // Access control info
  const accessControl = { mode: ctx.config.security.accessControl.mode };

  // Network status
  const network = ctx.isOffline?.() ? 'unavailable' : 'available';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            summary,
            skills: states,
            lock: {
              lockedSkills,
            },
            circuitBreakers,
            accessControl,
            network,
          },
          null,
          2,
        ),
      },
    ],
  };
};
