import { describe, it, expect } from 'vitest';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import type { ManifestConfig, SkillMetadata } from '../../src/core/types.js';

describe('ManifestBuilder', () => {
  const defaultConfig: ManifestConfig = {
    skills: ['skill-a', 'skill-b', 'skill-c'],
    maxManifestSize: 10,
    warnThreshold: 8,
  };

  const allSkills: SkillMetadata[] = [
    { name: 'skill-a', description: 'Does A things' },
    { name: 'skill-b', description: 'Does B things' },
    { name: 'skill-c', description: 'Does C things' },
    { name: 'skill-d', description: 'Not in manifest config' },
  ];

  it('builds manifest with configured skills only', () => {
    const builder = new ManifestBuilder(defaultConfig);
    const manifest = builder.build(allSkills);
    expect(manifest.skills).toHaveLength(3);
    expect(manifest.skills.map(s => s.name)).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  it('includes description in manifest entries', () => {
    const builder = new ManifestBuilder(defaultConfig);
    const manifest = builder.build(allSkills);
    expect(manifest.skills[0].description).toBe('Does A things');
  });

  it('skips skills not found in available list', () => {
    const config: ManifestConfig = {
      skills: ['skill-a', 'missing-skill'],
      maxManifestSize: 10,
      warnThreshold: 8,
    };
    const builder = new ManifestBuilder(config);
    const manifest = builder.build(allSkills);
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.missing).toEqual(['missing-skill']);
  });

  it('warns when manifest exceeds warnThreshold', () => {
    const config: ManifestConfig = {
      skills: ['s1', 's2', 's3'],
      maxManifestSize: 5,
      warnThreshold: 2,
    };
    const skills: SkillMetadata[] = [
      { name: 's1', description: 'd' },
      { name: 's2', description: 'd' },
      { name: 's3', description: 'd' },
    ];
    const builder = new ManifestBuilder(config);
    const manifest = builder.build(skills);
    expect(manifest.warning).toContain('exceeds recommended');
  });

  it('truncates at maxManifestSize', () => {
    const config: ManifestConfig = {
      skills: ['s1', 's2', 's3', 's4'],
      maxManifestSize: 2,
      warnThreshold: 1,
    };
    const skills: SkillMetadata[] = [
      { name: 's1', description: 'd' },
      { name: 's2', description: 'd' },
      { name: 's3', description: 'd' },
      { name: 's4', description: 'd' },
    ];
    const builder = new ManifestBuilder(config);
    const manifest = builder.build(skills);
    expect(manifest.skills).toHaveLength(2);
    expect(manifest.truncated).toBe(true);
  });

  it('renders compact text representation', () => {
    const builder = new ManifestBuilder(defaultConfig);
    const manifest = builder.build(allSkills);
    const text = builder.toText(manifest);
    expect(text).toContain('skill-a');
    expect(text).toContain('search_skills');
    expect(text).toContain('get_skill');
  });
});
