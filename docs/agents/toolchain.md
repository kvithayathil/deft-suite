# Toolchain

## Formatter

**oxfmt** — config: `.oxfmtrc.json`. Single quotes. Run `bun run fmt` or `bun run fmt:check`.

## Linter

Runs `oxlint && eslint` in sequence.

| Linter | Config | Role |
|--------|--------|------|
| **oxlint** | `.oxlintrc.json` | Primary. `typescript` plugin, `correctness` + `suspicious` categories. |
| **ESLint** | `eslint.config.js` | Secondary. `security` + `sonarjs` plugins only. `eslint-plugin-oxlint` deduplicates. |

## Test Runner

**vitest** — config: `vitest.config.ts`. Globals enabled. Coverage: v8, thresholds enforced. Pattern: `tests/**/*.test.ts`.

### Test directories

<!-- BEGIN:test-tree -->
| Directory | Size |
|-----------|---------|
| `tests/adapters/` | 12 files |
| `tests/core/` | 16 files |
| `tests/helpers/` | 15 files |
| `tests/integration/` | 4 files |
| `tests/resilience/` | 5 files |
| `tests/telemetry/` | 1 files |
| `tests/tools/` | 8 files |
| `tests/workers/` | 2 files |
<!-- END:test-tree -->

## Scripts

All in `scripts/*.ts`, run via `tsx`. Each supports `--check` for CI.

<!-- BEGIN:scripts -->
| Script | Purpose |
|--------|---------|
| `check-prerequisites.ts` | Verify system tools (bun, deno, gitleaks, etc.) |
| `generate-agent-docs.ts` | Inject auto-generated sections into docs/agents/ |
| `generate-dev-reference.ts` | Generate docs/dev-reference.md from config files |
| `generate-notices.ts` | Generate THIRD-PARTY-NOTICES.md + README dep table |
| `generate-schema.ts` | Generate config.schema.json + docs/configuration.md |
| `sync-version.ts` | Sync version from package.json into doc references |
<!-- END:scripts -->

## Quality Gates

| Tool | Config | Threshold |
|------|--------|-----------|
| jscpd | `.jscpd.json` | < 6% duplication |
| gitleaks | `.gitleaks.toml` | 0 leaks (pre-commit + CI) |
