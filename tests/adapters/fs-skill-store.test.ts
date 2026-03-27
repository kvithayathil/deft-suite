import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FsSkillStore } from '../../src/adapters/driven/fs-skill-store.js';
import { TrustLevel, SkillState } from '../../src/core/types.js';
import type { Source } from '../../src/core/types.js';

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

  it('fetch returns skill from local source path', async () => {
    const localDir = await mkdtemp(join(tmpdir(), 'deft-local-'));
    const skillDir = join(localDir, 'my-local-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), '---\nname: my-local-skill\ndescription: local\n---\nLocal content');

    const source: Source = { type: 'local', path: localDir };
    const skill = await store.fetch('my-local-skill', source);
    expect(skill).not.toBeNull();
    expect(skill!.metadata.name).toBe('my-local-skill');
    expect(skill!.content).toContain('Local content');

    await rm(localDir, { recursive: true, force: true });
  });

  it('fetch returns null for non-local source type', async () => {
    const source: Source = { type: 'git', url: 'https://example.com/repo.git' };
    const skill = await store.fetch('anything', source);
    expect(skill).toBeNull();
  });

  it('fetch returns null when skill does not exist in local path', async () => {
    const localDir = await mkdtemp(join(tmpdir(), 'deft-empty-'));
    const source: Source = { type: 'local', path: localDir };
    const skill = await store.fetch('nonexistent', source);
    expect(skill).toBeNull();
    await rm(localDir, { recursive: true, force: true });
  });

  it('rejects path traversal with ../ in skill name', async () => {
    const result = await store.get('../etc');
    expect(result).toBeNull();
  });

  it('rejects absolute path injection in skill name', async () => {
    const result = await store.get('/etc/passwd');
    expect(result).toBeNull();
  });

  it('rejects path traversal in fetch source path', async () => {
    const localDir = await mkdtemp(join(tmpdir(), 'deft-trav-'));
    const source: Source = { type: 'local', path: localDir };
    const result = await store.fetch('../../etc/passwd', source);
    expect(result).toBeNull();
    await rm(localDir, { recursive: true, force: true });
  });

  it('writes resources alongside SKILL.md', async () => {
    await store.write('res-skill', {
      metadata: { name: 'res-skill', description: 'with resources' },
      content: '# Skill',
      resources: [],
      trustLevel: TrustLevel.SelfApproved,
      state: SkillState.Active,
      sourcePath: join(testDir, 'res-skill'),
    }, {
      'scripts/setup.sh': '#!/bin/bash\necho hello',
      'README.md': '# README',
    });

    const setupContent = await readFile(join(testDir, 'res-skill', 'scripts', 'setup.sh'), 'utf-8');
    expect(setupContent).toContain('echo hello');

    const readmeContent = await readFile(join(testDir, 'res-skill', 'README.md'), 'utf-8');
    expect(readmeContent).toBe('# README');
  });

  it('rejects path traversal in resource paths during write', async () => {
    await expect(
      store.write('safe-skill', {
        metadata: { name: 'safe-skill', description: 'test' },
        content: '# Skill',
        resources: [],
        trustLevel: TrustLevel.SelfApproved,
        state: SkillState.Active,
        sourcePath: join(testDir, 'safe-skill'),
      }, {
        '../../../etc/evil': 'pwned',
      }),
    ).rejects.toThrow(/path traversal/i);
  });
});
