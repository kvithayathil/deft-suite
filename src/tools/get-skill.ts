import type { ToolHandler } from './types.js';
import { skillNotFound, skillQuarantined } from '../core/errors.js';
import { SkillState, TRUST_INDICATORS } from '../core/types.js';

interface GetSkillParams { name: string; }

export const handleGetSkill: ToolHandler<GetSkillParams> = async (params, ctx) => {
  const entry = ctx.lifecycle.getState(params.name);

  // Check lifecycle state
  if (entry?.state === SkillState.Quarantined) {
    throw skillQuarantined(params.name, entry.findings.map(f => ({
      rule: 'scan', severity: 'critical' as const, message: f, file: 'SKILL.md',
    })));
  }

  // Resolve the skill
  const skill = await ctx.resolver.resolve(params.name);
  if (!skill) {
    throw skillNotFound(params.name, ['cache', 'bundled']);
  }

  const indicator = TRUST_INDICATORS[skill.trustLevel];
  const stale = entry?.state === SkillState.Scanning;

  // Vendor config overlay
  const vendorConfig = ctx.vendorConfigOverlay
    ? await ctx.vendorConfigOverlay(params.name, skill)
    : undefined;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        name: skill.metadata.name,
        description: skill.metadata.description,
        trust: `${indicator} ${skill.trustLevel}`,
        content: skill.content,
        resources: skill.resources,
        stale,
        ...(vendorConfig ? { vendor_config: vendorConfig } : {}),
      }, null, 2),
    }],
  };
};
