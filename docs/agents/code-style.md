# Code Style

## Types

- **No `any`.** Use `unknown` + type guards.
- Explicitly type public function parameters and return values.
- `readonly` for immutable properties. `interface` for shapes, `type` for unions.

## Imports

- `.js` extension on all relative imports (ESM requirement).
- Order: node builtins → external packages → internal modules.
- Barrel exports (`index.ts`) only in `src/core/ports/`.

## Errors

- Use `createError()` from `src/core/errors.ts`. Never throw raw strings or `new Error()`.
- Error codes are typed constants: `SKILL_NOT_FOUND`, `SCAN_FAILED`, etc.
- Tool handlers catch domain errors → MCP-compliant error responses.

## Testing

**TDD**: failing test → minimal pass → refactor.

| Layer | Strategy |
|-------|----------|
| Core | Port interfaces with in-memory fakes from `tests/helpers/` |
| Adapters | Real implementations against temp dirs/databases |
| Tools | Mock `ToolContext` via `tests/helpers/make-context.ts` |
| Integration | Full MCP server startup → tool call → response |

### Naming

- Files: `<module>.test.ts` mirroring source path.
- Describe blocks: class or function name.
- Test names: behavior, not implementation (`'returns empty array when no skills match'`).

### Test helpers (from `tests/helpers/`)

<!-- BEGIN:test-helpers -->
| File | Key Export |
|------|------------|
| `fixture-skills.ts` | `makeSkill` |
| `in-memory-catalog-store.ts` | `InMemoryCatalogStore` |
| `in-memory-config-store.ts` | `InMemoryConfigStore` |
| `in-memory-credential-store.ts` | `InMemoryCredentialStore` |
| `in-memory-github-search.ts` | `InMemoryGitHubSearch` |
| `in-memory-search-index.ts` | `InMemorySearchIndex` |
| `in-memory-skill-lock-store.ts` | `InMemorySkillLockStore` |
| `in-memory-skill-store.ts` | `InMemorySkillStore` |
| `in-memory-usage-store.ts` | `InMemoryUsageStore` |
| `make-context.ts` | `makeTestContext` |
| `noop-logger.ts` | `NoopLogger` |
| `stub-scanner.ts` | `StubScanner` |
<!-- END:test-helpers -->

## Formatting

**oxfmt** owns all formatting. Single quotes. Do not manually adjust whitespace.
