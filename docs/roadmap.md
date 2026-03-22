# Skill MCP — Roadmap

> Last updated: 2026-03-21

## Completed

### v1 Core Implementation
All 16 tasks from the [v1 completion plan](superpowers/plans/2026-03-20-v1-completion.md) are implemented and verified:

- **Bootstrap wiring** — FileSkillLockStore, resilience context, config discovery, workers
- **Tool handlers** — validation in save/install, stale-serve in get_skill, hot-reload in save_config, full get_status
- **Resilience** — tool wrapper composing timeout + rate limit + circuit breaker
- **Scanner** — 4 new rules (hex-encoded commands, ROT13, template injection, binary detection)
- **Search index** — category support via tags
- **Config discovery** — multi-path project config chain (`.skill-mcp/`, `.claude/skill-mcp/`, `.agents/skill-mcp/`)
- **Workers** — WorkerManager with heartbeat monitoring, start/ready protocol
- **MCP server** — clientInfo capture from handshake
- **Logger** — structured context in console output
- **Documentation** — README, getting-started, configuration, tools-reference

### Phase 1: Unified Skill Search

All planned Phase 1 tasks from the [unified search plan](superpowers/plans/2026-03-21-unified-search-task-breakdown.md) are complete:

- unified domain/config foundations (`registries`, `github`, `usage`)
- frecency engine with pruning/session-cap/ceiling safeguards
- SQLite-backed usage tracking and search analytics
- catalog adapters (git/static), GitHub discovery adapter, and pure catalog searcher
- grouped unified `search_skills` orchestrator with offline fallback + cache-aware behavior
- bootstrap and CLI integration (`search --refresh`, interactive install picker, usage/stats commands)
- integration coverage for grouped responses, offline fallback, cache lifecycle, and MCP tool invocation
- documentation refresh across configuration/getting-started/tools reference/README

---

## Next Up

### Phase 2: Security & Reliability *(medium priority)*

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1. **CredentialStore adapter** | OS keychain + encrypted file backends for API tokens | Small |
| 2. **Full OTel implementation** | Wire real spans/metrics when `telemetry.enabled: true` | Small |
| 3. **Enhanced scanner PATH detection** | Integrate Semgrep, ShellCheck, Trivy, TruffleHog when available on PATH | Medium |

### Phase 3: Transport & Distribution *(medium priority)*

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1. **SSE/HTTP transport** | Second transport mode beyond stdio for web-based clients | Medium |
| 2. **IPC socket transport** | Third transport for local inter-process communication | Medium |
| 3. **Go TUI installer** | Rich terminal installer for first-time setup (cross-platform binary) | Large |

### Phase 4: CLI Completeness *(lower priority)*

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1. **`doctor` command** | Diagnose config, scanner, connectivity issues | Small |
| 2. **`guide` command** | Interactive onboarding walkthrough | Medium |
| 3. **`manual` command** | Offline reference for all tools and config | Small |
| 4. **`reset` command** | Reset config, usage data, or skill state | Small |
| 5. **`uninstall` command** | Clean removal of skills and config | Small |
| 6. **`logs` command** | View and tail server logs | Small |

---

## Design Principles for Future Work

- **Hexagonal architecture** — all new features go through port interfaces
- **TDD** — failing test first, then minimal implementation
- **Offline-first** — remote features degrade gracefully
- **Context efficiency** — minimize token cost for agents
- **No native deps without justification** — `better-sqlite3` is the only planned native addon
