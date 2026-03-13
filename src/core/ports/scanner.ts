import type { ScanResult, ScanFinding } from '../types.js';

export interface Scanner {
  scanSkill(skillPath: string, skillName: string): Promise<ScanResult>;
  scanDiff(skillPath: string, skillName: string, changedFiles: string[]): Promise<ScanResult>;
  readonly name: string;
}
