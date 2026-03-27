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
  tags?: string[];
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

export type SourceType = 'local' | 'git' | 'hosted' | 'bundled';

export interface Source {
  type: SourceType;
  path?: string;
  url?: string;
  branch?: string;
  ref?: string;
  trust?: TrustLevel;
}

export type CatalogSkillSource =
  | { type: 'github'; repo: string; ref?: string }
  | { type: 'path'; path: string }
  | { type: 'url'; url: string };

export interface CatalogSkill {
  name: string;
  description: string;
  source: CatalogSkillSource;
  tags?: string[];
  version?: string;
}

export interface CatalogEntry {
  name: string;
  description?: string;
  skills: CatalogSkill[];
}

// --- Structured Sources Config ---

export interface LocalSourceConfig {
  path: string;
  trust?: TrustLevel;
  sync?: 'git';
}

export type RemoteSourceType = 'git' | 'hosted';

export interface RemoteSourceConfig {
  url: string;
  type: RemoteSourceType;
  branch?: string;
  ref?: string;
  trust?: TrustLevel;
}

export type CatalogSourceType = 'git' | 'static';

export interface CatalogSourceConfig {
  url: string;
  type: CatalogSourceType;
  cacheMinutes?: number;
}

export interface SourcesConfig {
  local: LocalSourceConfig[];
  remote: RemoteSourceConfig[];
  catalogs: CatalogSourceConfig[];
}

export function flattenSourcesForResolver(sources: SourcesConfig): Source[] {
  const result: Source[] = [];
  for (const local of sources.local) {
    result.push({ type: 'local', path: local.path, trust: local.trust });
  }
  for (const remote of sources.remote) {
    result.push({
      type: remote.type === 'git' ? 'git' : 'hosted',
      url: remote.url,
      branch: remote.branch,
      ref: remote.ref,
      trust: remote.trust,
    });
  }
  return result;
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
  circuitBreakerCooldownMs?: number;
}

export interface BackupConfig {
  enabled: boolean;
  target: 'git' | string;
  interval: 'daily' | 'weekly' | 'manual';
  onConfigChange: boolean;
}

export interface GitHubConfig {
  search: boolean;
  topics: string[];
}

export interface UsageEntry {
  name: string;
  score: number;
  lastAccessed: string;
  firstAccessed: string;
  accessCount: number;
}

export interface UsageStats {
  totalSkills: number;
  totalScore: number;
  topSkills: UsageEntry[];
  dbSizeBytes?: number;
}

export interface UsageConfig {
  pruneThreshold: number;
  sessionCap: number;
  ceilingPercent: number;
  dbPath: string;
}

export interface SearchStats {
  totalSearches: number;
  avgResultCount: number;
  sourceBreakdown: Record<string, number>;
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
  sources: SourcesConfig;
  github?: GitHubConfig;
  usage?: UsageConfig;
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

export interface LocalSearchResult extends SearchResult {
  frecency?: number;
  installed: true;
}

export interface CatalogSearchResult {
  name: string;
  description: string;
  source: CatalogSkillSource;
  catalogName: string;
  score: number;
}

export interface GitHubSearchResult {
  name: string;
  description: string;
  source: CatalogSkillSource;
  tags: string[];
  score: number;
  installable: true;
}

export interface UnifiedSearchResult {
  local: LocalSearchResult[];
  catalogs: Record<string, CatalogSearchResult[]>;
  github: GitHubSearchResult[];
  offline: boolean;
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
