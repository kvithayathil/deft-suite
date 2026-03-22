import { describe, expect, it, vi } from 'vitest';
import { CliAdapter } from '../../src/adapters/driving/cli-adapter.js';
import { InMemoryUsageStore } from '../helpers/in-memory-usage-store.js';
import { mergeConfigs } from '../../src/core/config-merger.js';
import type { ToolContext } from '../../src/tools/context.js';
import { InMemorySkillStore } from '../helpers/in-memory-skill-store.js';
import { InMemoryConfigStore } from '../helpers/in-memory-config-store.js';
import { StubScanner } from '../helpers/stub-scanner.js';
import { InMemorySearchIndex } from '../helpers/in-memory-search-index.js';
import { InMemorySkillLockStore } from '../helpers/in-memory-skill-lock-store.js';
import { SkillResolver } from '../../src/core/skill-resolver.js';
import { TrustEvaluator } from '../../src/core/trust-evaluator.js';
import { SkillLifecycle } from '../../src/core/skill-lifecycle.js';
import { SkillLockManager } from '../../src/core/skill-lock.js';
import { ManifestBuilder } from '../../src/core/manifest-builder.js';
import { NoopLogger } from '../helpers/noop-logger.js';

class CaptureStream {
  text = '';

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    return true;
  }
}

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const logger = new NoopLogger();
  const config = mergeConfigs();
  const skillStore = new InMemorySkillStore();
  const bundledStore = new InMemorySkillStore();

  return {
    skillStore,
    bundledStore,
    configStore: new InMemoryConfigStore(),
    scanner: new StubScanner(),
    searchIndex: new InMemorySearchIndex(),
    lockManager: new SkillLockManager(new InMemorySkillLockStore(), logger),
    lifecycle: new SkillLifecycle(logger),
    resolver: new SkillResolver(skillStore, bundledStore, config.sources, logger),
    trustEvaluator: new TrustEvaluator(config.security),
    manifestBuilder: new ManifestBuilder(config.manifest),
    config,
    logger,
    ...overrides,
  };
}

describe('CliAdapter', () => {
  it('renders grouped search output and installs selected remote result', async () => {
    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const ctx = makeContext();

    const searchHandler = vi.fn(async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          local: [{
            name: 'database-local',
            description: 'Installed database helper',
            trustLevel: 'bundled',
            score: 10,
            frecency: 1,
            installed: true,
          }],
          catalogs: {
            'team-catalog': [{
              name: 'database-migrations',
              description: 'Safe migration patterns',
              source: { type: 'github', repo: 'acme/db-migrations' },
              catalogName: 'team-catalog',
              score: 8,
            }],
          },
          github: [{
            name: 'oss/db-patterns',
            description: 'Open source db patterns',
            source: { type: 'github', repo: 'oss/db-patterns' },
            tags: ['database'],
            score: 7,
            installable: true,
          }],
          offline: false,
        }),
      }],
    }));

    const installHandler = vi.fn(async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ registration: 'Installed successfully.' }),
      }],
    }));

    const adapter = new CliAdapter({
      createContext: async () => ctx,
      searchHandler,
      installHandler,
      promptSelection: async () => '1',
      stdout: stdout as never,
      stderr: stderr as never,
    });

    await adapter.run(['search', 'database'], { refresh: true });

    expect(searchHandler).toHaveBeenCalledWith({ query: 'database', refresh: true }, ctx);
    expect(installHandler).toHaveBeenCalledWith({ skill: 'database-migrations' }, ctx);
    expect(stdout.text).toContain('-- Local (1 results) --');
    expect(stdout.text).toContain('-- team-catalog (1 results) --');
    expect(stdout.text).toContain('-- GitHub (1 results) --');
    expect(stdout.text).toContain('1. database-migrations');
    expect(stdout.text).toContain('Installing database-migrations...');
    expect(stderr.text).toBe('');
  });

  it('exports usage in csv format', async () => {
    const usageStore = new InMemoryUsageStore();
    usageStore.recordAccess('database-migrations');

    const stdout = new CaptureStream();
    const adapter = new CliAdapter({
      createContext: async () => makeContext({ usageStore }),
      stdout: stdout as never,
      stderr: new CaptureStream() as never,
    });

    await adapter.run(['usage', 'export'], { format: 'csv' });

    expect(stdout.text).toContain('name,score,lastAccessed,firstAccessed,accessCount');
    expect(stdout.text).toContain('database-migrations');
  });

  it('resets all usage entries with usage reset --all', async () => {
    const usageStore = new InMemoryUsageStore();
    usageStore.recordAccess('database-migrations');
    usageStore.recordAccess('db-query-helper');

    const stdout = new CaptureStream();
    const adapter = new CliAdapter({
      createContext: async () => makeContext({ usageStore }),
      stdout: stdout as never,
      stderr: new CaptureStream() as never,
    });

    await adapter.run(['usage', 'reset'], { all: true });

    expect(usageStore.getRawData()).toHaveLength(0);
    expect(stdout.text).toContain('Usage data reset for all skills.');
  });

  it('prints stats output with top skills and search activity', async () => {
    const usageStore = new InMemoryUsageStore();
    usageStore.recordAccess('database-migrations');
    usageStore.recordAccess('database-migrations');
    usageStore.recordSearch('database', 3, 'local');

    const stdout = new CaptureStream();
    const adapter = new CliAdapter({
      createContext: async () => makeContext({ usageStore }),
      stdout: stdout as never,
      stderr: new CaptureStream() as never,
    });

    await adapter.run(['stats'], {});

    expect(stdout.text).toContain('-- Top Skills by Frecency --');
    expect(stdout.text).toContain('-- Search Activity --');
    expect(stdout.text).toContain('Total searches: 1');
    expect(stdout.text).toContain('database-migrations');
  });

  it('shows help text with usage, stats, and --refresh', async () => {
    const stdout = new CaptureStream();
    const adapter = new CliAdapter({
      createContext: async () => makeContext(),
      stdout: stdout as never,
      stderr: new CaptureStream() as never,
    });

    await adapter.run(['help'], {});

    expect(stdout.text).toContain('usage export --format json|csv');
    expect(stdout.text).toContain('stats');
    expect(stdout.text).toContain('--refresh');
  });
});
