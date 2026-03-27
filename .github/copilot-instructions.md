# Deft Suite — Copilot Instructions

**Use `bun` as the default runner. Use `bunx` instead of `npx`.**

## Detailed Docs

| Topic | Doc |
|-------|-----|
| Project Conventions | [docs/agents/project-conventions.md](docs/agents/project-conventions.md) |
| Architecture | [docs/agents/architecture.md](docs/agents/architecture.md) |
| Toolchain | [docs/agents/toolchain.md](docs/agents/toolchain.md) |
| Code Style | [docs/agents/code-style.md](docs/agents/code-style.md) |

## Essential Commands

```bash
bun run test          # vitest
bun run build         # tsc
bun run lint          # oxlint + eslint
bun run fmt           # oxfmt
bun run typecheck     # tsc --noEmit
```

## Key Rules

- No `any` types — use `unknown` + type guards
- TDD: failing test first, then minimal implementation
- Errors use `src/core/errors.ts` structured format
- Hexagonal architecture: core domain has zero external dependencies
- Do not include `docs/internal/` in commits unless explicitly asked
