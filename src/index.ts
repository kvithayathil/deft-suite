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
import type { ToolContext } from './tools/context.js';
import type { ToolHandler } from './tools/types.js';
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

export const VERSION = '0.1.0';

async function main(): Promise<void> {
  // Config
  const configPath = join(homedir(), '.config', 'skill-mcp', 'config.json');
  const configStore = new FileConfigStore(configPath);
  const rawConfig = await configStore.load();
  const projectConfig = await discoverProjectConfig(
    process.cwd(),
    rawConfig?.projectConfigPaths as string[] | undefined,
  );
  const config = mergeConfigs(rawConfig, projectConfig?.config);

  // Logger
  const logger = new ConsoleLogger(config.logging.level);
  if (projectConfig) {
    logger.info(`Loaded project config from ${projectConfig.path}`);
  }

  // Adapters
  const skillsDir = join(homedir(), '.local', 'share', 'skill-mcp', 'skills');
  const bundledDir = join(homedir(), '.local', 'share', 'skill-mcp', 'bundled');
  const skillStore = new FsSkillStore(skillsDir);
  const bundledStore = new FsSkillStore(bundledDir);
  const scanner = new BuiltinScanner();
  const searchIndex = new MemorySearchIndex();

  // Core services
  const resolver = new SkillResolver(skillStore, bundledStore, config.sources, logger);
  const trustEvaluator = new TrustEvaluator(config.security);
  const lifecycle = new SkillLifecycle(logger);
  const lockPath = join(homedir(), '.config', 'skill-mcp', 'skill-lock.json');
  const lockStore = new FileSkillLockStore(lockPath);
  const lockManager = new SkillLockManager(lockStore, logger);
  const manifestBuilder = new ManifestBuilder(config.manifest);

  // Resilience
  const rateLimiters = new Map<string, TokenBucket>();
  for (const [tool, limits] of Object.entries(config.resilience.rateLimits)) {
    rateLimiters.set(tool, new TokenBucket(limits.bucketSize, limits.refillPerMinute));
  }
  const circuitBreakers = new Map<string, CircuitBreaker>();
  for (const source of config.sources) {
    const key = source.url ?? source.path ?? 'unknown';
    circuitBreakers.set(key, new CircuitBreaker());
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
    logger,
    resilience,
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

  ctx.onConfigReload = async () => {
    const newRaw = await configStore.load();
    const newProject = await discoverProjectConfig(
      process.cwd(),
      newRaw?.projectConfigPaths as string[] | undefined,
    );
    const newConfig = mergeConfigs(newRaw, newProject?.config);
    Object.assign(ctx.config, newConfig);

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
    logger.info('Shutting down skill-mcp server...');
    await workerManager.shutdown();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  await startStdioServer(server);
  logger.info(`skill-mcp v${VERSION} started`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ERROR] Fatal startup error: ${msg}\n`);
  process.exit(1);
});
