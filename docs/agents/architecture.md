# Architecture

## Overview

Hexagonal (ports & adapters). Core domain in `src/core/` has **zero external dependencies** — only port interfaces. All I/O is in adapters.

```mermaid
graph TD
  subgraph Driving["Driving Adapters (inbound)"]
    MCP["MCP Server"]
    CLI["CLI"]
  end
  subgraph Tools["Tool Handlers"]
    TH["search · install · save · remove · get · push"]
  end
  subgraph Core["Core Domain (zero deps)"]
    CD["types · errors · resolver · lifecycle · trust · frecency"]
  end
  subgraph Ports["Port Interfaces"]
    PI["SkillStore · CatalogStore · Scanner · SearchIndex · ..."]
  end
  subgraph Driven["Driven Adapters (outbound)"]
    DA["Fs · Git · SQLite · GitHub · Scanner"]
  end
  Driving --> Tools --> Core --> Ports
  Driven -.->|implements| Ports
```

## Source tree (from `src/`)

<!-- BEGIN:src-tree -->
```
src/
├── adapters/ (12 files)
│   ├── driven/ (10 files)
│   └── driving/ (2 files)
├── core/ (24 files)
│   └── ports/ (11 files)
├── resilience/ (5 files)
├── telemetry/ (1 files)
├── tools/ (14 files)
├── workers/ (5 files)
├── bootstrap.ts
├── cli-args.ts
├── cli.ts
├── index.ts
└── version.ts
```
<!-- END:src-tree -->

## Port interfaces (from `src/core/ports/`)

<!-- BEGIN:ports -->
| Port | Interface |
|------|-----------|
| `catalog-store` | `CatalogStore` |
| `config-store` | `ConfigStore` |
| `credential-store` | `CredentialStore` |
| `github-search` | `GitHubSearch` |
| `logger` | `Logger` |
| `scanner` | `Scanner` |
| `search-index` | `SearchIndex` |
| `skill-lock-store` | `SkillLockStore` |
| `skill-store` | `SkillStore` |
| `usage-store` | `UsageStore` |
<!-- END:ports -->

### Port → Adapter wiring (auto-generated)

<!-- BEGIN:port-adapter-diagram -->
```mermaid
graph LR
  subgraph Ports["Port Interfaces"]
    CatalogStore["CatalogStore"]
    ConfigStore["ConfigStore"]
    GitHubSearch["GitHubSearch"]
    Logger["Logger"]
    Scanner["Scanner"]
    SearchIndex["SearchIndex"]
    SkillLockStore["SkillLockStore"]
    SkillStore["SkillStore"]
    UsageStore["UsageStore"]
  end
  subgraph Driven["Driven Adapters (outbound)"]
    BuiltinScanner["BuiltinScanner"]
    ConsoleLogger["ConsoleLogger"]
    FileConfigStore["FileConfigStore"]
    FileSkillLockStore["FileSkillLockStore"]
    FsSkillStore["FsSkillStore"]
    GitCatalogStore["GitCatalogStore"]
    GitHubSearchAdapter["GitHubSearchAdapter"]
    MemorySearchIndex["MemorySearchIndex"]
    SqliteUsageStore["SqliteUsageStore"]
    StaticCatalogStore["StaticCatalogStore"]
  end
  BuiltinScanner -.->|implements| Scanner
  ConsoleLogger -.->|implements| Logger
  FileConfigStore -.->|implements| ConfigStore
  FileSkillLockStore -.->|implements| SkillLockStore
  FsSkillStore -.->|implements| SkillStore
  GitCatalogStore -.->|implements| CatalogStore
  GitHubSearchAdapter -.->|implements| GitHubSearch
  MemorySearchIndex -.->|implements| SearchIndex
  SqliteUsageStore -.->|implements| UsageStore
  StaticCatalogStore -.->|implements| CatalogStore
```
<!-- END:port-adapter-diagram -->

Dependency direction: adapters → ports. Never the reverse.

## Key Patterns

- **ToolContext** (`src/tools/context.ts`): DI boundary. Bootstrap wires adapters → ports → context. Tool handlers receive context.
- **Config merge**: `built-in defaults → global config → project config → env overrides` (see `src/core/config-merger.ts`).
- **Resilience**: circuit breakers (remote calls), token buckets (rate limiting), tiered timeouts (local vs remote).
- **Bootstrap** (`src/bootstrap.ts`): shared wiring for both `src/index.ts` (MCP server) and `src/cli.ts` (CLI).
