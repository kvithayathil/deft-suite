import { readdir, open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import type { Scanner } from '../../core/ports/scanner.js';
import type { ScanResult, ScanFinding } from '../../core/types.js';

interface ScanRule {
  rule: string;
  severity: 'critical' | 'warning' | 'info';
  pattern: RegExp;
  fileExtensions?: string[]; // undefined = all files
  message: string;
}

const PROMPT_INJECTION_RULES: ScanRule[] = [
  {
    rule: 'prompt-injection',
    severity: 'critical',
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    message: 'Potential prompt injection: attempts to override prior instructions',
  },
  {
    rule: 'prompt-injection',
    severity: 'critical',
    pattern: /your\s+system\s+prompt\s+is/i,
    message: 'Potential prompt injection: attempts to redefine system prompt',
  },
  {
    rule: 'prompt-injection',
    severity: 'warning',
    pattern: /you\s+are\s+now\s+(?:a|an)\s+/i,
    message: 'Potential prompt injection: attempts to reassign identity',
  },
  {
    rule: 'template-injection',
    severity: 'warning',
    pattern: /\{\{[^}]*\}\}/,
    fileExtensions: ['.md'],
    message: 'Template syntax in markdown — potential injection vector for dynamic content',
  },
];

const CODE_RULES: ScanRule[] = [
  {
    rule: 'dangerous-eval',
    severity: 'critical',
    // Pattern matches eval( and new Function( — dynamic code execution
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    fileExtensions: ['.js', '.ts', '.mjs', '.cjs'],
    message: 'Dangerous dynamic code execution: eval() or new Function() usage',
  },
  {
    rule: 'base64-shell',
    severity: 'critical',
    pattern: /base64\s+(-d|--decode).*\|\s*(bash|sh|zsh)/,
    fileExtensions: ['.sh', '.bash', '.zsh'],
    message: 'Base64-decoded content piped to shell',
  },
  {
    rule: 'hex-encoded-cmd',
    severity: 'critical',
    pattern: /xxd\s+-r\s+-p|printf\s+'\\x/,
    fileExtensions: ['.sh', '.bash', '.zsh'],
    message: 'Hex-encoded content decoded at runtime — potential obfuscated command',
  },
  {
    rule: 'obfuscation',
    severity: 'warning',
    pattern: /tr\s+["']a-zA-Z["']\s+["']n-za-mN-ZA-M["']|rot13/i,
    fileExtensions: ['.sh', '.bash', '.zsh', '.js', '.ts'],
    message: 'ROT13 or character rotation detected — potential obfuscation',
  },
];

const ALL_RULES = [...PROMPT_INJECTION_RULES, ...CODE_RULES];

export class BuiltinScanner implements Scanner {
  readonly name = 'builtin';

  async scanSkill(skillPath: string, skillName: string): Promise<ScanResult> {
    const findings: ScanFinding[] = [];
    const allContent: string[] = [];

    await this.walkFiles(skillPath, skillPath, async (filePath, relativePath) => {
      // Open with O_NOFOLLOW so symlinks fail with ELOOP — avoids TOCTOU
      // between a separate lstat() check and readFile().
      let fh;
      try {
        fh = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ELOOP') {
          findings.push({
            rule: 'symlink-escape',
            severity: 'critical',
            file: relativePath,
            line: 0,
            message: 'Symbolic link detected — potential directory escape',
          });
          return;
        }
        throw err;
      }

      let contentBuffer: Buffer;
      try {
        contentBuffer = await fh.readFile();
      } finally {
        await fh.close();
      }

      if (contentBuffer.includes(0x00)) {
        findings.push({
          rule: 'unexpected-binary',
          severity: 'warning',
          file: relativePath,
          line: 0,
          message:
            'Binary file detected in skill directory — skills should contain only text files',
        });
        return;
      }

      const content = contentBuffer.toString('utf-8');
      allContent.push(content);
      const ext = extname(filePath);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        for (const rule of ALL_RULES) {
          if (rule.fileExtensions && !rule.fileExtensions.includes(ext)) continue;
          if (rule.pattern.test(lines[i])) {
            findings.push({
              rule: rule.rule,
              severity: rule.severity,
              file: relativePath,
              line: i + 1,
              message: rule.message,
            });
          }
        }
      }
    });

    const hash = `sha256:${createHash('sha256').update(allContent.join('')).digest('hex')}`;
    const passed =
      findings.filter((f) => f.severity === 'critical' || f.severity === 'error').length === 0;

    return {
      skillName,
      findings,
      passed,
      hash,
      timestamp: new Date().toISOString(),
    };
  }

  async scanDiff(
    skillPath: string,
    skillName: string,
    changedFiles: string[],
  ): Promise<ScanResult> {
    // v1: full re-scan on diff
    void changedFiles;
    return this.scanSkill(skillPath, skillName);
  }

  private async walkFiles(
    dir: string,
    rootDir: string,
    callback: (filePath: string, relativePath: string) => Promise<void>,
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Re-check with lstat to guard against a directory being swapped
        // for a symlink between the readdir() and this point.
        const stat = await lstat(fullPath);
        if (stat.isSymbolicLink()) continue;
        await this.walkFiles(fullPath, rootDir, callback);
      } else {
        await callback(fullPath, relative(rootDir, fullPath));
      }
    }
  }
}
