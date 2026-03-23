import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectConfig } from '../../src/core/config-discovery.js';

describe('discoverProjectConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'deft-disc-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('finds config in .deft/', async () => {
    const configDir = join(tempDir, '.deft');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(join(configDir, 'config.json'));
  });

  it('finds config in .claude/deft/ when .deft/ missing', async () => {
    const configDir = join(tempDir, '.claude', 'deft');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.claude/deft/config.json');
  });

  it('finds config in .agents/deft/ as last resort', async () => {
    const configDir = join(tempDir, '.agents', 'deft');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.agents/deft/config.json');
  });

  it('returns null when no project config exists', async () => {
    const result = await discoverProjectConfig(tempDir);
    expect(result).toBeNull();
  });

  it('uses first match — does not continue checking', async () => {
    const dir1 = join(tempDir, '.deft');
    const dir2 = join(tempDir, '.claude', 'deft');
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir1, 'config.json'), JSON.stringify({ schemaVersion: 1, manifest: { maxManifestSize: 5 } }));
    await writeFile(join(dir2, 'config.json'), JSON.stringify({ schemaVersion: 1, manifest: { maxManifestSize: 99 } }));

    const result = await discoverProjectConfig(tempDir);
    expect(result!.path).toBe(join(dir1, 'config.json'));
  });

  it('supports custom discovery paths from config', async () => {
    const custom = join(tempDir, '.custom-dir');
    await mkdir(custom, { recursive: true });
    await writeFile(join(custom, 'config.json'), JSON.stringify({ schemaVersion: 1 }));

    const result = await discoverProjectConfig(tempDir, ['.custom-dir']);
    expect(result).not.toBeNull();
    expect(result!.path).toContain('.custom-dir/config.json');
  });
});
