#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FileConfigStore } from './adapters/driven/file-config-store.js';
import { FsSkillStore } from './adapters/driven/fs-skill-store.js';
import { FileSkillLockStore } from './adapters/driven/file-skill-lock-store.js';
import { BuiltinScanner } from './adapters/driven/builtin-scanner.js';
import { MemorySearchIndex } from './adapters/driven/memory-search-index.js';
import { ConsoleLogger } from './adapters/driven/console-logger.js';
import { mergeConfigs } from './core/config-merger.js';
import { discoverProjectConfig } from './core/config-discovery.js';
import { SkillResolver } from './core/skill-resolver.js';
import { TrustEvaluator } from './core/trust-evaluator.js';
import { SkillLifecycle } from './core/skill-lifecycle.js';
import { SkillLockManager } from './core/skill-lock.js';
import { ManifestBuilder } from './core/manifest-builder.js';
import { TokenBucket } from './resilience/token-bucket.js';
import { CircuitBreaker } from './resilience/circuit-breaker.js';
import type { ResilienceContext } from './resilience/tool-wrapper.js';
import { WorkerManager } from './workers/worker-manager.js';
import { GitCatalogStore } from './adapters/driven/git-catalog-store.js';
import { flattenSourcesForResolver } from './core/types.js';
import type { ToolContext } from './tools/context.js';
import type { ToolHandler } from './tools/types.js';
import { wireOptionalAdapters } from './bootstrap.js';
import { handleSearchSkills } from './tools/search-skills.js';
import { handleGetSkill } from './tools/get-skill.js';
import { handleInstallSkill } from './tools/install-skill.js';
import { handleGetResource } from './tools/get-resource.js';
import { handleListCategories } from './tools/list-categories.js';
import { handleRemoveSkill } from './tools/remove-skill.js';
import { handleSaveSkill } from './tools/save-skill.js';
import { handlePushSkills } from './tools/push-skills.js';
import { handleUpdateConfig } from './tools/update-config.js';
import { handleSaveConfig } from './tools/save-config.js';
import { handleGetStatus } from './tools/get-status.js';
import { createMcpServer, startStdioServer } from './adapters/driving/mcp-server.js';

export const VERSION = '1.0.0-beta.4';

async function main(): Promise<void> {
  // Config
  const configDir = join(homedir(), '.config', 'deft');
  const configPath = join(configDir, 'config.json');
  const configStore = new FileConfigStore(configPath);
  const rawConfig = await configStore.load();
  const projectConfig = await discoverProjectConfig(
    process.cwd(),
    rawConfig?.projectConfigPaths as string[] | undefined,
  );
  const config = mergeConfigs(rawConfig, projectConfig?.config);

  // Seed config file on first run so users have a file to inspect/edit
  if (!rawConfig) {
    await configStore.save(config);
  }

  // Logger
  const logger = new ConsoleLogger(config.logging.level);
  if (projectConfig) {
    logger.info(`Loaded project config from ${projectConfig.path}`);
  }

  // Adapters
  const skillsDir = join(homedir(), '.local', 'share', 'deft', 'skills');
  const bundledDir = join(homedir(), '.local', 'share', 'deft', 'bundled');
  const skillStore = new FsSkillStore(skillsDir);
  const bundledStore = new FsSkillStore(bundledDir);
  const scanner = new BuiltinScanner();
  const searchIndex = new MemorySearchIndex();

  // Core services
  const allSources = flattenSourcesForResolver(config.sources);

  // Catalog stores — one per catalog source URL
  const catalogBaseDir = join(homedir(), '.local', 'share', 'deft', 'catalogs');
  const catalogStores = new Map<string, InstanceType<typeof GitCatalogStore>>();
  for (const catalogSource of config.sources.catalogs ?? []) {
    if (!catalogStores.has(catalogSource.url)) {
      catalogStores.set(catalogSource.url, new GitCatalogStore(catalogBaseDir));
    }
  }

  const resolver = new SkillResolver(skillStore, bundledStore, allSources, logger, {
    catalogSources: config.sources.catalogs,
    catalogStores,
  });
  const trustEvaluator = new TrustEvaluator(config.security);
  const lifecycle = new SkillLifecycle(logger);
  const lockPath = join(homedir(), '.config', 'deft', 'skill-lock.json');
  const lockStore = new FileSkillLockStore(lockPath);
  const lockManager = new SkillLockManager(lockStore, logger);
  const manifestBuilder = new ManifestBuilder(config.manifest);

  // Resilience
  const rateLimiters = new Map<string, TokenBucket>();
  for (const [tool, limits] of Object.entries(config.resilience.rateLimits)) {
    rateLimiters.set(tool, new TokenBucket(limits.bucketSize, limits.refillPerMinute));
  }
  const circuitBreakerCooldownMs = config.resilience.circuitBreakerCooldownMs;
  const cbOptions = circuitBreakerCooldownMs ? { cooldownMs: circuitBreakerCooldownMs } : undefined;
  const circuitBreakers = new Map<string, CircuitBreaker>();
  for (const source of allSources) {
    const key = source.url ?? source.path ?? 'unknown';
    circuitBreakers.set(key, new CircuitBreaker(cbOptions));
  }
  for (const catalogSource of config.sources.catalogs ?? []) {
    if (!circuitBreakers.has(catalogSource.url)) {
      circuitBreakers.set(catalogSource.url, new CircuitBreaker(cbOptions));
    }
  }
  const resilience: ResilienceContext = { rateLimiters, circuitBreakers };

  // ToolContext
  const ctx: ToolContext = {
    skillStore,
    bundledStore,
    configStore,
    scanner,
    searchIndex,
    lockManager,
    lifecycle,
    resolver,
    trustEvaluator,
    manifestBuilder,
    config,
    rawConfig: rawConfig ?? {},
    logger,
    resilience,
    catalogStores,
    isOffline: () => {
      if (resilience.circuitBreakers.size === 0) {
        return false;
      }
      for (const breaker of resilience.circuitBreakers.values()) {
        if (breaker.isAllowed()) {
          return false;
        }
      }
      return true;
    },
  };

  await wireOptionalAdapters(ctx, {
    configDir,
    logger,
    searchRateLimiter: rateLimiters.get('search_skills'),
  });

  ctx.onConfigReload = async () => {
    const newRaw = await configStore.load();
    const newProject = await discoverProjectConfig(
      process.cwd(),
      newRaw?.projectConfigPaths as string[] | undefined,
    );
    const newConfig = mergeConfigs(newRaw, newProject?.config);
    Object.assign(ctx.config, newConfig);
    await wireOptionalAdapters(ctx, {
      configDir,
      logger,
      searchRateLimiter: rateLimiters.get('search_skills'),
    });

    const allMeta = await skillStore.listMetadata();
    const bundledMeta = await bundledStore.listMetadata();
    await searchIndex.rebuild([...bundledMeta, ...allMeta]);
    logger.info('Config reloaded');
  };

  // Seed search index with installed skills
  const allMetadata = await skillStore.listMetadata();
  const bundledMetadata = await bundledStore.listMetadata();
  await searchIndex.rebuild([...bundledMetadata, ...allMetadata]);

  // Register tool handlers
  // Each handler has a narrower param type than the generic ToolHandler<Record<string, unknown>>.
  // The MCP adapter passes raw args from the wire, so we cast through unknown.
  const handlers = new Map<string, ToolHandler>([
    ['search_skills', handleSearchSkills as unknown as ToolHandler],
    ['get_skill', handleGetSkill as unknown as ToolHandler],
    ['install_skill', handleInstallSkill as unknown as ToolHandler],
    ['get_resource', handleGetResource as unknown as ToolHandler],
    ['list_categories', handleListCategories as ToolHandler],
    ['remove_skill', handleRemoveSkill as unknown as ToolHandler],
    ['save_skill', handleSaveSkill as unknown as ToolHandler],
    ['push_skills', handlePushSkills as ToolHandler],
    ['update_config', handleUpdateConfig as unknown as ToolHandler],
    ['save_config', handleSaveConfig as ToolHandler],
    ['get_status', handleGetStatus as ToolHandler],
  ]);

  // Create and start MCP server
  const server = await createMcpServer(ctx, handlers);

  // Start workers asynchronously to avoid startup blocking
  const workerManager = new WorkerManager(logger);
  setImmediate(() => {
    void workerManager.startAll(config).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to start workers: ${msg}`);
    });
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down deft-mcp server...');
    await workerManager.shutdown();

    // Prune stale catalog clones
    const pruneMaxAgeDays = Number(process.env.DEFT_CATALOG_PRUNE_MAX_AGE_DAYS) || 30;
    for (const store of catalogStores.values()) {
      try {
        const pruned = await store.prune(pruneMaxAgeDays);
        if (pruned > 0) {
          logger.info(`Pruned ${pruned} stale catalog clone(s)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to prune catalog clones: ${msg}`);
      }
    }

    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  await startStdioServer(server);
  logger.info(`deft-mcp v${VERSION} started`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ERROR] Fatal startup error: ${msg}\n`);
  process.exit(1);
});
