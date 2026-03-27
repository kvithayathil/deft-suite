import { describe, it, expect } from 'vitest';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { TrustLevel } from '../../src/core/types.js';
import type { SecurityConfig } from '../../src/core/types.js';

function makeSecurityConfig(overrides: Partial<SecurityConfig> = {}): SecurityConfig {
  return {
    minTrustLevel: TrustLevel.Community,
    scanOnInstall: true,
    periodicScanIntervalHours: 24,
    accessControl: {
      mode: 'blocklist',
      blocked: [],
      allowed: [],
    },
    ...overrides,
  };
}

describe('TrustEvaluator', () => {
  describe('meetsThreshold', () => {
    it('allows skills above minimum trust', () => {
      const evaluator = new TrustEvaluator(makeSecurityConfig());
      expect(evaluator.meetsThreshold(TrustLevel.Verified)).toBe(true);
    });

    it('allows skills at minimum trust', () => {
      const evaluator = new TrustEvaluator(makeSecurityConfig());
      expect(evaluator.meetsThreshold(TrustLevel.Community)).toBe(true);
    });

    it('rejects skills below minimum trust', () => {
      const evaluator = new TrustEvaluator(makeSecurityConfig());
      expect(evaluator.meetsThreshold(TrustLevel.Unknown)).toBe(false);
    });

    it('bundled always meets threshold', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({ minTrustLevel: TrustLevel.Bundled }),
      );
      expect(evaluator.meetsThreshold(TrustLevel.Bundled)).toBe(true);
    });
  });

  describe('isSourceAllowed (blocklist mode)', () => {
    it('allows source not in blocklist', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'blocklist',
            blocked: [{ type: 'source', url: 'https://github.com/evil/*' }],
            allowed: [],
          },
        }),
      );
      expect(evaluator.isSourceAllowed('https://github.com/good/repo.git')).toBe(true);
    });

    it('blocks source in blocklist', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'blocklist',
            blocked: [{ type: 'source', url: 'https://github.com/evil/*' }],
            allowed: [],
          },
        }),
      );
      expect(evaluator.isSourceAllowed('https://github.com/evil/malware.git')).toBe(false);
    });

    it('blocks exact skill name', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'blocklist',
            blocked: [{ type: 'skill', name: 'bad-skill' }],
            allowed: [],
          },
        }),
      );
      expect(evaluator.isSkillAllowed('bad-skill')).toBe(false);
      expect(evaluator.isSkillAllowed('good-skill')).toBe(true);
    });
  });

  describe('isSourceAllowed (allowlist mode)', () => {
    it('allows source in allowlist', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'allowlist',
            blocked: [],
            allowed: [{ type: 'source', url: 'https://github.com/acme/*' }],
          },
        }),
      );
      expect(evaluator.isSourceAllowed('https://github.com/acme/skills.git')).toBe(true);
    });

    it('denies source not in allowlist', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'allowlist',
            blocked: [],
            allowed: [{ type: 'source', url: 'https://github.com/acme/*' }],
          },
        }),
      );
      expect(evaluator.isSourceAllowed('https://github.com/other/repo.git')).toBe(false);
    });

    it('always allows bundled skills regardless of mode', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'allowlist',
            blocked: [],
            allowed: [],
          },
        }),
      );
      expect(evaluator.isSkillAllowed('mcp-guide', true)).toBe(true);
    });
  });

  describe('wildcard matching', () => {
    it('matches trailing wildcard on org', () => {
      const evaluator = new TrustEvaluator(
        makeSecurityConfig({
          accessControl: {
            mode: 'blocklist',
            blocked: [{ type: 'source', url: 'https://github.com/evil-org/*' }],
            allowed: [],
          },
        }),
      );
      expect(evaluator.isSourceAllowed('https://github.com/evil-org/any-repo.git')).toBe(false);
      expect(evaluator.isSourceAllowed('https://github.com/evil-org-2/repo.git')).toBe(true);
    });
  });
});
