# Project Conventions

## Runtime

**Use `bun` as the default runner. Use `bunx` instead of `npx`.**

- Fallback order: `bun` → `pnpm` → `npm`
- Never default to `npm` or `npx` when `bun`/`bunx` is available
- Runtime versions pinned in `mise.toml` (node 22, bun, deno, pnpm)
- Pre-commit hook auto-detects fastest runner (bun → pnpm → npm)
- CI uses npm for reproducibility (lockfile-exact `npm ci`)

## Commands

All commands use `bun run`:

| Task | Command |
|------|---------|
| Test | `bun run test` |
| Test (watch) | `bun run test:watch` |
| Test (coverage) | `bun run test:coverage` |
| Build | `bun run build` |
| Lint | `bun run lint` (oxlint + ESLint chained) |
| Format | `bun run fmt` |
| Format check | `bun run fmt:check` |
| Type check | `bun run typecheck` |
| Duplication | `bun run check:duplication` |
| Notices check | `bun run check:notices` |
| Dev reference check | `bun run check:dev-reference` |
| Generate notices | `bun run generate:notices` |
| Generate dev ref | `bun run generate:dev-reference` |
| Generate schema | `bun run generate:schema` |

### mise shortcuts

```bash
mise run check    # fmt:check + typecheck + lint
mise run ci       # full CI pipeline locally
mise run dev      # start MCP server
```

## Multi-Runtime Support

This project supports three runtimes with Bun as primary:

| Runtime | Role | Config |
|---------|------|--------|
| **Bun** | Primary dev runtime | `mise.toml` |
| **Deno** | First-class alternative | `deno.json` |
| **Node.js** | CI + production + fallback | `package.json` engines |

### Running the server

```bash
node dist/index.js          # Node.js
bun dist/index.js           # Bun
deno task run                # Deno
```

## Git Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- Pre-commit hook runs: `generate:notices` → `check:duplication` → `gitleaks`
- Do not include `docs/internal/` in commits unless explicitly asked
- `.git-forbidden-patterns` (gitignored) blocks corporate URLs from leaking into commits
