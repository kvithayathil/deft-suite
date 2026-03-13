import type { ErrorCategory, ErrorResponse, ScanFinding } from './types.js';

export enum ErrorCode {
  SkillNotFound = 'SKILL_NOT_FOUND',
  ResourceNotFound = 'RESOURCE_NOT_FOUND',
  ResourceTooLarge = 'RESOURCE_TOO_LARGE',
  ScanFailed = 'SCAN_FAILED',
  SkillQuarantined = 'SKILL_QUARANTINED',
  SkillScanning = 'SKILL_SCANNING',
  NetworkUnavailable = 'NETWORK_UNAVAILABLE',
  ValidationFailed = 'VALIDATION_FAILED',
  AccessDenied = 'ACCESS_DENIED',
  AlreadyInstalled = 'ALREADY_INSTALLED',
  SkillLocked = 'SKILL_LOCKED',
  AuthFailed = 'AUTH_FAILED',
  PermissionDenied = 'PERMISSION_DENIED',
  ConfigLocked = 'CONFIG_LOCKED',
  RateLimited = 'RATE_LIMITED',
  OperationTimeout = 'OPERATION_TIMEOUT',
  InvalidQuery = 'INVALID_QUERY',
  AlreadyExists = 'ALREADY_EXISTS',
  InternalError = 'INTERNAL_ERROR',
}

export class SkillMcpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly category: ErrorCategory,
    public readonly details: Record<string, unknown> = {},
    public readonly recoverable: boolean = false,
    public readonly retry: boolean = false,
  ) {
    super(message);
    this.name = 'SkillMcpError';
  }

  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        details: this.details,
        recoverable: this.recoverable,
        retry: this.retry,
      },
    };
  }
}

// --- Factory Functions ---

export function skillNotFound(name: string, searchedSources: string[], suggestion?: string): SkillMcpError {
  const details: Record<string, unknown> = { searched_sources: searchedSources };
  if (suggestion) {
    details.suggestion = `Did you mean '${suggestion}'? Use search_skills to find available skills.`;
  }
  return new SkillMcpError(ErrorCode.SkillNotFound, `Skill '${name}' not found in any configured source.`, 'not_found', details, true, false);
}

export function scanFailed(skillName: string, findings: ScanFinding[]): SkillMcpError {
  return new SkillMcpError(ErrorCode.ScanFailed, `Security scan failed for skill '${skillName}'. ${findings.length} finding(s).`, 'security', { findings, skillName }, false, false);
}

export function networkUnavailable(url: string, reason: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.NetworkUnavailable, `Cannot reach '${url}': ${reason}`, 'network', { url, reason, suggestion: 'Check your network connection or use local/cached sources.' }, true, true);
}

export function validationFailed(fieldErrors: Array<{ field: string; message: string }>): SkillMcpError {
  return new SkillMcpError(ErrorCode.ValidationFailed, `Validation failed: ${fieldErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`, 'validation', { fieldErrors }, true, false);
}

export function accessDenied(skillName: string, sourceUrl: string, policy: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.AccessDenied, `Skill '${skillName}' from '${sourceUrl}' is not permitted by your access control policy.`, 'security', { skillName, sourceUrl, policy, suggestion: 'Contact your admin or update security.accessControl in your config.' }, false, false);
}

export function rateLimited(toolName: string, retryAfterMs: number): SkillMcpError {
  return new SkillMcpError(ErrorCode.RateLimited, `Rate limit exceeded for '${toolName}'. Retry after ${retryAfterMs}ms.`, 'rate_limited', { toolName, retryAfterMs }, true, true);
}

export function internalError(reason: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.InternalError, 'An internal error occurred. Check logs for details.', 'internal', { reason }, false, false);
}

export function alreadyInstalled(skillName: string, currentVersion?: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.AlreadyInstalled, `Skill '${skillName}' is already installed.`, 'conflict', { skillName, currentVersion, suggestion: 'Use --update flag to update the existing installation.' }, true, false);
}

export function skillQuarantined(skillName: string, findings: ScanFinding[]): SkillMcpError {
  return new SkillMcpError(ErrorCode.SkillQuarantined, `Skill '${skillName}' is quarantined due to security scan findings.`, 'security', { skillName, findings, suggestion: 'Review findings via get_status, then fix or force-approve.' }, true, false);
}

export function operationTimeout(operation: string, timeoutMs: number): SkillMcpError {
  return new SkillMcpError(ErrorCode.OperationTimeout, `Operation '${operation}' timed out after ${timeoutMs}ms.`, 'network', { operation, timeoutMs }, true, true);
}

export function resourceNotFound(skillName: string, resourcePath: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.ResourceNotFound, `Resource '${resourcePath}' not found in skill '${skillName}'.`, 'not_found', { skillName, resourcePath }, true, false);
}

export function resourceTooLarge(skillName: string, resourcePath: string, sizeBytes: number): SkillMcpError {
  return new SkillMcpError(ErrorCode.ResourceTooLarge, `Resource '${resourcePath}' in skill '${skillName}' exceeds size limit (${sizeBytes} bytes).`, 'validation', { skillName, resourcePath, sizeBytes }, false, false);
}

export function skillScanning(skillName: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.SkillScanning, `Skill '${skillName}' is currently being scanned. Previous version served if available.`, 'conflict', { skillName }, true, true);
}

export function skillLocked(skillName: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.SkillLocked, `Skill '${skillName}' is locked and cannot be removed.`, 'conflict', { skillName }, false, false);
}

export function authFailed(url: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.AuthFailed, `Authentication failed for '${url}'.`, 'permission', { url }, true, false);
}

export function permissionDenied(operation: string, path: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.PermissionDenied, `Permission denied: cannot ${operation} '${path}'.`, 'permission', { operation, path }, false, false);
}

export function configLocked(key: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.ConfigLocked, `Config key '${key}' is locked and cannot be modified at this level.`, 'permission', { key }, false, false);
}

export function invalidQuery(query: string, reason: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.InvalidQuery, `Invalid search query '${query}': ${reason}`, 'validation', { query, reason }, true, false);
}

export function alreadyExists(skillName: string): SkillMcpError {
  return new SkillMcpError(ErrorCode.AlreadyExists, `Skill '${skillName}' already exists in the store.`, 'conflict', { skillName, suggestion: 'Use a different name or update the existing skill.' }, true, false);
}
