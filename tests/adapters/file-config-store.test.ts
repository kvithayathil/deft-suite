import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileConfigStore } from '../../src/adapters/driven/file-config-store.js';

describe('FileConfigStore', () => {
  let testDir: string;
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'deft-config-'));
  });
  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns null when file does not exist', async () => {
    const store = new FileConfigStore(join(testDir, 'none.json'));
    expect(await store.load()).toBeNull();
  });

  it('loads valid JSON config', async () => {
    const p = join(testDir, 'config.json');
    await writeFile(p, JSON.stringify({ schemaVersion: 1, manifest: { skills: ['a'] } }));
    const config = await new FileConfigStore(p).load();
    expect(config?.schemaVersion).toBe(1);
  });

  it('expands $ENV_VAR references', async () => {
    vi.stubEnv('TEST_URL', 'https://example.com');
    const p = join(testDir, 'config.json');
    await writeFile(p, JSON.stringify({ sources: [{ url: '$TEST_URL' }] }));
    const config = await new FileConfigStore(p).load();
    expect(config?.sources?.[0]?.url).toBe('https://example.com');
    vi.unstubAllEnvs();
  });

  it('saves formatted JSON', async () => {
    const p = join(testDir, 'config.json');
    await new FileConfigStore(p).save({ schemaVersion: 1 } as any);
    const raw = await readFile(p, 'utf-8');
    expect(raw).toContain('\n');
    expect(JSON.parse(raw).schemaVersion).toBe(1);
  });
});
