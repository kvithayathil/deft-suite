import type { Scanner } from '../../src/core/ports/scanner.js';
import type { ScanResult, ScanFinding } from '../../src/core/types.js';

export class StubScanner implements Scanner {
  readonly name = 'stub-scanner';
  private results = new Map<string, ScanResult>();

  async scanSkill(_skillPath: string, skillName: string): Promise<ScanResult> {
    return this.results.get(skillName) ?? {
      skillName,
      findings: [],
      passed: true,
      hash: 'stub-hash',
      timestamp: new Date().toISOString(),
    };
  }

  async scanDiff(_skillPath: string, skillName: string, _changedFiles: string[]): Promise<ScanResult> {
    return this.scanSkill('', skillName);
  }

  setScanResult(skillName: string, result: ScanResult): void {
    this.results.set(skillName, result);
  }

  failSkill(skillName: string, findings: ScanFinding[]): void {
    this.results.set(skillName, {
      skillName,
      findings,
      passed: false,
      hash: 'fail-hash',
      timestamp: new Date().toISOString(),
    });
  }
}
