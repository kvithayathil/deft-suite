# Skill MCP — Roadmap

> Last updated: 2026-03-22

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

| Task | Description | Effort |
|------|-------------|--------|
| **OTel implementation** | Wire real spans/metrics into existing `Telemetry` port; pluggable backends (Langfuse, Jaeger, Grafana) via config | Small |
| **CredentialStore adapter** | OS keychain + encrypted file backends for API tokens | Small |
| **Enhanced scanner** | Integrate Semgrep, ShellCheck, Trivy, TruffleHog when available on PATH | Medium |

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

<!-- GIST-BACKED COVERAGE BADGE — HOW TO ENABLE

The CI workflow (.github/workflows/ci.yml) contains commented-out steps for a
gist-backed dynamic coverage badge via shields.io. This is an alternative to
Codecov that requires no third-party service — just a GitHub gist and a PAT.

## Prerequisites

1. A GitHub Personal Access Token (classic) with the `gist` scope.
2. A secret gist (content doesn't matter — it will be overwritten by CI).

## Setup

1. Create the gist:
   - Go to https://gist.github.com and create a **secret** gist.
   - Name the file `coverage-badge.json` with any placeholder content.
   - Copy the gist ID from the URL (the hex string after your username).

2. Add repository secrets (Settings → Secrets and variables → Actions):
   - `GIST_TOKEN` — the PAT created above.
   - `COVERAGE_GIST_ID` — the gist ID from step 1.

3. Uncomment the CI steps in `.github/workflows/ci.yml`:
   - "Extract coverage summary" — parses coverage-summary.json and outputs
     the line coverage percentage.
   - "Update coverage badge (gist)" — writes a shields.io-compatible JSON
     endpoint to the gist using schneegans/dynamic-badges-action@v1.7.0.

4. Uncomment the badge in `README.md` and replace `GIST_ID` with your actual
   gist ID:
   ```
   [![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/kvithayathil/YOUR_GIST_ID/raw/coverage-badge.json)](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml)
   ```

## How it works

- On each push to `main`, CI runs coverage and extracts the line % from
  `coverage/coverage-summary.json` (produced by the `json-summary` reporter
  in vitest.config.ts).
- The `dynamic-badges-action` writes a JSON payload to the gist that shields.io
  reads to render the badge with an auto-colored value (red → yellow → green
  mapped to the 50–90% range).
- The badge is cached by shields.io for ~5 minutes.

## Comparison with Codecov

| Aspect          | Gist badge              | Codecov                       |
|-----------------|-------------------------|-------------------------------|
| PR comments     | No                      | Yes — coverage diffs per PR   |
| External service| None (GitHub + shields)  | codecov.io                    |
| Maintenance     | You own the CI script   | Managed SaaS                  |
| Failure mode    | Silent stale badge      | Explicit CI failure option    |

Both are configured in this repo. Codecov is active; the gist badge is
available as a zero-dependency fallback.
-->
