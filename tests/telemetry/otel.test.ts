import { describe, it, expect } from 'vitest';
import { createTelemetry, type Telemetry } from '../../src/telemetry/otel.js';

describe('Telemetry', () => {
  it('creates noop telemetry when disabled', () => {
    const tel = createTelemetry({ enabled: false } as any);
    const span = tel.startSpan('test');
    span.end();
  });

  it('records tool call metric without error', () => {
    const tel = createTelemetry({ enabled: false } as any);
    tel.recordToolCall('search_skills', 100, false);
  });
});
