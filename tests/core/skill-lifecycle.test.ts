import { describe, it, expect } from 'vitest';
import { SkillLifecycle, type SkillStateEntry } from '../../src/core/skill-lifecycle.js';
import { SkillState, TrustLevel } from '../../src/core/types.js';
import { NoopLogger } from '../helpers/noop-logger.js';

describe('SkillLifecycle', () => {
  function setup() {
    const logger = new NoopLogger();
    const lifecycle = new SkillLifecycle(logger);
    return { lifecycle, logger };
  }

  describe('initial state', () => {
    it('starts with no entries', () => {
      const { lifecycle } = setup();
      expect(lifecycle.getState('any-skill')).toBeNull();
    });
  });

  describe('beginScanning', () => {
    it('sets state to scanning for new skill', () => {
      const { lifecycle } = setup();
      lifecycle.beginScanning('tdd-python');
      expect(lifecycle.getState('tdd-python')?.state).toBe(SkillState.Scanning);
    });

    it('preserves previous version reference during scan', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      lifecycle.beginScanning('tdd-python');

      const entry = lifecycle.getState('tdd-python');
      expect(entry?.state).toBe(SkillState.Scanning);
      expect(entry?.previousHash).toBe('hash-v1');
    });
  });

  describe('markActive', () => {
    it('transitions from scanning to active', () => {
      const { lifecycle } = setup();
      lifecycle.beginScanning('tdd-python');
      lifecycle.markActive('tdd-python', 'hash-v1');

      const entry = lifecycle.getState('tdd-python');
      expect(entry?.state).toBe(SkillState.Active);
      expect(entry?.currentHash).toBe('hash-v1');
      expect(entry?.previousHash).toBeNull();
    });

    it('can set active without prior scanning state', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      expect(lifecycle.getState('tdd-python')?.state).toBe(SkillState.Active);
    });
  });

  describe('markQuarantined', () => {
    it('transitions from scanning to quarantined', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      lifecycle.beginScanning('tdd-python');
      lifecycle.markQuarantined('tdd-python', ['prompt injection detected']);

      const entry = lifecycle.getState('tdd-python');
      expect(entry?.state).toBe(SkillState.Quarantined);
      expect(entry?.findings).toEqual(['prompt injection detected']);
      expect(entry?.previousHash).toBe('hash-v1'); // Rollback target preserved
    });
  });

  describe('forceApprove', () => {
    it('transitions from quarantined to active_forced', () => {
      const { lifecycle } = setup();
      lifecycle.markQuarantined('tdd-python', ['finding']);
      lifecycle.forceApprove('tdd-python');

      expect(lifecycle.getState('tdd-python')?.state).toBe(SkillState.ActiveForced);
    });

    it('rejects force-approve on non-quarantined skill', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      expect(() => lifecycle.forceApprove('tdd-python')).toThrow();
    });

    it('logs force-approval', () => {
      const { lifecycle, logger } = setup();
      lifecycle.markQuarantined('tdd-python', ['finding']);
      lifecycle.forceApprove('tdd-python');

      expect(logger.messages).toContainEqual(
        expect.objectContaining({ level: 'warn', message: expect.stringContaining('force-approved') }),
      );
    });
  });

  describe('isServable', () => {
    it('active is servable', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      expect(lifecycle.isServable('tdd-python')).toBe(true);
    });

    it('active_forced is servable', () => {
      const { lifecycle } = setup();
      lifecycle.markQuarantined('tdd-python', ['finding']);
      lifecycle.forceApprove('tdd-python');
      expect(lifecycle.isServable('tdd-python')).toBe(true);
    });

    it('quarantined is not servable', () => {
      const { lifecycle } = setup();
      lifecycle.markQuarantined('tdd-python', ['finding']);
      expect(lifecycle.isServable('tdd-python')).toBe(false);
    });

    it('scanning is servable if previous version exists', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      lifecycle.beginScanning('tdd-python');
      expect(lifecycle.isServable('tdd-python')).toBe(true);
    });

    it('scanning is not servable if no previous version', () => {
      const { lifecycle } = setup();
      lifecycle.beginScanning('tdd-python');
      expect(lifecycle.isServable('tdd-python')).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes state entry', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('tdd-python', 'hash-v1');
      lifecycle.remove('tdd-python');
      expect(lifecycle.getState('tdd-python')).toBeNull();
    });
  });

  describe('listByState', () => {
    it('returns skills filtered by state', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('skill-a', 'h1');
      lifecycle.markActive('skill-b', 'h2');
      lifecycle.markQuarantined('skill-c', ['bad']);

      expect(lifecycle.listByState(SkillState.Active)).toEqual(['skill-a', 'skill-b']);
      expect(lifecycle.listByState(SkillState.Quarantined)).toEqual(['skill-c']);
    });
  });

  describe('listAll', () => {
    it('returns all tracked skills', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('skill-a', 'h1');
      lifecycle.markQuarantined('skill-b', ['bad']);

      const all = lifecycle.listAll();
      expect(all.size).toBe(2);
      expect(all.has('skill-a')).toBe(true);
      expect(all.has('skill-b')).toBe(true);
    });
  });

  describe('transition guards', () => {
    it('markQuarantined can be called on any known skill (permissive by design)', () => {
      const { lifecycle } = setup();
      lifecycle.markActive('skill-a', 'h1');
      lifecycle.markQuarantined('skill-a', ['new finding']);
      expect(lifecycle.getState('skill-a')?.state).toBe(SkillState.Quarantined);
    });

    it('markActive can overwrite any previous state', () => {
      const { lifecycle } = setup();
      lifecycle.markQuarantined('skill-a', ['finding']);
      lifecycle.markActive('skill-a', 'hash-new');
      expect(lifecycle.getState('skill-a')?.state).toBe(SkillState.Active);
    });
  });
});
