import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli-args.js';

describe('parseCliArgs', () => {
  it('parses refresh/all flags and format option', () => {
    const parsed = parseCliArgs([
      'search',
      'database',
      '--refresh',
      'usage',
      'export',
      '--format',
      'csv',
      '--all',
    ]);

    expect(parsed.values.refresh).toBe(true);
    expect(parsed.values.all).toBe(true);
    expect(parsed.values.format).toBe('csv');
    expect(parsed.positionals).toContain('search');
  });

  it('uses CP7 defaults for new options', () => {
    const parsed = parseCliArgs(['search', 'database']);

    expect(parsed.values.refresh).toBe(false);
    expect(parsed.values.format).toBe('json');
    expect(parsed.values.all).toBe(false);
  });
});
