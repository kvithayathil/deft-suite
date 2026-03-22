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

  // Stale-serve behavior: while scanning, serve the currently resolvable version
  // and mark the response explicitly as stale + scanning.
  if (entry?.state === SkillState.Scanning) {
    const lockEntry = await ctx.lockManager.getEntry(params.name);
    if (!lockEntry && !entry.previousHash) {
      throw skillNotFound(params.name, ['scanning — no previous version available']);
    }

    const staleSkill = await ctx.resolver.resolve(params.name);
    if (!staleSkill) {
      throw skillNotFound(params.name, ['cache', 'bundled']);
    }

    const staleIndicator = TRUST_INDICATORS[staleSkill.trustLevel];
    const staleVendorConfig = ctx.vendorConfigOverlay
      ? await ctx.vendorConfigOverlay(params.name, staleSkill)
      : undefined;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: staleSkill.metadata.name,
          description: staleSkill.metadata.description,
          trust: `${staleIndicator} ${staleSkill.trustLevel}`,
          content: staleSkill.content,
          resources: staleSkill.resources,
          stale: true,
          scanning: true,
          ...(staleVendorConfig ? { vendor_config: staleVendorConfig } : {}),
        }, null, 2),
      }],
    };
  }

  // Resolve the skill
  const skill = await ctx.resolver.resolve(params.name);
  if (!skill) {
    throw skillNotFound(params.name, ['cache', 'bundled']);
  }

  ctx.usageStore?.recordAccess(params.name);

  const indicator = TRUST_INDICATORS[skill.trustLevel];
  const stale = false;

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
