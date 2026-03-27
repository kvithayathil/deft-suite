import {
  TrustLevel,
  meetsMinTrust,
  type SecurityConfig,
  type AccessControlEntry,
} from './types.js';

export class TrustEvaluator {
  constructor(private readonly config: SecurityConfig) {}

  /** Check if a trust level meets the configured minimum threshold. */
  meetsThreshold(level: TrustLevel): boolean {
    return meetsMinTrust(level, this.config.minTrustLevel);
  }

  /** Check if a source URL is allowed by access control policy. */
  isSourceAllowed(sourceUrl: string): boolean {
    const { mode, blocked, allowed } = this.config.accessControl;

    if (mode === 'blocklist') {
      return !this.matchesAnyEntry(
        sourceUrl,
        blocked.filter((e) => e.type === 'source'),
      );
    } else {
      return this.matchesAnyEntry(
        sourceUrl,
        allowed.filter((e) => e.type === 'source'),
      );
    }
  }

  /** Check if a skill name is allowed by access control policy. */
  isSkillAllowed(skillName: string, isBundled: boolean = false): boolean {
    // Bundled skills are always allowed
    if (isBundled) return true;

    const { mode, blocked, allowed } = this.config.accessControl;

    if (mode === 'blocklist') {
      return !blocked.some((e) => e.type === 'skill' && e.name === skillName);
    } else {
      return allowed.some((e) => e.type === 'skill' && e.name === skillName);
    }
  }

  private matchesAnyEntry(url: string, entries: AccessControlEntry[]): boolean {
    return entries.some((entry) => {
      if (!entry.url) return false;
      if (entry.url.endsWith('/*')) {
        const prefix = entry.url.slice(0, -1); // Remove trailing *
        return url.startsWith(prefix);
      }
      return url === entry.url;
    });
  }
}
