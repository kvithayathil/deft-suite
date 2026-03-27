# Architecture

## Hexagonal Architecture (Ports & Adapters)

The core domain in `src/core/` has **zero external dependencies** — it depends only on port interfaces. All I/O, storage, and external communication is implemented by adapters.

```
┌─────────────────────────────────────────────┐
│                 Driving Adapters             │
│   (MCP Server, CLI)                         │
├─────────────────────────────────────────────┤
│                 Tool Handlers               │
│   (search, install, save, get, remove, ...) │
├─────────────────────────────────────────────┤
│                 Core Domain                 │
│   (types, errors, validator, resolver,      │
│    lifecycle, frecency, trust, config)      │
├─────────────────────────────────────────────┤
│                 Port Interfaces             │
│   (SkillStore, CatalogStore, Scanner, ...)  │
├─────────────────────────────────────────────┤
│                 Driven Adapters             │
│   (FsSkillStore, GitCatalogStore, SQLite,   │
│    BuiltinScanner, GithubSearchAdapter)     │
└─────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── adapters/
│   ├── driven/              # Outbound adapters (storage, network, scanning)
│   │   ├── builtin-scanner.ts
│   │   ├── file-config-store.ts
│   │   ├── fs-skill-store.ts
│   │   ├── git-catalog-store.ts
│   │   ├── github-search-adapter.ts
│   │   ├── json-skill-lock-store.ts
│   │   ├── memory-search-index.ts
│   │   ├── sqlite-usage-store.ts
│   │   └── static-catalog-store.ts
│   └── driving/             # Inbound adapters (MCP server, CLI)
│       ├── cli-adapter.ts
│       └── mcp-server.ts
├── core/
│   ├── ports/               # Port interfaces (contracts)
│   │   ├── catalog-store.ts
│   │   ├── config-store.ts
│   │   ├── credential-store.ts
│   │   ├── github-search.ts
│   │   ├── logger.ts
│   │   ├── scanner.ts
│   │   ├── search-index.ts
│   │   ├── skill-lock-store.ts
│   │   ├── skill-store.ts
│   │   └── usage-store.ts
│   ├── types.ts             # Domain types (Skill, Config, etc.)
│   ├── errors.ts            # Structured error catalog
│   ├── config-merger.ts     # Three-layer config merge
│   ├── config-discovery.ts  # Project config path discovery
│   ├── config-validator.ts  # Config schema validation
│   ├── skill-resolver.ts    # Source resolution chain
│   ├── skill-lifecycle.ts   # Install/save state machine
│   ├── skill-lock.ts        # Lock file management
│   ├── trust-evaluator.ts   # Trust level computation
│   ├── frecency.ts          # Frecency scoring algorithm
│   ├── catalog-searcher.ts  # Catalog search orchestration
│   ├── manifest-builder.ts  # Compact manifest for MCP initialize
│   └── validator.ts         # Metadata validation
├── tools/                   # MCP tool handler implementations
│   ├── context.ts           # Shared ToolContext type
│   ├── search-skills.ts
│   ├── get-skill.ts
│   ├── install-skill.ts
│   ├── save-skill.ts
│   ├── remove-skill.ts
│   ├── get-resource.ts
│   ├── list-categories.ts
│   ├── get-status.ts
│   ├── update-config.ts
│   ├── save-config.ts
│   └── push-skills.ts
├── resilience/              # Cross-cutting resilience patterns
│   ├── circuit-breaker.ts
│   ├── tiered-timeout.ts
│   └── token-bucket.ts
├── workers/                 # Background worker management
│   ├── sync-worker.ts
│   ├── scanner-worker.ts
│   └── index-worker.ts
├── telemetry/
│   └── otel.ts              # OpenTelemetry instrumentation stub
├── bootstrap.ts             # Application wiring and startup
├── index.ts                 # MCP server entry point
├── cli.ts                   # CLI entry point
└── cli-args.ts              # CLI argument parsing
```

## Key Patterns

### Port Interfaces

All external dependencies are abstracted behind port interfaces in `src/core/ports/`. This allows:
- Core logic to be tested with in-memory fakes
- Adapters to be swapped without changing domain code
- Clear dependency direction: adapters depend on ports, never the reverse

### Tool Context

Tool handlers receive a `ToolContext` object (defined in `src/tools/context.ts`) containing all wired dependencies. This is the dependency injection boundary between bootstrap and tool logic.

### Config Merge Chain

```
built-in defaults → global config → project config → env overrides
```

See `src/core/config-merger.ts` for merge semantics.

### Resilience Layer

- **Circuit breakers**: protect remote calls (GitHub, catalogs)
- **Rate limiting**: token bucket per tool
- **Tiered timeouts**: different timeouts for local vs remote operations

### Bootstrap

`src/bootstrap.ts` wires all adapters to ports and constructs the `ToolContext`. Both `src/index.ts` (MCP server) and `src/cli.ts` (CLI) use bootstrap for shared wiring.
