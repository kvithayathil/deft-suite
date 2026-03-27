# Code Style

## TypeScript

### Type Safety

- **No `any` types.** Use `unknown` + type guards instead.
- All public function parameters and return types should be explicitly typed.
- Use `readonly` for properties that shouldn't be mutated after construction.
- Prefer `interface` for object shapes, `type` for unions/intersections.

### Imports

- Use `.js` extension in relative imports (required for ESM).
- Group imports: node builtins → external packages → internal modules.
- Barrel exports via `index.ts` only in `src/core/ports/`.

### Error Handling

- All domain errors use the structured format from `src/core/errors.ts`.
- Error codes are typed constants (e.g., `SKILL_NOT_FOUND`, `SCAN_FAILED`).
- Never throw raw strings or generic `Error` — always use `createError()`.
- Tool handlers catch domain errors and return MCP-compliant error responses.

## Testing

### TDD Workflow

1. Write a failing test first
2. Implement minimal code to pass
3. Refactor with tests green

### Test Patterns

- **Core logic**: tested via port interfaces with in-memory fakes from `tests/helpers/`
- **Adapters**: tested with real implementations against temporary directories/databases
- **Tools**: tested with a mock `ToolContext` from `tests/helpers/make-context.ts`
- **Integration**: full MCP server startup, tool call, response cycle

### Test Helpers

| Helper | Location | Purpose |
|--------|----------|---------|
| `make-context.ts` | `tests/helpers/` | Creates mock `ToolContext` with in-memory stores |
| `fixture-skills.ts` | `tests/helpers/` | Reusable skill fixtures for tests |
| `in-memory-catalog-store.ts` | `tests/helpers/` | In-memory catalog store fake |
| `in-memory-usage-store.ts` | `tests/helpers/` | In-memory usage store fake |

### Naming

- Test files: `<module>.test.ts` mirroring the source path
- Describe blocks: match the class/function name
- Test names: describe behavior, not implementation (`'returns empty array when no skills match'`)

## Formatting

- **oxfmt** handles all formatting — do not manually adjust whitespace
- Single quotes (enforced by oxfmt)
- Run `bun run fmt` before committing if the pre-commit hook doesn't cover the file
