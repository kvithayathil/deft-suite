// --- Trust Levels (Spec Section 8, Layer 2) ---

export enum TrustLevel {
  Unknown = 'unknown',
  Community = 'community',
  SelfApproved = 'self-approved',
  Verified = 'verified',
  Bundled = 'bundled',
}

export const TRUST_ORDINALS: Record<TrustLevel, number> = {
  [TrustLevel.Unknown]: 0,
  [TrustLevel.Community]: 1,
  [TrustLevel.SelfApproved]: 2,
  [TrustLevel.Verified]: 3,
  [TrustLevel.Bundled]: 4,
};

export const TRUST_INDICATORS: Record<TrustLevel, string> = {
  [TrustLevel.Unknown]: '✖',
  [TrustLevel.Community]: '◇',
  [TrustLevel.SelfApproved]: '▲',
  [TrustLevel.Verified]: '●',
  [TrustLevel.Bundled]: '◆',
};

export function compareTrust(a: TrustLevel, b: TrustLevel): number {
  return TRUST_ORDINALS[a] - TRUST_ORDINALS[b];
}

export function meetsMinTrust(level: TrustLevel, minimum: TrustLevel): boolean {
  return TRUST_ORDINALS[level] >= TRUST_ORDINALS[minimum];
}

// --- Skill Lifecycle States (Spec Section 6a) ---

export enum SkillState {
  Scanning = 'scanning',
  Active = 'active',
  Quarantined = 'quarantined',
  ActiveForced = 'active_forced',
}

// --- Skill Types (Spec Section 3) ---

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string[];
  version?: string;
  dependencies?: string[];
  minMcpVersion?: string;
}

export interface Skill {
  metadata: SkillMetadata;
  content: string;
  resources: string[];
  trustLevel: TrustLevel;
  state: SkillState;
  sourcePath: string;
}

// --- Source Types ---

export type SourceType = 'local' | 'git' | 'registry' | 'bundled';

export interface Source {
  type: SourceType;
  path?: string;
  url?: string;
  branch?: string;
  ref?: string;
  trust?: TrustLevel;
}

// --- Skill Lock (Spec Section 6a) ---

export interface SkillLockEntry {
  contentHash: string;
  scanHash: string;
  scanResult: 'clean' | 'findings' | 'overridden';
  scanTimestamp: string;
  trustLevel: TrustLevel;
  source: Source;
}

export interface SkillLock {
  lockVersion: number;
  generatedAt: string;
  generatedBy: string;
  skills: Record<string, SkillLockEntry>;
}

// --- Config ---

export interface ManifestConfig {
  skills: string[];
  maxManifestSize: number;
  warnThreshold: number;
}

export interface SyncConfig {
  intervalMinutes: number;
  autoUpdate: boolean;
}

export interface SecurityConfig {
  minTrustLevel: TrustLevel;
  scanOnInstall: boolean;
  periodicScanIntervalHours: number;
  accessControl: AccessControlConfig;
}

export interface AccessControlConfig {
  mode: 'blocklist' | 'allowlist';
  blocked: AccessControlEntry[];
  allowed: AccessControlEntry[];
}

export interface AccessControlEntry {
  type: 'source' | 'skill';
  url?: string;
  name?: string;
}

export interface PushConfig {
  remote: string;
  branch: string;
  autoCommit: boolean;
}

export interface LoggingConfig {
  level: 'error' | 'info' | 'debug';
  file: string;
  maxFileSize: string;
  maxFiles: number;
  structured: boolean;
}

export interface TelemetryConfig {
  enabled: boolean;
  exporterEndpoint: string | null;
  exporterProtocol: 'grpc' | 'http';
  serviceName: string;
  sampleRate: number;
}

export interface ResilienceConfig {
  rateLimits: Record<string, { bucketSize: number; refillPerMinute: number }>;
}

export interface BackupConfig {
  enabled: boolean;
  target: 'git' | string;
  interval: 'daily' | 'weekly' | 'manual';
  onConfigChange: boolean;
}

export interface ConfigMetadata {
  createdOn: string;
  createdBy: string;
  platforms: string[];
  arch: string;
}

export interface Config {
  schemaVersion: number;
  manifest: ManifestConfig;
  sources: Source[];
  sync: SyncConfig;
  security: SecurityConfig;
  platformDirectories: Record<string, string>;
  projectConfigPaths: string[];
  push: PushConfig;
  logging: LoggingConfig;
  telemetry: TelemetryConfig;
  resilience: ResilienceConfig;
  backup: BackupConfig;
  metadata: ConfigMetadata;
}

// --- Error Types ---

export type ErrorCategory =
  | 'not_found'
  | 'validation'
  | 'security'
  | 'network'
  | 'conflict'
  | 'permission'
  | 'internal'
  | 'rate_limited';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    details: Record<string, unknown>;
    recoverable: boolean;
    retry: boolean;
  };
}

// --- Search Result ---

export interface SearchResult {
  name: string;
  description: string;
  trustLevel: TrustLevel;
  score: number;
}

// --- Scan Types ---

export type ScanSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ScanFinding {
  rule: string;
  severity: ScanSeverity;
  message: string;
  file: string;
  line?: number;
}

export interface ScanResult {
  skillName: string;
  findings: ScanFinding[];
  passed: boolean;
  hash: string;
  timestamp: string;
}
