import { TrustLevel, type SkillMetadata } from './types.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
const CURRENT_SCHEMA_VERSION = 1;
const VALID_TRUST_LEVELS = new Set(Object.values(TrustLevel));

export function validateSkillMetadata(meta: Partial<SkillMetadata>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // name: required, 1-64 chars, lowercase + hyphens
  if (!meta.name || meta.name.length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else {
    if (meta.name.length > 64) {
      errors.push({ field: 'name', message: 'Name must be 64 characters or fewer' });
    }
    if (!SKILL_NAME_PATTERN.test(meta.name)) {
      errors.push({ field: 'name', message: 'Name must be lowercase letters, numbers, and hyphens only, starting with a letter' });
    }
  }

  // description: required, 1-1024 chars
  if (!meta.description || meta.description.length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  } else if (meta.description.length > 1024) {
    errors.push({ field: 'description', message: 'Description must be 1024 characters or fewer' });
  }

  // version: optional, must be semver if provided
  if (meta.version !== undefined && !SEMVER_PATTERN.test(meta.version)) {
    errors.push({ field: 'version', message: 'Version must be valid semver (e.g., 1.0.0)' });
  }

  // compatibility: optional, max 500 chars
  if (meta.compatibility !== undefined && meta.compatibility.length > 500) {
    errors.push({ field: 'compatibility', message: 'Compatibility must be 500 characters or fewer' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateConfig(config: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // schemaVersion
  if (config.schemaVersion !== undefined) {
    if (typeof config.schemaVersion !== 'number' || !Number.isInteger(config.schemaVersion) || config.schemaVersion < 1) {
      errors.push({ field: 'schemaVersion', message: 'schemaVersion must be a positive integer' });
    } else if (config.schemaVersion > CURRENT_SCHEMA_VERSION) {
      warnings.push({ field: 'schemaVersion', message: `Config schemaVersion ${config.schemaVersion} is newer than supported (${CURRENT_SCHEMA_VERSION}). Consider upgrading deft-mcp.` });
    }
  }

  // manifest.maxManifestSize
  const manifest = config.manifest as Record<string, unknown> | undefined;
  if (manifest?.maxManifestSize !== undefined) {
    if (typeof manifest.maxManifestSize !== 'number' || manifest.maxManifestSize < 0) {
      errors.push({ field: 'manifest.maxManifestSize', message: 'maxManifestSize must be a non-negative number' });
    }
  }

  // security.minTrustLevel
  const security = config.security as Record<string, unknown> | undefined;
  if (security?.minTrustLevel !== undefined) {
    if (typeof security.minTrustLevel !== 'string' || !VALID_TRUST_LEVELS.has(security.minTrustLevel as TrustLevel)) {
      errors.push({ field: 'security.minTrustLevel', message: `Invalid trust level. Must be one of: ${Array.from(VALID_TRUST_LEVELS).join(', ')}` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
