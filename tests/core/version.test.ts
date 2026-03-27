import { VERSION } from '../../src/version.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

describe('VERSION', () => {
  it('exports a non-empty semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('matches package.json version', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
