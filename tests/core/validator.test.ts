import { describe, it, expect } from 'vitest';
import {
  validateSkillMetadata,
  validateConfig,
  type ValidationResult,
} from '../../src/core/validator.js';
import { TrustLevel } from '../../src/core/types.js';

describe('validateSkillMetadata', () => {
  it('accepts valid metadata', () => {
    const result = validateSkillMetadata({
      name: 'tdd-python',
      description: 'Python TDD patterns',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing name', () => {
    const result = validateSkillMetadata({
      name: '',
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name' }),
    );
  });

  it('rejects name > 64 chars', () => {
    const result = validateSkillMetadata({
      name: 'a'.repeat(65),
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects name with uppercase or special chars', () => {
    const result = validateSkillMetadata({
      name: 'My_Skill!',
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts name with lowercase and hyphens', () => {
    const result = validateSkillMetadata({
      name: 'my-cool-skill',
      description: 'A skill',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects missing description', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: '',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects description > 1024 chars', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: 'a'.repeat(1025),
    });
    expect(result.valid).toBe(false);
  });

  it('accepts optional version field as semver', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: 'A skill',
      version: '1.2.3',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid version format', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: 'A skill',
      version: 'not-semver',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts optional compatibility field under 500 chars', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: 'A skill',
      compatibility: 'Python 3.8+',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects compatibility > 500 chars', () => {
    const result = validateSkillMetadata({
      name: 'valid-name',
      description: 'A skill',
      compatibility: 'a'.repeat(501),
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateConfig', () => {
  it('accepts valid schemaVersion', () => {
    const result = validateConfig({ schemaVersion: 1 });
    expect(result.valid).toBe(true);
  });

  it('warns on unknown schemaVersion', () => {
    const result = validateConfig({ schemaVersion: 99 });
    expect(result.valid).toBe(true); // Still valid, but with warnings
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'schemaVersion' }),
    );
  });

  it('rejects invalid manifest maxManifestSize', () => {
    const result = validateConfig({
      schemaVersion: 1,
      manifest: { maxManifestSize: -1 },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid trust level string', () => {
    const result = validateConfig({
      schemaVersion: 1,
      security: { minTrustLevel: 'super-trusted' },
    });
    expect(result.valid).toBe(false);
  });
});
