import { parseArgs } from 'node:util';

export interface ParsedCliArgs {
  positionals: string[];
  values: Record<string, string | boolean | undefined>;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedCliArgs {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'log-level': { type: 'string', default: 'error' },
      'dry-run': { type: 'boolean', default: false },
      refresh: { type: 'boolean', default: false },
      format: { type: 'string', default: 'json' },
      all: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  return {
    positionals,
    values,
  };
}
