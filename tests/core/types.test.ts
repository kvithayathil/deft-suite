// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('skill-mcp', () => {
  it('exports version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
