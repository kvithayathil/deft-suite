import { describe, it, expect } from 'vitest';
import { createTelemetry, type Telemetry } from '../../src/telemetry/otel.js';

describe('Telemetry', () => {
  it('creates noop telemetry when disabled', () => {
    const tel = createTelemetry({ enabled: false } as any);
    expect(typeof tel.startSpan).toBe('function');
    const span = tel.startSpan('test');
    expect(typeof span.end).toBe('function');
    span.end();
  });

  it('records tool call metric without error', () => {
    const tel = createTelemetry({ enabled: false } as any);
    expect(() => tel.recordToolCall('search_skills', 100, false)).not.toThrow();
  });
});
