import type { ToolHandler } from './types.js';
import { parseSourceString } from '../core/skill-resolver.js';
import type { Source } from '../core/types.js';
import {
  alreadyInstalled,
  skillNotFound,
  permissionDenied,
  scanFailed,
  validationFailed,
} from '../core/errors.js';
import { validateSkillMetadata } from '../core/validator.js';
import { rebuildSearchIndex } from './rebuild-search-index.js';

interface InstallSkillParams {
  skill: string;
  target_dir?: string;
  platform?: string;
  source?: string;
}

export const handleInstallSkill: ToolHandler<InstallSkillParams> = async (params, ctx) => {
  const { skill: name, platform, source } = params;
  const resolveOptions = source ? parseSourceString(source) : undefined;

  // 1. Duplicate check
  const existing = await ctx.skillStore.exists(name);
  if (existing) {
    throw alreadyInstalled(name);
  }

  // 2. Access control check
  if (!ctx.trustEvaluator.isSkillAllowed(name)) {
    throw permissionDenied('install', name);
  }

  // 3. Resolve skill
  const resolved = await ctx.resolver.resolve(name, resolveOptions);
  if (!resolved) {
    throw skillNotFound(name, [source ?? 'default']);
  }

  // 3b. Validate resolved skill metadata
  const validation = validateSkillMetadata(resolved.metadata);
  if (!validation.valid) {
    throw validationFailed(validation.errors);
  }

  // 4. Begin scanning
  ctx.lifecycle.beginScanning(name);

  // 5. Scan
  const scanResult = await ctx.scanner.scanSkill(resolved.sourcePath ?? name, name);
  if (!scanResult.passed) {
    ctx.lifecycle.markQuarantined(
      name,
      scanResult.findings.map((f) => f.message),
    );
    throw scanFailed(name, scanResult.findings);
  }

  // 6. Write to store + update lifecycle
  await ctx.skillStore.write(name, resolved);
  const hash = await ctx.skillStore.computeHash(name);
  ctx.lifecycle.markActive(name, hash);

  // 7. Update lock
  await ctx.lockManager.addOrUpdate(name, {
    contentHash: hash,
    scanHash: scanResult.hash,
    scanResult: 'clean',
    scanTimestamp: new Date().toISOString(),
    trustLevel: resolved.trustLevel,
    source: { type: 'local' } as Source,
  });

  await rebuildSearchIndex(ctx);

  ctx.usageStore?.recordAccess(name);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            installed: name,
            path: name,
            platform: platform ?? 'generic',
            registration: `Skill '${name}' installed successfully.`,
          },
          null,
          2,
        ),
      },
    ],
  };
};
