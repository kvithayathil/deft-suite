import { TrustLevel, SkillState, type Skill } from '../../src/core/types.js';

export function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    metadata: {
      name: 'test-skill',
      description: 'A test skill for unit testing',
      ...overrides.metadata,
    },
    content: '# Test Skill\n\nDo the thing.',
    resources: [],
    trustLevel: TrustLevel.Bundled,
    state: SkillState.Active,
    sourcePath: '.agents/skills/test-skill',
    ...overrides,
  };
}

export const FIXTURE_SKILLS = {
  tddPython: makeSkill({
    metadata: { name: 'tdd-python', description: 'Python TDD patterns and pytest workflows' },
    trustLevel: TrustLevel.Verified,
    sourcePath: '.agents/skills/tdd-python',
  }),
  securityBaseline: makeSkill({
    metadata: {
      name: 'security-baseline',
      description: 'Security-aware patterns for skill authoring',
    },
    trustLevel: TrustLevel.Bundled,
    sourcePath: '.agents/skills/security-baseline',
  }),
  communitySkill: makeSkill({
    metadata: { name: 'community-tool', description: 'A community-contributed skill' },
    trustLevel: TrustLevel.Community,
    sourcePath: '.agents/skills/community-tool',
  }),
  unknownSkill: makeSkill({
    metadata: { name: 'unknown-skill', description: 'An unverified skill' },
    trustLevel: TrustLevel.Unknown,
    state: SkillState.Quarantined,
    sourcePath: '.agents/skills/unknown-skill',
  }),
};
