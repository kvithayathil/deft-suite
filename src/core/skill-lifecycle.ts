import { SkillState } from './types.js';
import type { Logger } from './ports/logger.js';

export interface SkillStateEntry {
  state: SkillState;
  currentHash: string | null;
  previousHash: string | null;
  findings: string[];
  updatedAt: string;
}

export class SkillLifecycle {
  private entries = new Map<string, SkillStateEntry>();

  constructor(private readonly logger: Logger) {}

  getState(name: string): SkillStateEntry | null {
    return this.entries.get(name) ?? null;
  }

  beginScanning(name: string): void {
    const existing = this.entries.get(name);
    this.entries.set(name, {
      state: SkillState.Scanning,
      currentHash: null,
      previousHash: existing?.currentHash ?? null,
      findings: [],
      updatedAt: new Date().toISOString(),
    });
    this.logger.debug(`Skill '${name}' entered scanning state`);
  }

  markActive(name: string, contentHash: string): void {
    this.entries.set(name, {
      state: SkillState.Active,
      currentHash: contentHash,
      previousHash: null,
      findings: [],
      updatedAt: new Date().toISOString(),
    });
    this.logger.debug(`Skill '${name}' is now active (hash: ${contentHash.slice(0, 8)})`);
  }

  markQuarantined(name: string, findings: string[]): void {
    const existing = this.entries.get(name);
    this.entries.set(name, {
      state: SkillState.Quarantined,
      currentHash: null,
      previousHash: existing?.previousHash ?? existing?.currentHash ?? null,
      findings,
      updatedAt: new Date().toISOString(),
    });
    this.logger.warn(`Skill '${name}' quarantined: ${findings.length} finding(s)`);
  }

  forceApprove(name: string): void {
    const existing = this.entries.get(name);
    if (!existing || existing.state !== SkillState.Quarantined) {
      throw new Error(`Cannot force-approve '${name}': not in quarantined state (current: ${existing?.state ?? 'none'})`);
    }
    this.entries.set(name, {
      ...existing,
      state: SkillState.ActiveForced,
      updatedAt: new Date().toISOString(),
    });
    this.logger.warn(`Skill '${name}' force-approved by user despite scan findings`);
  }

  isServable(name: string): boolean {
    const entry = this.entries.get(name);
    if (!entry) return false;

    switch (entry.state) {
      case SkillState.Active:
      case SkillState.ActiveForced:
        return true;
      case SkillState.Scanning:
        return entry.previousHash !== null;
      case SkillState.Quarantined:
        return false;
      default:
        return false;
    }
  }

  remove(name: string): void {
    this.entries.delete(name);
  }

  listByState(state: SkillState): string[] {
    return Array.from(this.entries.entries())
      .filter(([, entry]) => entry.state === state)
      .map(([name]) => name);
  }

  listAll(): Map<string, SkillStateEntry> {
    return new Map(this.entries);
  }
}
