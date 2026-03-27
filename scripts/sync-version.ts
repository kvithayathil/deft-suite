#!/usr/bin/env tsx
/**
 * Sync version from package.json into documentation files.
 *
 * Usage:
 *   tsx scripts/sync-version.ts          # update all version references
 *   tsx scripts/sync-version.ts --check  # verify references are in sync (CI mode)
 *
 * Wired into the npm `version` lifecycle via package.json scripts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const VERSION = pkg.version;
const TAG = `v${VERSION}`;

const isCheck = process.argv.includes('--check');

// Semver pattern for deft-suite version references (beta or stable)
// Matches: 1.0.0-beta.4, v1.0.0-beta.4, 1.0.0, v1.0.0, etc.
const SEMVER = String.raw`v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?`;

interface Replacement {
  file: string;
  patterns: Array<{
    search: RegExp;
    replace: string;
    description: string;
  }>;
}

const replacements: Replacement[] = [
  {
    file: 'README.md',
    patterns: [
      {
        search: new RegExp(String.raw`(\*\*)(${SEMVER})(\*\* — \[Changelog\])`),
        replace: `$1${TAG}$3`,
        description: 'version banner',
      },
      {
        search: new RegExp(String.raw`(deft-suite#)(${SEMVER})`, 'g'),
        replace: `$1${TAG}`,
        description: 'GitHub install pins',
      },
    ],
  },
  {
    file: 'docs/getting-started.md',
    patterns: [
      {
        search: new RegExp(String.raw`(deft-suite#)(${SEMVER})`, 'g'),
        replace: `$1${TAG}`,
        description: 'GitHub install pins',
      },
    ],
  },
  {
    file: 'docs/client-setup.md',
    patterns: [
      {
        search: new RegExp(String.raw`(deft-suite#)(${SEMVER})`, 'g'),
        replace: `$1${TAG}`,
        description: 'GitHub install pins',
      },
    ],
  },
];

let dirty = false;

for (const { file, patterns } of replacements) {
  const filePath = join(ROOT, file);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`⚠ Skipping ${file} (not found)`);
    continue;
  }

  let updated = content;
  for (const { search, replace, description } of patterns) {
    const before = updated;
    updated = updated.replace(search, replace);
    if (before !== updated) {
      console.log(`  ✓ ${file}: updated ${description}`);
    }
  }

  if (content !== updated) {
    if (isCheck) {
      console.error(`✗ ${file} has stale version references (expected ${TAG})`);
      dirty = true;
    } else {
      writeFileSync(filePath, updated);
    }
  }
}

if (isCheck && dirty) {
  console.error(`\nVersion references are out of sync with package.json (${VERSION}).`);
  console.error('Run: npm run sync:version');
  process.exit(1);
} else if (isCheck) {
  console.log(`✓ All version references match ${TAG}`);
} else {
  console.log(`\nSynced version ${TAG} across documentation.`);
}
