# Developer Reference

> **Auto-generated** from project config files.
> Do not edit manually — run `npm run generate:dev-reference` to regenerate.

- **Package**: `deft-mcp` v1.0.0-beta.4
- **License**: GPL-3.0-only
- **Node**: `>=22.0.0`
- **Module System**: `module`

## Runtime Toolchain (mise)

Run `mise install` to set up all required runtimes.

| Tool | Version |
| --- | --- |
| `node` | `lts` |
| `bun` | `latest` |
| `deno` | `latest` |
| `pnpm` | `latest` |

## Entry Points

| Binary | Path |
| --- | --- |
| `deft` | `dist/cli.js` |
| `deft-mcp` | `dist/index.js` |

## npm Scripts

| Script | Command | Category |
| --- | --- | --- |
| `build` | `tsc` | 🔨 Build |
| `prepare` | `tsc && npm run generate:notices` | 🔨 Build |
| `postinstall` | `git config core.hooksPath .githooks || true && tsx scripts/check-prerequisites.ts || true` | ⚙️ Other |
| `generate:notices` | `tsx scripts/generate-notices.ts` | 📋 CI/Gen |
| `check:notices` | `tsx scripts/generate-notices.ts --check` | 📋 CI/Gen |
| `generate:schema` | `tsx scripts/generate-schema.ts` | 📋 CI/Gen |
| `check:schema` | `tsx scripts/generate-schema.ts --check` | 📋 CI/Gen |
| `generate:dev-reference` | `tsx scripts/generate-dev-reference.ts` | 📋 CI/Gen |
| `check:dev-reference` | `tsx scripts/generate-dev-reference.ts --check` | 📋 CI/Gen |
| `dev` | `tsc --watch` | 🔨 Build |
| `test` | `vitest run` | 🧪 Test |
| `test:watch` | `vitest` | 🧪 Test |
| `test:coverage` | `vitest run --coverage` | 🧪 Test |
| `lint` | `oxlint && eslint src/ tests/` | 🧹 Quality |
| `lint:oxlint` | `oxlint` | 🧹 Quality |
| `lint:eslint` | `eslint src/ tests/` | 🧹 Quality |
| `fmt` | `oxfmt` | 🧹 Quality |
| `fmt:check` | `oxfmt --check` | 🧹 Quality |
| `check:duplication` | `jscpd src/ tests/` | 📋 CI/Gen |
| `typecheck` | `tsc --noEmit` | 🔍 Types |

## Deno Tasks

Requires unstable flags: `sloppy-imports`, `node-globals`

| Task | Command |
| --- | --- |
| `deno task run` | `deno run -A src/index.ts` |
| `deno task cli` | `deno run -A src/cli.ts` |
| `deno task test` | `deno test -A tests/` |
| `deno task fmt` | `deno run -A npm:oxfmt` |
| `deno task fmt:check` | `deno run -A npm:oxfmt --check` |
| `deno task lint` | `deno run -A npm:oxlint && deno run -A npm:eslint src/ tests/` |

## mise Tasks

| Task | Description | Runs |
| --- | --- | --- |
| `mise run dev` | Install deps and start dev mode | `bun install && bun run dev` |
| `mise run check` | Run all checks (fmt, typecheck, lint) | `bun run fmt:check && bun run typecheck && bun run lint` |
| `mise run ci` | Full CI pipeline locally | `bun run fmt:check && bun run typecheck && bun run lint && bun run check:duplication && bun run test:coverage` |

## TypeScript

| Setting | Value |
| --- | --- |
| Target | `ES2022` |
| Module | `Node16` |
| Output | `dist` |
| Source Maps | ✅ |
| Declarations | ✅ |
| Strict | ✅ |

## Testing (Vitest)

| Setting | Value |
| --- | --- |
| Globals | `true` |
| Pattern | `tests/**/*.test.ts` |
| Coverage Provider | `v8` |
| Thresholds | lines: 80, functions: 80, branches: 75 |

## Quality Toolchain

| Tool | Role | Config |
| --- | --- | --- |
| **oxfmt** | Formatter | `.oxfmtrc.json` |
| **oxlint** | Fast linter (TypeScript, correctness) | `.oxlintrc.json` |
| **ESLint** | Specialized linter (security, sonarjs) | `eslint.config.js` |
| | ESLint plugins | `security`, `sonarjs`, `oxlint (dedup bridge)`, `@typescript-eslint` |
| **jscpd** | Duplication detection | `.jscpd.json` |
| **tsc** | Type checking | `tsconfig.json` |

## Quick Reference

### First-time setup

```bash
mise install        # Install runtimes (node, bun, deno, pnpm)
bun install         # Install dependencies
```

### Common workflows

```bash
bun run fmt          # Format code
bun run typecheck    # Type check
bun run lint         # Lint (oxlint + eslint)
bun run test         # Run tests
bun run test:watch   # Watch mode
bun run test:coverage # With coverage
bun run build        # Compile to dist/
```

### Shortcut tasks

```bash
mise run check    # fmt:check + typecheck + lint
mise run ci       # Full CI pipeline locally
```

### Deno alternative

```bash
deno task run     # Start MCP server
deno task cli     # Run CLI
deno task lint    # Lint
```

## Dependencies

### Runtime

| Package | Version |
| --- | --- |
| `@modelcontextprotocol/sdk` | `^1.27.1` |
| `ajv` | `^8.18.0` |
| `better-sqlite3` | `^12.8.0` |
| `yaml` | `^2.8.2` |

### Development

| Package | Version |
| --- | --- |
| `@types/better-sqlite3` | `^7.6.13` |
| `@types/node` | `^25.5.0` |
| `@typescript-eslint/eslint-plugin` | `^8.57.0` |
| `@typescript-eslint/parser` | `^8.57.0` |
| `@vitest/coverage-v8` | `^4.1.0` |
| `eslint` | `^10.0.3` |
| `eslint-plugin-oxlint` | `^1.57.0` |
| `eslint-plugin-security` | `^4.0.0` |
| `eslint-plugin-sonarjs` | `^4.0.2` |
| `jscpd` | `^4.0.8` |
| `license-checker` | `^25.0.1` |
| `oxfmt` | `^0.42.0` |
| `oxlint` | `^1.57.0` |
| `ts-json-schema-generator` | `^2.4.0` |
| `tsx` | `^4.21.0` |
| `typescript` | `^5.9.3` |
| `vitest` | `^4.1.0` |
