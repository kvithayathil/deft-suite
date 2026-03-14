#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { CliAdapter } from './adapters/driving/cli-adapter.js';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'log-level': { type: 'string', default: 'error' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const cli = new CliAdapter();
cli.run(positionals, values).catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
