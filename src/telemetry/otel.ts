import type { TelemetryConfig } from '../core/types.js';

export interface Span {
  end(): void;
  setError(err: Error): void;
}

export interface Telemetry {
  startSpan(name: string, attributes?: Record<string, string>): Span;
  recordToolCall(toolName: string, durationMs: number, errorCategory?: string | boolean): void;
  recordScanFinding(severity: string): void;
  setActiveSkillCount(count: number): void;
}

class NoopSpan implements Span {
  end(): void {}
  setError(): void {}
}

class NoopTelemetry implements Telemetry {
  startSpan(): Span {
    return new NoopSpan();
  }

  recordToolCall(): void {}

  recordScanFinding(): void {}

  setActiveSkillCount(): void {}
}

export function createTelemetry(config: TelemetryConfig): Telemetry {
  if (!config.enabled) {
    return new NoopTelemetry();
  }
  // Full OTel implementation deferred — return noop
  return new NoopTelemetry();
}
