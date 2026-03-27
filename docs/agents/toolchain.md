# Toolchain

## Formatter: oxfmt

- Config: `.oxfmtrc.json`
- Style: single quotes, auto semicolons
- Ignore patterns cover non-source files (docs, configs, lockfiles)
- Run: `bun run fmt` (format) or `bun run fmt:check` (verify)

## Linter: oxlint + ESLint

Two linters run in sequence: `oxlint && eslint`.

### oxlint (primary)

- Config: `.oxlintrc.json`
- Plugins: `typescript`
- Categories: `correctness` (error), `suspicious` (warn)
- Handles: type safety, unused vars, no-useless-escape, etc.

### ESLint (secondary)

- Config: `eslint.config.js`
- Plugins: `eslint-plugin-security`, `eslint-plugin-sonarjs`
- Bridge: `eslint-plugin-oxlint` disables rules already covered by oxlint
- Handles: security patterns, cognitive complexity

### Why two linters?

oxlint is 50-100x faster than ESLint and covers most rules. ESLint is retained only for `security` and `sonarjs` plugins which oxlint doesn't support yet.

## Test Runner: vitest

- Config: `vitest.config.ts`
- Globals enabled (`describe`, `it`, `expect` available without imports)
- Coverage: v8 provider, thresholds enforced
- Pattern: `tests/**/*.test.ts`

### Test organization

```
tests/
├── adapters/       # Adapter implementation tests
├── core/           # Core domain logic tests
├── helpers/        # Test utilities, in-memory fakes, fixtures
├── integration/    # Full-stack MCP server integration tests
├── resilience/     # Circuit breaker, rate limiter, timeout tests
├── telemetry/      # OTel instrumentation tests
├── tools/          # MCP tool handler tests
└── workers/        # Worker manager tests
```

## Scripts: TypeScript via tsx

- All scripts in `scripts/*.ts` run via `tsx` (TypeScript execute)
- Scripts follow a `--check` mode pattern for CI validation
- Available scripts:
  - `check-prerequisites.ts` — verify system tools
  - `generate-notices.ts` — THIRD-PARTY-NOTICES.md + README dependency table
  - `generate-schema.ts` — config.schema.json + docs/configuration.md injection
  - `generate-dev-reference.ts` — docs/dev-reference.md from config files

## Version Management: mise

- Config: `mise.toml`
- Pins: node (lts), bun, deno, pnpm
- Tasks: `dev`, `check`, `ci` shortcuts
- Install: `mise install` to get all pinned versions

## Code Duplication: jscpd

- Config: `.jscpd.json`
- Threshold: < 6% duplication
- Reports: `reports/jscpd/jscpd-report.json`
- CI badge: gist-backed dynamic badge

## Secret Scanning: gitleaks

- Config: `.gitleaks.toml`
- Runs in pre-commit hook and CI workflow
- Install: `brew install gitleaks` (macOS)
