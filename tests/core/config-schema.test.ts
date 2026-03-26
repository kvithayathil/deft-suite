import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { DEFAULT_CONFIG } from '../../src/core/config-merger.js';

describe('config.schema.json', () => {
  it('DEFAULT_CONFIG validates against the generated JSON Schema', async () => {
    const schemaPath = resolve(import.meta.dirname, '..', '..', 'config.schema.json');
    const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(DEFAULT_CONFIG);

    if (!valid) {
      const errors = validate.errors?.map(
        (e) => `${e.instancePath || '/'}: ${e.message}`,
      );
      expect.fail(`DEFAULT_CONFIG does not match schema:\n${errors?.join('\n')}`);
    }

    expect(valid).toBe(true);
  });

  it('schema includes SourcesConfig definition with local/remote/catalogs', async () => {
    const schemaPath = resolve(import.meta.dirname, '..', '..', 'config.schema.json');
    const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

    expect(schema.definitions?.SourcesConfig).toBeDefined();
    const props = schema.definitions.SourcesConfig.properties;
    expect(props.local).toBeDefined();
    expect(props.remote).toBeDefined();
    expect(props.catalogs).toBeDefined();
  });
});
