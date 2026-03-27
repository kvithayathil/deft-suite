#!/usr/bin/env tsx
/**
 * Generate auto-injected sections in docs/agents/*.md from project sources.
 *
 * Sources of truth:
 *   package.json   → commands table
 *   mise.toml      → runtime versions, mise tasks
 *   src/           → directory tree, port interfaces
 *   tests/         → test directory tree, test helpers
 *   scripts/       → scripts list
 *
 * Sections are delimited by <!-- BEGIN:key --> / <!-- END:key --> markers.
 * Hand-written content outside markers is preserved.
 *
 * Usage:
 *   tsx scripts/generate-agent-docs.ts          # regenerate
 *   tsx scripts/generate-agent-docs.ts --check  # CI verification
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const AGENTS_DIR = join(ROOT, 'docs', 'agents');
const isCheck = process.argv.includes('--check');

// ── Helpers ──────────────────────────────────────────────────────────

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

function readText(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(join(ROOT, dir))
      .filter((f) => !f.startsWith('.'))
      .sort();
  } catch {
    return [];
  }
}

function listTsFiles(dir: string): string[] {
  return listDir(dir).filter((f) => f.endsWith('.ts'));
}

function listSubdirs(dir: string): string[] {
  return listDir(dir).filter((f) => {
    try {
      return statSync(join(ROOT, dir, f)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** Count .ts files recursively in a directory */
function countTsFiles(dir: string): number {
  let count = 0;
  for (const entry of listDir(dir)) {
    const full = join(dir, entry);
    try {
      if (statSync(join(ROOT, full)).isDirectory()) {
        count += countTsFiles(full);
      } else if (entry.endsWith('.ts')) {
        count++;
      }
    } catch {
      // skip
    }
  }
  return count;
}

function inject(content: string, key: string, block: string): string {
  const beginTag = `<!-- BEGIN:${key} -->`;
  const endTag = `<!-- END:${key} -->`;
  const re = new RegExp(`${beginTag}[\\s\\S]*?${endTag}`, 'g');
  const replacement = `${beginTag}\n${block.trimEnd()}\n${endTag}`;
  return content.replace(re, replacement);
}

// ── Data extraction ──────────────────────────────────────────────────

interface PkgJson {
  scripts: Record<string, string>;
  engines?: Record<string, string>;
}

function parseMiseToml(text: string): {
  tools: Record<string, string>;
  tasks: Array<{ name: string; description: string; run: string }>;
} {
  const tools: Record<string, string> = {};
  const tasks: Array<{ name: string; description: string; run: string }> = [];

  // Parse [tools]
  const toolsMatch = text.match(/\[tools\]\n([\s\S]*?)(?=\n\[|$)/);
  if (toolsMatch) {
    for (const line of toolsMatch[1].split('\n')) {
      const m = line.match(/^(\w+)\s*=\s*"(.+)"/);
      if (m) tools[m[1]] = m[2];
    }
  }

  // Parse [tasks.*]
  const taskMatches = text.matchAll(
    /\[tasks\.(\w+)\]\ndescription\s*=\s*"(.+)"\nrun\s*=\s*(?:"(.+)"|"""([\s\S]*?)""")/g,
  );
  for (const m of taskMatches) {
    tasks.push({
      name: m[1],
      description: m[2],
      run: (m[3] ?? m[4]).trim(),
    });
  }

  return { tools, tasks };
}

// ── Block generators ─────────────────────────────────────────────────

/** Visible npm scripts (exclude lifecycle hooks) */
const LIFECYCLE_SCRIPTS = new Set([
  'prepare',
  'prepublishOnly',
  'preversion',
  'version',
  'postversion',
  'postinstall',
  'preinstall',
  'install',
  'preuninstall',
  'uninstall',
]);

function genCommandsTable(scripts: Record<string, string>): string {
  const rows: string[] = [];
  for (const [name, cmd] of Object.entries(scripts)) {
    if (LIFECYCLE_SCRIPTS.has(name)) continue;
    rows.push(`| \`bun run ${name}\` | \`${cmd}\` |`);
  }
  return `| Command | Runs |\n|---------|------|\n${rows.join('\n')}`;
}

function genMiseVersions(tools: Record<string, string>): string {
  const rows = Object.entries(tools).map(([name, ver]) => `| ${name} | ${ver} |`);
  return `| Tool | Version |\n|------|---------|\n${rows.join('\n')}`;
}

function genMiseTasks(tasks: Array<{ name: string; description: string }>): string {
  const rows = tasks.map((t) => `| \`mise run ${t.name}\` | ${t.description} |`);
  return `| Command | Description |\n|---------|-------------|\n${rows.join('\n')}`;
}

/** Script descriptions — maintained here since scripts lack consistent JSDoc */
const SCRIPT_DESCRIPTIONS: Record<string, string> = {
  'check-prerequisites.ts': 'Verify system tools (bun, deno, gitleaks, etc.)',
  'generate-agent-docs.ts': 'Inject auto-generated sections into docs/agents/',
  'generate-dev-reference.ts': 'Generate docs/dev-reference.md from config files',
  'generate-notices.ts': 'Generate THIRD-PARTY-NOTICES.md + README dep table',
  'generate-schema.ts': 'Generate config.schema.json + docs/configuration.md',
  'sync-version.ts': 'Sync version from package.json into doc references',
};

function genScriptsList(): string {
  const files = listTsFiles('scripts');
  const rows: string[] = [];
  for (const f of files) {
    const desc = SCRIPT_DESCRIPTIONS[f] ?? '';
    rows.push(`| \`${f}\` | ${desc} |`);
  }
  return `| Script | Purpose |\n|--------|---------|\n${rows.join('\n')}`;
}

function genTestTree(): string {
  const dirs = listSubdirs('tests');
  const lines = dirs.map((d) => {
    const count = countTsFiles(`tests/${d}`);
    return `| \`tests/${d}/\` | ${count} files |`;
  });
  return `| Directory | Size |\n|-----------|---------|\n${lines.join('\n')}`;
}

function genTestHelpers(): string {
  const files = listTsFiles('tests/helpers').filter((f) => !f.endsWith('.test.ts'));
  const rows: string[] = [];
  for (const f of files) {
    const content = readText(`tests/helpers/${f}`);
    // Try to extract a class/function/export name for a short description
    const exportMatch = content.match(/export (?:class|function|const) (\w+)/);
    const name = exportMatch ? exportMatch[1] : basename(f, '.ts');
    rows.push(`| \`${f}\` | \`${name}\` |`);
  }
  return `| File | Key Export |\n|------|------------|\n${rows.join('\n')}`;
}

function genSrcTree(): string {
  const lines: string[] = [];

  function walk(dir: string, prefix: string, isLast: boolean): void {
    const entries = listDir(dir);
    const dirs = entries.filter((e) => {
      try {
        return statSync(join(ROOT, dir, e)).isDirectory();
      } catch {
        return false;
      }
    });
    const files = entries.filter((e) => {
      try {
        return statSync(join(ROOT, dir, e)).isFile();
      } catch {
        return false;
      }
    });

    // Show files
    const allItems = [...dirs, ...files];
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const last = i === allItems.length - 1;
      const connector = last ? '└── ' : '├── ';
      const childPrefix = prefix + (last ? '    ' : '│   ');

      if (dirs.includes(item)) {
        const count = countTsFiles(join(dir, item));
        lines.push(`${prefix}${connector}${item}/ (${count} files)`);
      } else {
        lines.push(`${prefix}${connector}${item}`);
      }
    }
  }

  // Top-level src/ directories and files
  const topEntries = listDir('src');
  const topDirs = topEntries.filter((e) => {
    try {
      return statSync(join(ROOT, 'src', e)).isDirectory();
    } catch {
      return false;
    }
  });
  const topFiles = topEntries.filter((e) => {
    try {
      return statSync(join(ROOT, 'src', e)).isFile();
    } catch {
      return false;
    }
  });

  const all = [...topDirs, ...topFiles];
  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    const last = i === all.length - 1;
    const connector = last ? '└── ' : '├── ';

    if (topDirs.includes(item)) {
      const count = countTsFiles(`src/${item}`);
      lines.push(`${connector}${item}/ (${count} files)`);

      // Show subdirectories one level deep
      const subs = listSubdirs(`src/${item}`);
      const subPrefix = last ? '    ' : '│   ';
      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j];
        const subLast = j === subs.length - 1;
        const subConnector = subLast ? '└── ' : '├── ';
        const subCount = countTsFiles(`src/${item}/${sub}`);
        lines.push(`${subPrefix}${subConnector}${sub}/ (${subCount} files)`);
      }
    } else {
      lines.push(`${connector}${item}`);
    }
  }

  return `\`\`\`\nsrc/\n${lines.join('\n')}\n\`\`\``;
}

function genPortInterfaces(): string {
  const files = listTsFiles('src/core/ports').filter((f) => f !== 'index.ts');
  const rows: string[] = [];
  for (const f of files) {
    const content = readText(`src/core/ports/${f}`);
    const ifaceMatch = content.match(/export interface (\w+)/);
    const name = ifaceMatch ? ifaceMatch[1] : basename(f, '.ts');
    rows.push(`| \`${basename(f, '.ts')}\` | \`${name}\` |`);
  }
  return `| Port | Interface |\n|------|-----------|\n${rows.join('\n')}`;
}

/** Scan adapter files for `implements <Interface>` and build a Mermaid class diagram */
function genPortAdapterDiagram(): string {
  const adapterDirs = ['src/adapters/driven', 'src/adapters/driving'];
  const links: Array<{ adapter: string; iface: string; dir: string }> = [];

  for (const dir of adapterDirs) {
    for (const f of listTsFiles(dir)) {
      const content = readText(`${dir}/${f}`);
      const match = content.match(/export class (\w+) implements (\w+)/);
      if (match) {
        links.push({
          adapter: match[1],
          iface: match[2],
          dir: dir.includes('driven') ? 'driven' : 'driving',
        });
      }
    }
  }

  const lines: string[] = ['```mermaid', 'graph LR', '  subgraph Ports["Port Interfaces"]'];

  const ifaces = [...new Set(links.map((l) => l.iface))].sort();
  for (const iface of ifaces) {
    lines.push(`    ${iface}["${iface}"]`);
  }
  lines.push('  end');

  const driven = links.filter((l) => l.dir === 'driven');
  const driving = links.filter((l) => l.dir === 'driving');

  if (driven.length > 0) {
    lines.push('  subgraph Driven["Driven Adapters (outbound)"]');
    for (const l of driven) {
      lines.push(`    ${l.adapter}["${l.adapter}"]`);
    }
    lines.push('  end');
  }

  if (driving.length > 0) {
    lines.push('  subgraph Driving["Driving Adapters (inbound)"]');
    for (const l of driving) {
      lines.push(`    ${l.adapter}["${l.adapter}"]`);
    }
    lines.push('  end');
  }

  for (const l of links) {
    lines.push(`  ${l.adapter} -.->|implements| ${l.iface}`);
  }

  lines.push('```');
  return lines.join('\n');
}

/** Generate a Mermaid flowchart for the npm version lifecycle */
function genVersionLifecycle(scripts: Record<string, string>): string {
  const lines: string[] = ['```mermaid', 'flowchart TD', '  A["npm version"] --> B["preversion"]'];

  // Parse preversion
  const preversion = scripts.preversion;
  if (preversion) {
    const cmds = preversion.split('&&').map((s) => s.trim().replace(/^npm run /, ''));
    for (let i = 0; i < cmds.length; i++) {
      const id = `B${i}`;
      lines.push(`  B --> ${id}["${cmds[i]}"]`);
    }
  }

  lines.push('  B --> C["bump package.json"]');
  lines.push('  C --> D["version hook"]');

  // Parse version hook
  const version = scripts.version;
  if (version) {
    const parts = version.split('&&').map((s) => s.trim().replace(/^npm run /, ''));
    // Filter out git add
    const cmds = parts.filter((p) => !p.startsWith('git add'));
    for (let i = 0; i < cmds.length; i++) {
      const id = `D${i}`;
      lines.push(`  D --> ${id}["${cmds[i]}"]`);
    }
    if (parts.some((p) => p.startsWith('git add'))) {
      lines.push('  D --> E["git add changed files"]');
    }
  }

  lines.push('  E --> F["git commit + tag"]');
  lines.push('```');
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

const pkg = readJson<PkgJson>('package.json');
const mise = parseMiseToml(readText('mise.toml'));

const injections: Record<string, Record<string, string>> = {
  'project-conventions.md': {
    commands: genCommandsTable(pkg.scripts),
    'mise-versions': genMiseVersions(mise.tools),
    'mise-tasks': genMiseTasks(mise.tasks),
    'version-lifecycle': genVersionLifecycle(pkg.scripts),
  },
  'toolchain.md': {
    scripts: genScriptsList(),
    'test-tree': genTestTree(),
  },
  'code-style.md': {
    'test-helpers': genTestHelpers(),
  },
  'architecture.md': {
    'src-tree': genSrcTree(),
    ports: genPortInterfaces(),
    'port-adapter-diagram': genPortAdapterDiagram(),
  },
};

let dirty = false;

for (const [file, sections] of Object.entries(injections)) {
  const filePath = join(AGENTS_DIR, file);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`⚠ Skipping ${file} (not found)`);
    continue;
  }

  let updated = content;
  for (const [key, block] of Object.entries(sections)) {
    const before = updated;
    updated = inject(updated, key, block);
    if (before === updated && !content.includes(`<!-- BEGIN:${key} -->`)) {
      console.warn(`⚠ ${file}: missing <!-- BEGIN:${key} --> marker`);
    }
  }

  if (content !== updated) {
    if (isCheck) {
      console.error(`✗ ${file} has stale auto-generated sections`);
      dirty = true;
    } else {
      writeFileSync(filePath, updated);
      console.log(`  ✓ ${file}`);
    }
  }
}

if (isCheck && dirty) {
  console.error('\nAgent docs are out of sync with project sources.');
  console.error('Run: bun run generate:agent-docs');
  process.exit(1);
} else if (isCheck) {
  console.log('✓ All agent docs are in sync');
} else {
  console.log('\nAgent docs regenerated from project sources.');
}
