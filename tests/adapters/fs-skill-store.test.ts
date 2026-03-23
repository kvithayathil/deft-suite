import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FsSkillStore } from '../../src/adapters/driven/fs-skill-store.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';

describe('FsSkillStore', () => {
  let testDir: string;
  let store: FsSkillStore;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'deft-test-'));
    store = new FsSkillStore(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns null for nonexistent skill', async () => {
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('reads skill from SKILL.md with frontmatter', async () => {
    const skillDir = join(testDir, 'tdd-python');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), [
      '---', 'name: tdd-python', 'description: Python TDD patterns', 'version: 1.0.0', '---', '', '# TDD Python', '', 'Write tests first.',
    ].join('\n'));

    const skill = await store.get('tdd-python');
    expect(skill).not.toBeNull();
    expect(skill!.metadata.name).toBe('tdd-python');
    expect(skill!.metadata.description).toBe('Python TDD patterns');
    expect(skill!.content).toContain('Write tests first.');
  });

  it('lists resource files', async () => {
    const skillDir = join(testDir, 'my-skill');
    await mkdir(join(skillDir, 'scripts'), { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: test\n---\nContent');
    await writeFile(join(skillDir, 'scripts', 'setup.sh'), '#!/bin/bash');

    const skill = await store.get('my-skill');
    expect(skill!.resources).toContain('scripts/setup.sh');
  });

  it('writes a skill to disk and reads it back', async () => {
    await store.write('new-skill', {
      metadata: { name: 'new-skill', description: 'A new skill' },
      content: '# New Skill\n\nDo things.',
      resources: [], trustLevel: TrustLevel.SelfApproved, state: SkillState.Active,
      sourcePath: join(testDir, 'new-skill'),
    });
    const loaded = await store.get('new-skill');
    expect(loaded!.metadata.name).toBe('new-skill');
  });

  it('deletes a skill directory', async () => {
    await mkdir(join(testDir, 'to-delete'));
    await writeFile(join(testDir, 'to-delete', 'SKILL.md'), '---\nname: to-delete\ndescription: bye\n---\n');
    await store.delete('to-delete');
    expect(await store.exists('to-delete')).toBe(false);
  });

  it('computes content hash', async () => {
    await mkdir(join(testDir, 'hashme'));
    await writeFile(join(testDir, 'hashme', 'SKILL.md'), '---\nname: hashme\ndescription: test\n---\ncontent');
    const hash = await store.computeHash('hashme');
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('listNames returns all skill directories', async () => {
    for (const name of ['skill-a', 'skill-b']) {
      await mkdir(join(testDir, name));
      await writeFile(join(testDir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\n`);
    }
    const names = await store.listNames();
    expect(names).toContain('skill-a');
    expect(names).toContain('skill-b');
  });
});
