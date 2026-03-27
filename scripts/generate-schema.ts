#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const SCHEMA_PATH = resolve(rootDir, 'config.schema.json');
const DOCS_PATH = resolve(rootDir, 'docs', 'configuration.md');
const TSCONFIG_PATH = resolve(rootDir, 'tsconfig.json');
const TYPES_PATH = resolve(rootDir, 'src', 'core', 'types.ts');

const CONFIG_SHAPE_START = '<!-- CONFIG_SHAPE_START -->';
const CONFIG_SHAPE_END = '<!-- CONFIG_SHAPE_END -->';

const isCheckMode = process.argv.includes('--check');

interface SchemaOutput {
  $id?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

function generateJsonSchema(): SchemaOutput {
  const generator = createGenerator({
    path: TYPES_PATH,
    tsconfig: TSCONFIG_PATH,
    type: 'Config',
    topRef: false,
    skipTypeCheck: true,
    additionalProperties: true,
  });

  return generator.createSchema('Config') as SchemaOutput;
}

async function getDefaultConfigJson(): Promise<string> {
  const { DEFAULT_CONFIG } = await import(resolve(rootDir, 'dist', 'core', 'config-merger.js'));

  // Sanitize platform-specific values for docs
  const sanitized = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  if (sanitized.metadata) {
    sanitized.metadata.createdOn = '<platform>';
    sanitized.metadata.platforms = ['<platform>'];
    sanitized.metadata.arch = '<arch>';
  }

  return JSON.stringify(sanitized, null, 2);
}

function injectConfigShape(doc: string, configJson: string): string {
  const start = doc.indexOf(CONFIG_SHAPE_START);
  const end = doc.indexOf(CONFIG_SHAPE_END);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `Could not find ${CONFIG_SHAPE_START} / ${CONFIG_SHAPE_END} markers in docs/configuration.md`,
    );
  }

  const before = doc.slice(0, start + CONFIG_SHAPE_START.length);
  const after = doc.slice(end);
  return `${before}\n\n\`\`\`json\n${configJson}\n\`\`\`\n\n${after}`;
}

async function main(): Promise<void> {
  // 1. Generate JSON Schema from TypeScript types
  process.stdout.write('Generating JSON Schema from Config type...\n');
  const schema = generateJsonSchema();
  schema.$id = 'https://deft.dev/config.schema.json';
  schema.title = 'deft configuration';
  schema.description = 'Configuration schema for deft-mcp. Auto-generated from src/core/types.ts.';
  const schemaJson = JSON.stringify(schema, null, 2) + '\n';

  // 2. Get DEFAULT_CONFIG as formatted JSON
  process.stdout.write('Extracting DEFAULT_CONFIG from dist/...\n');
  const defaultConfigJson = await getDefaultConfigJson();

  // 3. Read docs and inject
  const doc = await readFile(DOCS_PATH, 'utf-8');
  const nextDoc = injectConfigShape(doc, defaultConfigJson);

  if (isCheckMode) {
    const existingSchema = await readFile(SCHEMA_PATH, 'utf-8').catch(() => '');
    const schemaStale = existingSchema !== schemaJson;
    const docStale = doc !== nextDoc;

    if (schemaStale || docStale) {
      const staleFiles = [
        ...(schemaStale ? ['config.schema.json'] : []),
        ...(docStale ? ['docs/configuration.md'] : []),
      ];
      process.stderr.write(
        `Schema/docs are out of date: ${staleFiles.join(', ')}\nRun: npm run generate:schema\n`,
      );
      process.exit(1);
    }

    process.stdout.write('Schema and docs are up to date.\n');
    return;
  }

  // 4. Write outputs
  await writeFile(SCHEMA_PATH, schemaJson, 'utf-8');
  process.stdout.write(`Wrote ${SCHEMA_PATH}\n`);

  await writeFile(DOCS_PATH, nextDoc, 'utf-8');
  process.stdout.write(`Updated docs/configuration.md Full Config Shape block.\n`);
}

main().catch((error: Error) => {
  process.stderr.write(`Failed to generate schema: ${error.message}\n`);
  process.exit(1);
});
