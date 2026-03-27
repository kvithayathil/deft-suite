#!/usr/bin/env node
import { CliAdapter } from './adapters/driving/cli-adapter.js';
import { parseCliArgs } from './cli-args.js';

const { positionals, values } = parseCliArgs();

const cli = new CliAdapter();
cli.run(positionals, values).catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
