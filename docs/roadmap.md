# Skill MCP — Roadmap

> Last updated: 2026-03-27

---

## v1.0.0-beta — Shipped

Everything below is included in the current release. See [CHANGELOG.md](../CHANGELOG.md) for the full feature list.

### Core
- 11 MCP tools: `search_skills`, `get_skill`, `get_resource`, `list_categories`, `install_skill`, `remove_skill`, `save_skill`, `push_skills`, `update_config`, `save_config`, `get_status`
- Hexagonal architecture with port interfaces for all adapters
- Secure install/save flows with validation + security scanning
- Trust-aware skill lifecycle and lock tracking
- Compact manifest injection at MCP initialize time
- Project-aware config overlays with multi-path discovery
- Resilience layer: tiered timeouts, rate limiting, circuit breakers
- Worker manager with heartbeat monitoring

### Unified Search
- Grouped search across local, team catalogs, and GitHub (opt-in)
- Frecency-aware ranking with local usage analytics (SQLite-backed)
- Catalog adapters: git clone/pull and static HTTP with cache
- GitHub code search with opportunistic auth and rate-limit tracking
- Offline-first: graceful degradation when remotes are unavailable

### CLI
- `search` with `--refresh` and interactive remote install picker
- `stats` and `usage export/reset` commands
- Full `--help` and `--version` support

---

## Future Phases

### Phase 2: Observability & Security *(next up)*

| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| **Secret scanning** | Three-layer defense: gitleaks pre-commit + CI workflow + GitHub Secret Scanning | Small | ✅ Done |
| **Code quality gates** | jscpd duplication, eslint-plugin-sonarjs cognitive complexity, gist-backed badges | Small | ✅ Done |
| **OTel implementation** | Wire real spans/metrics into existing `Telemetry` port; pluggable backends (Langfuse, Jaeger, Grafana) via config | Small | |
| **CredentialStore adapter** | OS keychain + encrypted file backends for API tokens | Small | |
| **Enhanced scanner** | Integrate Semgrep, ShellCheck, Trivy when available on PATH | Medium | |

> See [observability research](internal/specs/2026-03-21-observability-eval-research.md) for MLflow/Langfuse analysis.

### Phase 3: Transport & Distribution

| Task | Description | Effort |
|------|-------------|--------|
| **SSE/HTTP transport** | Second transport mode for web-based clients | Medium |
| **IPC socket transport** | Local inter-process communication | Medium |
| **Go TUI installer** | Cross-platform rich terminal installer for first-time setup | Large |

### Phase 4: CLI Completeness

| Task | Description | Effort |
|------|-------------|--------|
| **`doctor`** | Diagnose config, scanner, connectivity issues | Small |
| **`guide`** | Interactive onboarding walkthrough | Medium |
| **`manual`** | Offline reference for all tools and config | Small |
| **`reset`** | Reset config, usage data, or skill state | Small |
| **`uninstall`** | Clean removal of skills and config | Small |
| **`logs`** | View and tail server logs | Small |

---

## Research

| Topic | Summary | Link |
|-------|---------|------|
| **MLflow vs Langfuse** | Neither is a natural direct integration. OTel foundation first, Langfuse as optional backend, MLflow for separate eval harness. | [Full analysis](internal/specs/2026-03-21-observability-eval-research.md) |

---

## Design Principles

- **Hexagonal architecture** — all features go through port interfaces
- **TDD** — failing test first, then minimal implementation
- **Offline-first** — remote features degrade gracefully
- **Context efficiency** — minimize token cost for agents
- **No native deps without justification** — `better-sqlite3` is the only planned native addon

<!-- Gist-backed dynamic badges for coverage and duplication are now active.
     See .github/workflows/ci.yml for the badge update steps and
     SECURITY.md for the full security tooling overview.
-->
