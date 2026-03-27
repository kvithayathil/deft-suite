# Deft Suite — Project Conventions

## Runtime Convention

**Use `bun` as the default runner. Use `bunx` instead of `npx`.**

- Fallback order: `bun` → `pnpm` → `npm`
- Never default to `npm` or `npx` when `bun`/`bunx` is available
- Runtime versions pinned in `mise.toml` (node, bun, deno, pnpm)

## Commands

All commands use `bun run`:

| Task | Command |
|------|---------|
| Test | `bun run test` |
| Build | `bun run build` |
| Lint | `bun run lint` (oxlint + ESLint) |
| Format | `bun run fmt` (oxfmt, single quotes) |
| Type check | `bun run typecheck` |
| Duplication | `bun run check:duplication` |

## Toolchain

- **Formatter**: oxfmt (single quotes) — `.oxfmtrc.json`
- **Linter**: oxlint (primary) + ESLint (security/sonarjs) — `.oxlintrc.json` + `eslint.config.js`
- **Test runner**: vitest — `vitest.config.ts`
- **Scripts**: TypeScript via tsx — `scripts/*.ts`

## Code Style

- No `any` types — use `unknown` + type guards
- TDD: failing test first, then minimal implementation
- Errors use `src/core/errors.ts` structured format
- Hexagonal architecture: core domain in `src/core/` has zero external deps
- Do not include `docs/internal/` in commits unless explicitly asked
