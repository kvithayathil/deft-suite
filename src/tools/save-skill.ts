import type { ToolHandler } from './types.js';
import { validationFailed, alreadyExists, scanFailed } from '../core/errors.js';
import { validateSkillMetadata } from '../core/validator.js';
import { TrustLevel, SkillState } from '../core/types.js';
import type { Source } from '../core/types.js';

interface SaveSkillParams {
  name: string;
  content: string;
  description?: string;
}

export const handleSaveSkill: ToolHandler<SaveSkillParams> = async (params, ctx) => {
  // 1. Basic param check
  const fieldErrors: Array<{ field: string; message: string }> = [];
  if (!params.name) {
    fieldErrors.push({ field: 'name', message: 'skill name is required' });
  }
  if (!params.content) {
    fieldErrors.push({ field: 'content', message: 'skill content is required' });
  }
  if (fieldErrors.length > 0) {
    throw validationFailed(fieldErrors);
  }

  // 2. Metadata validation
  const validation = validateSkillMetadata({
    name: params.name,
    description: params.description ?? '',
  });
  if (!validation.valid) {
    throw validationFailed(validation.errors);
  }

  // 3. Duplicate check
  const exists = await ctx.skillStore.exists(params.name);
  if (exists) {
    throw alreadyExists(params.name);
  }

  const skill = {
    metadata: {
      name: params.name,
      description: params.description ?? '',
    },
    content: params.content,
    resources: [],
    trustLevel: TrustLevel.SelfApproved,
    state: SkillState.Active,
    sourcePath: params.name,
  };

  // 4. Scan before save
  ctx.lifecycle.beginScanning(params.name);
  const scanResult = await ctx.scanner.scanSkill(params.name, params.name);
  if (!scanResult.passed) {
    ctx.lifecycle.markQuarantined(params.name, scanResult.findings.map((f) => f.message));
    throw scanFailed(params.name, scanResult.findings);
  }

  // 5. Write to store
  await ctx.skillStore.write(params.name, skill);
  const hash = await ctx.skillStore.computeHash(params.name);

  // 6. Mark active in lifecycle
  ctx.lifecycle.markActive(params.name, hash);

  // 7. Add lock entry
  await ctx.lockManager.addOrUpdate(params.name, {
    contentHash: hash,
    scanHash: scanResult.hash,
    scanResult: 'clean',
    scanTimestamp: new Date().toISOString(),
    trustLevel: TrustLevel.SelfApproved,
    source: { type: 'local' } as Source,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        saved: params.name,
        hash: hash.slice(0, 8),
        message: `Skill '${params.name}' saved successfully.`,
      }, null, 2),
    }],
  };
};
