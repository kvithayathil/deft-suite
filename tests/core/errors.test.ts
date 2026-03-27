import { describe, it, expect } from 'vitest';
import {
  SkillMcpError,
  ErrorCode,
  skillNotFound,
  scanFailed,
  networkUnavailable,
  validationFailed,
  accessDenied,
  rateLimited,
  internalError,
  alreadyInstalled,
  skillQuarantined,
} from '../../src/core/errors.js';

describe('SkillMcpError', () => {
  it('creates structured error with all fields', () => {
    const err = new SkillMcpError(
      ErrorCode.SkillNotFound,
      'Skill "foo" not found',
      'not_found',
      { searched: ['cache', 'bundled'] },
      true,
      false,
    );
    expect(err.code).toBe('SKILL_NOT_FOUND');
    expect(err.message).toBe('Skill "foo" not found');
    expect(err.category).toBe('not_found');
    expect(err.details.searched).toEqual(['cache', 'bundled']);
    expect(err.recoverable).toBe(true);
    expect(err.retry).toBe(false);
  });

  it('toResponse returns structured JSON', () => {
    const err = new SkillMcpError(
      ErrorCode.ScanFailed,
      'Scan found issues',
      'security',
      { findings: 3 },
      false,
      false,
    );
    const response = err.toResponse();
    expect(response.error.code).toBe('SCAN_FAILED');
    expect(response.error.category).toBe('security');
    expect(response.error.recoverable).toBe(false);
  });
});

describe('error factory functions', () => {
  it('skillNotFound includes suggestion', () => {
    const err = skillNotFound('tdd-pythom', ['cache'], 'tdd-python');
    expect(err.code).toBe('SKILL_NOT_FOUND');
    expect(err.category).toBe('not_found');
    expect(err.details.suggestion).toContain('tdd-python');
    expect(err.recoverable).toBe(true);
  });

  it('networkUnavailable is recoverable with retry', () => {
    const err = networkUnavailable('https://example.com', 'Connection refused');
    expect(err.code).toBe('NETWORK_UNAVAILABLE');
    expect(err.category).toBe('network');
    expect(err.recoverable).toBe(true);
    expect(err.retry).toBe(true);
  });

  it('scanFailed includes findings in details', () => {
    const err = scanFailed('my-skill', [
      {
        rule: 'prompt-injection',
        severity: 'critical',
        message: 'found override phrase',
        file: 'SKILL.md',
      },
    ]);
    expect(err.code).toBe('SCAN_FAILED');
    expect(err.category).toBe('security');
    expect(err.details.findings).toHaveLength(1);
    expect(err.recoverable).toBe(false);
  });

  it('accessDenied explains policy', () => {
    const err = accessDenied('evil-skill', 'https://evil.com/skills', 'blocklist');
    expect(err.code).toBe('ACCESS_DENIED');
    expect(err.category).toBe('security');
    expect(err.details.policy).toBe('blocklist');
  });

  it('rateLimited includes retryAfterMs', () => {
    const err = rateLimited('search_skills', 3000);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.category).toBe('rate_limited');
    expect(err.details.retryAfterMs).toBe(3000);
    expect(err.retry).toBe(true);
  });

  it('validationFailed includes field errors', () => {
    const err = validationFailed([{ field: 'name', message: 'required' }]);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.category).toBe('validation');
    expect(err.details.fieldErrors).toHaveLength(1);
  });

  it('internalError is never recoverable', () => {
    const err = internalError('unexpected null');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.category).toBe('internal');
    expect(err.recoverable).toBe(false);
    expect(err.retry).toBe(false);
  });

  it('alreadyInstalled includes version info', () => {
    const err = alreadyInstalled('tdd-python', '1.0.0');
    expect(err.code).toBe('ALREADY_INSTALLED');
    expect(err.category).toBe('conflict');
    expect(err.details.currentVersion).toBe('1.0.0');
  });

  it('skillQuarantined includes scan findings', () => {
    const err = skillQuarantined('bad-skill', [
      { rule: 'eval-usage', severity: 'critical', message: 'dynamic eval', file: 'scripts/run.js' },
    ]);
    expect(err.code).toBe('SKILL_QUARANTINED');
    expect(err.category).toBe('security');
  });
});
