#!/usr/bin/env tsx

/**
 * Checks for recommended system-level tools after npm install.
 * Non-blocking — prints warnings but never fails.
 */

import { execSync } from 'node:child_process';

const yellow = '\x1b[33m';
const reset = '\x1b[0m';

interface MissingTool {
  name: string;
  purpose: string;
  install: string;
}

function isInstalled(cmd: string): boolean {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

const missing: MissingTool[] = [];

if (!isInstalled('gitleaks')) {
  missing.push({
    name: 'gitleaks',
    purpose: 'pre-commit secret scanning',
    install: 'brew install gitleaks  (macOS)\n    https://github.com/gitleaks/gitleaks#installing',
  });
}

if (missing.length > 0) {
  console.log(`\n${yellow}⚠ Recommended tools not found:${reset}\n`);
  for (const tool of missing) {
    console.log(`${yellow}  • ${tool.name}${reset} — ${tool.purpose}`);
    console.log(`    Install: ${tool.install}\n`);
  }
}
