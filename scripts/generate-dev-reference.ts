#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const OUTPUT_PATH = resolve(rootDir, 'docs', 'dev-reference.md');
const isCheckMode = process.argv.includes('--check');

// ── Types ───────────────────────────────────────────────────────

interface PackageJson {
  name: string;
  version: string;
  license: string;
  type?: string;
  engines?: Record<string, string>;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DenoJson {
  tasks?: Record<string, string>;
  unstable?: string[];
}

interface TsConfig {
  compilerOptions?: {
    target?: string;
    module?: string;
    outDir?: string;
    sourceMap?: boolean;
    declaration?: boolean;
    strict?: boolean;
  };
}

interface VitestParsed {
  globals?: string;
  testPattern?: string;
  coverageProvider?: string;
  thresholds?: string;
}

interface MiseParsed {
  tools: string[][];
  tasks: string[][];
}

// ── Helpers ─────────────────────────────────────────────────────

async function readJson<T>(relative: string): Promise<T> {
  const raw = await readFile(resolve(rootDir, relative), 'utf-8');
  return JSON.parse(raw) as T;
}

async function readText(relative: string): Promise<string | null> {
  try {
    return await readFile(resolve(rootDir, relative), 'utf-8');
  } catch {
    return null;
  }
}

function table(headers: string[], rows: string[][]): string {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
  return lines.join('\n');
}

function codeBlock(lang: string, content: string): string {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

// ── Source parsers ──────────────────────────────────────────────

function parsePackageScripts(pkg: PackageJson): string[][] {
  return Object.entries(pkg.scripts ?? {}).map(([name, cmd]) => {
    const category = categorizeScript(name);
    return [`\`${name}\``, `\`${cmd}\``, category];
  });
}

function categorizeScript(name: string): string {
  if (/^build|^prepare|^dev/.test(name)) return '🔨 Build';
  if (/^test/.test(name)) return '🧪 Test';
  if (/^lint|^fmt/.test(name)) return '🧹 Quality';
  if (/^check|^generate/.test(name)) return '📋 CI/Gen';
  if (/^typecheck/.test(name)) return '🔍 Types';
  return '⚙️ Other';
}

function parseDenoTasks(deno: DenoJson): string[][] {
  return Object.entries(deno.tasks ?? {}).map(([name, cmd]) => [
    `\`deno task ${name}\``,
    `\`${cmd}\``,
  ]);
}

function parseMiseToml(text: string | null): MiseParsed {
  if (!text) return { tools: [], tasks: [] };

  const tools: string[][] = [];
  const tasks: string[][] = [];

  // Parse [tools] section
  const toolsMatch = text.match(/\[tools\]\n([\s\S]*?)(?=\n\[|$)/);
  if (toolsMatch) {
    for (const line of toolsMatch[1].split('\n')) {
      const m = line.match(/^(\w[\w-]*) *=  *"?([^"\n]+)"?/);
      if (m) tools.push([`\`${m[1]}\``, `\`${m[2].trim()}\``]);
    }
  }

  // Parse [tasks.*] sections
  const taskRegex =
    /\[tasks\.(\w+)\]\ndescription *=  *"([^"]+)"\nrun *=  *(?:"""([\s\S]*?)"""|"([^"]+)")/g;
  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(text)) !== null) {
    const name = match[1];
    const desc = match[2];
    const multiRun = match[3];
    const singleRun = match[4];
    const cmd = (singleRun ?? multiRun?.trim()) || '';
    tasks.push([`\`mise run ${name}\``, desc, `\`${cmd.replace(/\n/g, ' && ')}\``]);
  }

  return { tools, tasks };
}

function parseVitestConfig(text: string | null): VitestParsed {
  if (!text) return {};
  const config: VitestParsed = {};

  const globalsMatch = text.match(/globals:\s*(true|false)/);
  if (globalsMatch) config.globals = globalsMatch[1];

  const includeMatch = text.match(/include:\s*\[([^\]]+)\]/);
  if (includeMatch) config.testPattern = includeMatch[1].trim().replace(/'/g, '');

  const providerMatch = text.match(/provider:\s*'([^']+)'/);
  if (providerMatch) config.coverageProvider = providerMatch[1];

  const thresholdsMatch = text.match(/thresholds:\s*\{([^}]+)\}/);
  if (thresholdsMatch) {
    config.thresholds = thresholdsMatch[1]
      .trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }

  return config;
}

function parseTsconfig(tsconfig: TsConfig): string[][] {
  const co = tsconfig.compilerOptions ?? {};
  return [
    ['Target', `\`${co.target ?? 'n/a'}\``],
    ['Module', `\`${co.module ?? 'n/a'}\``],
    ['Output', `\`${co.outDir ?? 'n/a'}\``],
    ['Source Maps', co.sourceMap ? '✅' : '❌'],
    ['Declarations', co.declaration ? '✅' : '❌'],
    ['Strict', co.strict ? '✅' : '❌'],
  ];
}

// ── Generator ───────────────────────────────────────────────────

async function generate(): Promise<string> {
  const pkg = await readJson<PackageJson>('package.json');
  const deno = await readJson<DenoJson>('deno.json');
  const tsconfig = await readJson<TsConfig>('tsconfig.json');
  const vitestText = await readText('vitest.config.ts');
  const miseText = await readText('mise.toml');
  const eslintText = await readText('eslint.config.js');

  const mise = parseMiseToml(miseText);
  const vitest = parseVitestConfig(vitestText);

  // Detect linting plugins from eslint config
  const eslintPlugins: string[] = [];
  if (eslintText) {
    if (eslintText.includes('eslint-plugin-security')) eslintPlugins.push('security');
    if (eslintText.includes('eslint-plugin-sonarjs')) eslintPlugins.push('sonarjs');
    if (eslintText.includes('eslint-plugin-oxlint')) eslintPlugins.push('oxlint (dedup bridge)');
    if (eslintText.includes('@typescript-eslint')) eslintPlugins.push('@typescript-eslint');
  }

  const sections: string[] = [];

  // ── Header
  sections.push(
    '# Developer Reference',
    '',
    '> **Auto-generated** from project config files.',
    '> Do not edit manually — run `npm run generate:dev-reference` to regenerate.',
    '',
    `- **Package**: \`${pkg.name}\` v${pkg.version}`,
    `- **License**: ${pkg.license}`,
    `- **Node**: \`${pkg.engines?.node ?? 'unspecified'}\``,
    `- **Module System**: \`${pkg.type ?? 'commonjs'}\``,
    '',
  );

  // ── Runtime Toolchain
  if (mise.tools.length > 0) {
    sections.push(
      '## Runtime Toolchain (mise)',
      '',
      'Run `mise install` to set up all required runtimes.',
      '',
      table(['Tool', 'Version'], mise.tools),
      '',
    );
  }

  // ── Entry Points
  sections.push(
    '## Entry Points',
    '',
    table(
      ['Binary', 'Path'],
      Object.entries(pkg.bin ?? {}).map(([name, path]) => [`\`${name}\``, `\`${path}\``]),
    ),
    '',
  );

  // ── npm Scripts
  sections.push(
    '## npm Scripts',
    '',
    table(['Script', 'Command', 'Category'], parsePackageScripts(pkg)),
    '',
  );

  // ── Deno Tasks
  const denoTasks = parseDenoTasks(deno);
  if (denoTasks.length > 0) {
    sections.push(
      '## Deno Tasks',
      '',
      `Requires unstable flags: ${deno.unstable?.map((f) => `\`${f}\``).join(', ') ?? 'none'}`,
      '',
      table(['Task', 'Command'], denoTasks),
      '',
    );
  }

  // ── mise Tasks
  if (mise.tasks.length > 0) {
    sections.push('## mise Tasks', '', table(['Task', 'Description', 'Runs'], mise.tasks), '');
  }

  // ── TypeScript
  sections.push('## TypeScript', '', table(['Setting', 'Value'], parseTsconfig(tsconfig)), '');

  // ── Testing
  sections.push(
    '## Testing (Vitest)',
    '',
    table(
      ['Setting', 'Value'],
      [
        ['Globals', `\`${vitest.globals ?? 'n/a'}\``],
        ['Pattern', `\`${vitest.testPattern ?? 'n/a'}\``],
        ['Coverage Provider', `\`${vitest.coverageProvider ?? 'n/a'}\``],
        ['Thresholds', vitest.thresholds ?? 'none'],
      ],
    ),
    '',
  );

  // ── Quality Toolchain
  sections.push(
    '## Quality Toolchain',
    '',
    '| Tool | Role | Config |',
    '| --- | --- | --- |',
    '| **oxfmt** | Formatter | `.oxfmtrc.json` |',
    '| **oxlint** | Fast linter (TypeScript, correctness) | `.oxlintrc.json` |',
    '| **ESLint** | Specialized linter (security, sonarjs) | `eslint.config.js` |',
    `| | ESLint plugins | ${eslintPlugins.map((p) => `\`${p}\``).join(', ')} |`,
    '| **jscpd** | Duplication detection | `.jscpd.json` |',
    '| **tsc** | Type checking | `tsconfig.json` |',
    '',
  );

  // ── Quick Reference
  sections.push(
    '## Quick Reference',
    '',
    '### First-time setup',
    '',
    codeBlock(
      'bash',
      'mise install        # Install runtimes (node, bun, deno, pnpm)\nbun install         # Install dependencies',
    ),
    '',
    '### Common workflows',
    '',
    codeBlock(
      'bash',
      [
        'bun run fmt          # Format code',
        'bun run typecheck    # Type check',
        'bun run lint         # Lint (oxlint + eslint)',
        'bun run test         # Run tests',
        'bun run test:watch   # Watch mode',
        'bun run test:coverage # With coverage',
        'bun run build        # Compile to dist/',
      ].join('\n'),
    ),
    '',
    '### Shortcut tasks',
    '',
    codeBlock(
      'bash',
      'mise run check    # fmt:check + typecheck + lint\nmise run ci       # Full CI pipeline locally',
    ),
    '',
    '### Deno alternative',
    '',
    codeBlock(
      'bash',
      'deno task run     # Start MCP server\ndeno task cli     # Run CLI\ndeno task lint    # Lint',
    ),
    '',
  );

  // ── Dependencies
  sections.push(
    '## Dependencies',
    '',
    '### Runtime',
    '',
    table(
      ['Package', 'Version'],
      Object.entries(pkg.dependencies ?? {}).map(([name, ver]) => [`\`${name}\``, `\`${ver}\``]),
    ),
    '',
    '### Development',
    '',
    table(
      ['Package', 'Version'],
      Object.entries(pkg.devDependencies ?? {}).map(([name, ver]) => [`\`${name}\``, `\`${ver}\``]),
    ),
    '',
  );

  return sections.join('\n').trimEnd() + '\n';
}

// ── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const content = await generate();

  if (isCheckMode) {
    const existing = await readText('docs/dev-reference.md');
    if (existing !== content) {
      process.stderr.write(
        'docs/dev-reference.md is out of date.\nRun: npm run generate:dev-reference\n',
      );
      process.exit(1);
    }
    process.stdout.write('Dev reference is up to date.\n');
    return;
  }

  await writeFile(OUTPUT_PATH, content, 'utf-8');
  process.stdout.write(`Wrote ${OUTPUT_PATH}\n`);
}

main().catch((error: Error) => {
  process.stderr.write(`Failed to generate dev reference: ${error.message}\n`);
  process.exit(1);
});
