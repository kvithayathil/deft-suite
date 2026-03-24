# Changelog

All notable changes to Deft Suite (deft-mcp) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-beta.3] — 2026-03-24

### Fixed
- **sync-worker crash on startup** — `config.sources is not iterable` caused by config shape mismatch; sources are now correctly read from the top-level config (#2)

### Added
- Auto-create `~/.config/deft/config.json` with merged defaults on first startup
- Regression tests for sync-worker config handling

## [1.0.0-beta.2] — 2026-03-23

### Added
- Build-time `THIRD-PARTY-NOTICES.md` generation from dependency license metadata
- Auto-generated `README.md` Third-Party Notices section synced from generated data
- Pre-commit hook at `.githooks/pre-commit` to regenerate and stage notices files
- CI freshness check via `npm run check:notices`

### Changed
- Version bumped from `1.0.0-beta` to `1.0.0-beta.2`

## [1.0.0-beta] — 2026-03-22

First public beta. All core features are implemented and tested.

### MCP Tools
- **`search_skills`** — unified search with grouped `local` / `catalogs` / `github` response, frecency-blended local ranking, `sources` filter, `refresh` flag, offline fallback
- **`get_skill`** — full skill content with trust indicator, stale-serve during scan, quarantine enforcement
- **`get_resource`** — retrieve resource files from installed skills
- **`list_categories`** — browse indexed skill categories from metadata tags
- **`install_skill`** — resolve, validate, scan, and install with access-control and lock tracking
- **`remove_skill`** — remove installed skills with lock and lifecycle cleanup
- **`save_skill`** — validate, scan, and save custom skills
- **`push_skills`** — placeholder (returns unavailable)
- **`update_config`** — in-memory session config updates
- **`save_config`** — persist config to disk with hot reload
- **`get_status`** — health check with summary, lifecycle, lock, circuit breaker, and network state

### Architecture
- Hexagonal architecture with port interfaces for all driven adapters
- `ToolContext` composition pattern for dependency injection across all tool handlers
- Manifest builder with compact skill injection at MCP initialize time

### Unified Search
- Frecency engine — time-decay scoring, pruning, session-cap, ceiling safeguards
- SQLite-backed usage store (`better-sqlite3`) — access tracking, search analytics, frecency scores
- Catalog adapters — `StaticCatalogStore` (HTTP + ETag/Last-Modified cache), `GitCatalogStore` (clone/pull + JSON fallback)
- GitHub search adapter — opt-in, opportunistic auth chain (`gh auth token` → `GITHUB_TOKEN` → unauthenticated), rate-limit tracking, `TokenBucket` throttling
- Catalog searcher — pure weighted scoring (name ×2, tags ×1.5, description ×1)
- Offline-first behavior — stale cache fallback, deterministic `offline` flag

### Security
- Built-in scanner with 8 rules: command injection, path traversal, URL exfiltration, excessive permissions, hex-encoded commands, ROT13 obfuscation, template injection, binary detection
- Trust evaluator with configurable minimum trust level
- Access control: blocklist/allowlist modes with global precedence enforcement
- Scan-before-install and scan-before-save enforcement

### Resilience
- Tiered timeout system (fast/medium/slow)
- Per-tool rate limiting via token bucket
- Circuit breaker per remote source with automatic recovery
- Composed resilience wrapper for all tool operations

### Configuration
- Three-layer merge: built-in defaults → global config → project config
- Project config discovery: `.deft/`, `.claude/deft/`, `.agents/deft/`
- Environment variable overrides (`DEFT_LOG_LEVEL`, `DEFT_MIN_TRUST`)
- Hot reload via `save_config`
- Platform-aware directory conventions (Claude Code, Windsurf, Cursor, Copilot, Zed, OpenCode)

### CLI
- `search <query>` with `--refresh` flag and interactive remote install picker
- `stats` — usage and search analytics summary
- `usage export --format json` — export raw usage data
- `usage reset <name>` / `usage reset --all` — reset frecency data
- `--help` and `--version` flags

### Infrastructure
- Worker manager with heartbeat monitoring and start/ready protocol
- Structured console logger with configurable levels
- Skill lock manager with lock file persistence
- Noop telemetry interface ready for OTel wiring (Phase 2)
- 322+ tests across unit, integration, and adapter layers
- Licensed under GPL-3.0
