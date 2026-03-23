import type { ToolHandler } from './types.js';
import { validationFailed, alreadyExists, scanFailed } from '../core/errors.js';
import { validateSkillMetadata } from '../core/validator.js';
import { TrustLevel, SkillState } from '../core/types.js';
import type { Source } from '../core/types.js';
import { parse as parseYaml } from 'yaml';

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

  // 2. Extract description from frontmatter if not provided explicitly
  let description = params.description ?? '';
  if (!description) {
    const fm = params.content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
    if (fm) {
      try {
        const parsed = parseYaml(fm[1]) as Record<string, unknown>;
        if (typeof parsed?.description === 'string') {
          description = parsed.description;
        }
      } catch { /* ignore malformed frontmatter */ }
    }
  }

  // 3. Metadata validation
  const validation = validateSkillMetadata({
    name: params.name,
    description,
  });
  if (!validation.valid) {
    throw validationFailed(validation.errors);
  }

  // 4. Duplicate check
  const exists = await ctx.skillStore.exists(params.name);
  if (exists) {
    throw alreadyExists(params.name);
  }

  const skill = {
    metadata: {
      name: params.name,
      description,
    },
    content: params.content,
    resources: [],
    trustLevel: TrustLevel.SelfApproved,
    state: SkillState.Active,
    sourcePath: params.name,
  };

  // 5. Write to store first (scanner needs filesystem path)
  await ctx.skillStore.write(params.name, skill);

  // 6. Read back to get the real filesystem sourcePath
  const stored = await ctx.skillStore.get(params.name);
  const scanPath = stored?.sourcePath ?? params.name;

  // 7. Scan after write — roll back on failure
  ctx.lifecycle.beginScanning(params.name);
  const scanResult = await ctx.scanner.scanSkill(scanPath, params.name);
  if (!scanResult.passed) {
    await ctx.skillStore.delete(params.name);
    ctx.lifecycle.markQuarantined(params.name, scanResult.findings.map((f) => f.message));
    throw scanFailed(params.name, scanResult.findings);
  }

  const hash = await ctx.skillStore.computeHash(params.name);

  // 8. Mark active in lifecycle
  ctx.lifecycle.markActive(params.name, hash);

  // 9. Add lock entry
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
