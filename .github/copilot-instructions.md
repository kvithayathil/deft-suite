# Deft Suite — Copilot Instructions

## Runtime Convention

**Use `bun` as the default runner. Use `bunx` instead of `npx`.**

- Fallback order: `bun` → `pnpm` → `npm`
- Never default to `npm` or `npx` when `bun`/`bunx` is available
- Runtime versions pinned in `mise.toml` (node, bun, deno, pnpm)

## Commands

| Task | Command |
|------|---------|
| Test | `bun run test` |
| Build | `bun run build` |
| Lint | `bun run lint` (oxlint + ESLint) |
| Format | `bun run fmt` (oxfmt, single quotes) |
| Type check | `bun run typecheck` |

## Code Style

- No `any` types — use `unknown` + type guards
- TDD: failing test first, then minimal implementation
- Errors use `src/core/errors.ts` structured format
- Hexagonal architecture: core domain has zero external dependencies
