import { createInterface } from 'node:readline/promises';
import type { Writable } from 'node:stream';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FileConfigStore } from '../driven/file-config-store.js';
import { FsSkillStore } from '../driven/fs-skill-store.js';
import { FileSkillLockStore } from '../driven/file-skill-lock-store.js';
import { BuiltinScanner } from '../driven/builtin-scanner.js';
import { MemorySearchIndex } from '../driven/memory-search-index.js';
import { ConsoleLogger } from '../driven/console-logger.js';
import { mergeConfigs } from '../../core/config-merger.js';
import { discoverProjectConfig } from '../../core/config-discovery.js';
import { SkillResolver } from '../../core/skill-resolver.js';
import { TrustEvaluator } from '../../core/trust-evaluator.js';
import { SkillLifecycle } from '../../core/skill-lifecycle.js';
import { SkillLockManager } from '../../core/skill-lock.js';
import { ManifestBuilder } from '../../core/manifest-builder.js';
import { handleSearchSkills } from '../../tools/search-skills.js';
import { handleInstallSkill } from '../../tools/install-skill.js';
import type { ToolContext } from '../../tools/context.js';
import type { SearchStats, UnifiedSearchResult, UsageEntry, UsageStats } from '../../core/types.js';
import { wireOptionalAdapters } from '../../bootstrap.js';

interface CliAdapterOptions {
  createContext?: () => Promise<ToolContext>;
  searchHandler?: typeof handleSearchSkills;
  installHandler?: typeof handleInstallSkill;
  promptSelection?: (question: string) => Promise<string>;
  stdout?: Writable;
  stderr?: Writable;
  version?: string;
}

export class CliAdapter {
  private readonly createContext: () => Promise<ToolContext>;
  private readonly searchHandler: typeof handleSearchSkills;
  private readonly installHandler: typeof handleInstallSkill;
  private readonly promptSelection?: (question: string) => Promise<string>;
  private readonly stdout: Writable;
  private readonly stderr: Writable;
  private readonly versionText: string;

  constructor(options: CliAdapterOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateCliContext;
    this.searchHandler = options.searchHandler ?? handleSearchSkills;
    this.installHandler = options.installHandler ?? handleInstallSkill;
    this.promptSelection = options.promptSelection;
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.versionText = options.version ?? '1.0.0-beta.4';
  }

  async run(args: string[], flags: Record<string, unknown>): Promise<void> {
    const [command, ...rest] = args;
    if (flags.help === true) {
      await this.help(command);
      return;
    }

    switch (command) {
      case 'search':
        await this.search(rest[0], flags);
        return;
      case 'usage':
        await this.usage(rest, flags);
        return;
      case 'stats':
        await this.stats();
        return;
      case 'status':
        await this.status();
        return;
      case 'version':
        await this.version();
        return;
      case 'help':
        await this.help(rest[0]);
        return;
      default:
        if (!command) {
          await this.help();
          return;
        }

        this.stderr.write(`Unknown command: ${command}\nRun 'deft help' for usage.\n`);
        process.exit(1);
    }
  }

  private async search(query?: string, flags: Record<string, unknown> = {}): Promise<void> {
    const trimmedQuery = query?.trim() ?? '';
    if (trimmedQuery.length === 0) {
      throw new Error('Usage: deft search <query> [--refresh]');
    }

    const ctx = await this.createContext();
    const result = await this.searchHandler(
      { query: trimmedQuery, refresh: asBoolean(flags.refresh) },
      ctx,
    );
    const parsed = JSON.parse(result.content[0].text) as UnifiedSearchResult;

    const installCandidates = this.renderSearchResults(parsed);
    if (installCandidates.length === 0) {
      return;
    }

    const choice = (await this.prompt(`Install a skill? [number or 'q' to quit]: `)).trim().toLowerCase();
    if (choice === 'q' || choice.length === 0) {
      return;
    }

    const selected = Number.parseInt(choice, 10);
    if (Number.isNaN(selected) || selected < 1 || selected > installCandidates.length) {
      this.stderr.write(`Invalid selection: ${choice}\n`);
      return;
    }

    const candidate = installCandidates[selected - 1];
    this.stdout.write(`Installing ${candidate.name}...\n`);
    const installResult = await this.installHandler({ skill: candidate.name }, ctx);
    const installPayload = JSON.parse(installResult.content[0].text) as { registration?: string };
    this.stdout.write(`${installPayload.registration ?? 'Installed successfully.'}\n`);
  }

  private async usage(args: string[], flags: Record<string, unknown>): Promise<void> {
    const ctx = await this.createContext();
    const usageStore = ctx.usageStore;
    if (!usageStore) {
      this.stdout.write('Usage tracking is unavailable (sqlite adapter not loaded).\n');
      return;
    }

    const [subcommand, ...rest] = args;
    if (subcommand === 'export') {
      const format = String(flags.format ?? 'json').toLowerCase();
      const rows = usageStore.getRawData();
      if (format === 'csv') {
        this.stdout.write(toCsv(rows));
        return;
      }

      this.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
      return;
    }

    if (subcommand === 'reset') {
      if (asBoolean(flags.all)) {
        usageStore.resetAll();
        this.stdout.write('Usage data reset for all skills.\n');
        return;
      }

      const name = rest[0]?.trim();
      if (!name) {
        throw new Error('Usage: deft usage reset <name> | --all');
      }

      usageStore.reset(name);
      this.stdout.write(`Usage data reset for ${name}.\n`);
      return;
    }

    throw new Error('Usage: deft usage export --format json|csv | deft usage reset <name> [--all]');
  }

  private async stats(): Promise<void> {
    const ctx = await this.createContext();
    const usageStore = ctx.usageStore;
    if (!usageStore) {
      this.stdout.write('Usage tracking is unavailable (sqlite adapter not loaded).\n');
      return;
    }

    const usage = usageStore.getStats();
    const searches = usageStore.getSearchStats();
    this.stdout.write(renderStats(usage, searches, ctx.config.usage?.pruneThreshold ?? 0));
  }

  private async status(): Promise<void> {
    this.stdout.write('Status: OK\n');
  }

  private async version(): Promise<void> {
    this.stdout.write(`deft-mcp ${this.versionText}\n`);
  }

  private async help(command?: string): Promise<void> {
    const detail = command ? `\nHelp for command: ${command}` : '';
    this.stdout.write([
      'Usage: deft <command> [options]', '',
      'Commands:',
      '  search <query> [--refresh]           Search local/catalog/github skills',
      '  usage export --format json|csv       Export usage/frecency data',
      '  usage reset <name> [--all]           Reset usage for one skill or all',
      '  stats                                Show usage and search statistics',
      '  status                               Health check',
      '  version                              Show version',
      '  help [command]                       Show help', '',
      'Options:',
      '  --refresh                            Force catalog refresh during search',
      '  --format <json|csv>                  Output format for usage export',
      '  --all                                Reset all usage entries',
    ].join('\n') + detail + '\n');
  }

  private renderSearchResults(result: UnifiedSearchResult): Array<{ name: string }> {
    const installCandidates: Array<{ name: string }> = [];

    this.stdout.write(`\n-- Local (${result.local.length} results) --\n`);
    for (const entry of result.local) {
      this.stdout.write(`  ${entry.name}  ${entry.description}\n`);
    }

    const catalogEntries = Object.entries(result.catalogs);
    for (const [catalogName, entries] of catalogEntries) {
      this.stdout.write(`\n-- ${catalogName} (${entries.length} results) --\n`);
      for (const entry of entries) {
        installCandidates.push({ name: entry.name });
        this.stdout.write(`  ${installCandidates.length}. ${entry.name}  ${entry.description}\n`);
      }
    }

    this.stdout.write(`\n-- GitHub (${result.github.length} results) --\n`);
    for (const entry of result.github) {
      installCandidates.push({ name: entry.name });
      this.stdout.write(`  ${installCandidates.length}. ${entry.name}  ${entry.description}\n`);
    }

    if (result.offline) {
      this.stdout.write('\nNote: remote sources were unavailable; showing local/cached data.\n');
    }

    return installCandidates;
  }

  private async prompt(question: string): Promise<string> {
    if (this.promptSelection) {
      return this.promptSelection(question);
    }

    const rl = createInterface({ input: process.stdin, output: this.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  }
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function toCsv(entries: UsageEntry[]): string {
  const header = 'name,score,lastAccessed,firstAccessed,accessCount';
  const rows = entries.map((entry) => [
    csvField(entry.name),
    csvField(entry.score),
    csvField(entry.lastAccessed),
    csvField(entry.firstAccessed),
    csvField(entry.accessCount),
  ].join(','));

  return `${[header, ...rows].join('\n')}\n`;
}

function csvField(value: string | number): string {
  const asText = String(value);
  if (!/[",\n]/.test(asText)) {
    return asText;
  }

  return `"${asText.replaceAll('"', '""')}"`;
}

function renderStats(usage: UsageStats, search: SearchStats, pruneThreshold: number): string {
  const topSkills = [...usage.topSkills]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry, index) => {
      const age = relativeAge(entry.lastAccessed);
      return `  ${index + 1}. ${entry.name}  score: ${entry.score.toFixed(1)} (used ${entry.accessCount} times, last: ${age})`;
    });

  const sourceSummary = Object.entries(search.sourceBreakdown)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, count]) => `${source} ${count}`)
    .join(', ');

  const dbSize = usage.dbSizeBytes == null ? 'n/a' : formatBytes(usage.dbSizeBytes);

  return [
    '\n-- Top Skills by Frecency --',
    ...(topSkills.length === 0 ? ['  (no usage data)'] : topSkills),
    '',
    '-- Search Activity --',
    `  Total searches: ${search.totalSearches}`,
    `  Avg results/search: ${search.avgResultCount.toFixed(1)}`,
    `  Sources: ${sourceSummary || 'none'}`,
    '',
    '-- Database --',
    `  Skills tracked: ${usage.totalSkills}`,
    `  Total score: ${usage.totalScore.toFixed(1)} / ${pruneThreshold}`,
    `  DB size: ${dbSize}`,
    '',
  ].join('\n');
}

function relativeAge(isoTimestamp: string): string {
  const millis = Date.now() - new Date(isoTimestamp).getTime();
  if (millis < 60_000) {
    return 'just now';
  }
  if (millis < 3_600_000) {
    return `${Math.floor(millis / 60_000)}m ago`;
  }
  if (millis < 86_400_000) {
    return `${Math.floor(millis / 3_600_000)}h ago`;
  }

  return `${Math.floor(millis / 86_400_000)}d ago`;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function defaultCreateCliContext(): Promise<ToolContext> {
  const configDir = join(homedir(), '.config', 'deft');
  const configPath = join(configDir, 'config.json');
  const configStore = new FileConfigStore(configPath);
  const rawConfig = await configStore.load();
  const projectConfig = await discoverProjectConfig(
    process.cwd(),
    rawConfig?.projectConfigPaths as string[] | undefined,
  );
  const config = mergeConfigs(rawConfig, projectConfig?.config);

  const logger = new ConsoleLogger(config.logging.level);
  const skillsDir = join(homedir(), '.local', 'share', 'deft', 'skills');
  const bundledDir = join(homedir(), '.local', 'share', 'deft', 'bundled');
  const skillStore = new FsSkillStore(skillsDir);
  const bundledStore = new FsSkillStore(bundledDir);
  const searchIndex = new MemorySearchIndex();
  const scanner = new BuiltinScanner();
  const { flattenSourcesForResolver } = await import('../../core/types.js');
  const allSources = flattenSourcesForResolver(config.sources);
  const resolver = new SkillResolver(skillStore, bundledStore, allSources, logger);
  const trustEvaluator = new TrustEvaluator(config.security);
  const lifecycle = new SkillLifecycle(logger);
  const lockStore = new FileSkillLockStore(join(configDir, 'skill-lock.json'));
  const lockManager = new SkillLockManager(lockStore, logger);
  const manifestBuilder = new ManifestBuilder(config.manifest);

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
  };

  await wireOptionalAdapters(ctx, {
    configDir,
    logger,
  });

  const allMetadata = await skillStore.listMetadata();
  const bundledMetadata = await bundledStore.listMetadata();
  await searchIndex.rebuild([...bundledMetadata, ...allMetadata]);

  return ctx;
}
