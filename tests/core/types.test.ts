import { describe, it, expect } from 'vitest';
import {
  TrustLevel,
  SkillState,
  TRUST_ORDINALS,
  type Skill,
  type SkillMetadata,
  type SkillLockEntry,
  type SkillLock,
  type Source,
  type Config,
  type ErrorResponse,
  type ErrorCategory,
  compareTrust,
  meetsMinTrust,
} from '../../src/core/types.js';

describe('TrustLevel', () => {
  it('has correct ordinals', () => {
    expect(TRUST_ORDINALS[TrustLevel.Unknown]).toBe(0);
    expect(TRUST_ORDINALS[TrustLevel.Community]).toBe(1);
    expect(TRUST_ORDINALS[TrustLevel.SelfApproved]).toBe(2);
    expect(TRUST_ORDINALS[TrustLevel.Verified]).toBe(3);
    expect(TRUST_ORDINALS[TrustLevel.Bundled]).toBe(4);
  });

  it('compareTrust returns correct ordering', () => {
    expect(compareTrust(TrustLevel.Bundled, TrustLevel.Unknown)).toBeGreaterThan(0);
    expect(compareTrust(TrustLevel.Unknown, TrustLevel.Bundled)).toBeLessThan(0);
    expect(compareTrust(TrustLevel.Verified, TrustLevel.Verified)).toBe(0);
  });

  it('meetsMinTrust checks threshold', () => {
    expect(meetsMinTrust(TrustLevel.Verified, TrustLevel.Community)).toBe(true);
    expect(meetsMinTrust(TrustLevel.Community, TrustLevel.Verified)).toBe(false);
    expect(meetsMinTrust(TrustLevel.Bundled, TrustLevel.Bundled)).toBe(true);
  });
});

describe('SkillState', () => {
  it('has all lifecycle states', () => {
    expect(SkillState.Scanning).toBe('scanning');
    expect(SkillState.Active).toBe('active');
    expect(SkillState.Quarantined).toBe('quarantined');
    expect(SkillState.ActiveForced).toBe('active_forced');
  });
});
