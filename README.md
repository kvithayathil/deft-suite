# Deft Suite

[![CI](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml)
[![CodeQL](https://github.com/kvithayathil/deft-suite/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/kvithayathil/deft-suite/actions/workflows/codeql.yml)
[![Secret Scanning](https://github.com/kvithayathil/deft-suite/actions/workflows/gitleaks.yml/badge.svg?branch=main)](https://github.com/kvithayathil/deft-suite/actions/workflows/gitleaks.yml)
[![codecov](https://codecov.io/gh/kvithayathil/deft-suite/branch/main/graph/badge.svg)](https://codecov.io/gh/kvithayathil/deft-suite)
[![npm version](https://img.shields.io/npm/v/deft-mcp)](https://www.npmjs.com/package/deft-mcp)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![codecov](https://codecov.io/gh/kvithayathil/deft-suite/branch/main/graph/badge.svg)](https://codecov.io/gh/kvithayathil/deft-suite)

<!-- Gist-backed dynamic badge (disabled) — uncomment after setting up the gist workflow
[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/kvithayathil/GIST_ID/raw/coverage-badge.json)](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml)
-->

[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/kvithayathil/c6e1b113c3ce1aa0729dd3fa9e24476/raw/coverage-badge.json)](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml)
[![duplication](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/kvithayathil/c6e1b113c3ce1aa0729dd3fa9e24476/raw/duplication-badge.json)](https://github.com/kvithayathil/deft-suite/actions/workflows/ci.yml)

<!-- GitLab badges — uncomment and replace YOUR_GROUP/deft-suite with your GitLab project path
[![GitLab Pipeline](https://gitlab.com/YOUR_GROUP/deft-suite/badges/main/pipeline.svg)](https://gitlab.com/YOUR_GROUP/deft-suite/-/pipelines)
[![GitLab Coverage](https://gitlab.com/YOUR_GROUP/deft-suite/badges/main/coverage.svg)](https://gitlab.com/YOUR_GROUP/deft-suite/-/graphs/main/charts)
-->

> **v1.0.0-beta.3** — [Changelog](CHANGELOG.md)

An MCP server for discovering, validating, installing, and managing reusable agent skills.

- **Unified search** across local skills, team catalogs, and GitHub (opt-in)
- **Secure install/save** with validation and security scanning
- **Trust-aware** skill lifecycle with lock tracking
- **Frecency ranking** blending keyword relevance with local usage patterns
- **Offline-first** — graceful degradation when remotes are unavailable
- **Project-aware** config overlays with multi-path discovery

## Prerequisites

- Node.js `>=20.0.0`
- npm
- Build toolchain for native addons (`better-sqlite3`)

## Installation

### From GitHub (no npm publish required)

```bash
npm install -g github:kvithayathil/deft-suite
```

Or pin a specific tag:

```bash
npm install -g github:kvithayathil/deft-suite#v1.0.0-beta.3
```

### From npm (once published)

```bash
npm install -g deft-mcp
```

### From source (development)

```bash
git clone https://github.com/kvithayathil/deft-suite.git
cd deft-suite
npm install
npm run build
npm link
```

This makes the `deft` CLI available globally via symlink.

## Run

Start the MCP server over stdio:

```bash
node dist/index.js
```

Or use the CLI:

```bash
node dist/cli.js --help
```

## MCP Client Setup

Most clients use the same `mcpServers` JSON — what differs is the config file location. See the **[full Client Setup Guide](docs/client-setup.md)** for step-by-step instructions per client.

### One-click install

[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-007ACC?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=deft-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/Install_in-VS_Code_Insiders-24bfa5?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=deft-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D&quality=insiders) [![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-000000?logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=deft-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1Yjprdml0aGF5YXRoaWwvZGVmdC1zdWl0ZSIsImRlZnQtbWNwIl19) [![Install in Visual Studio](https://img.shields.io/badge/Install_in-Visual_Studio-C16FDE?logo=visualstudio&logoColor=white)](https://vs-open.link/mcp-install?%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D)

### All clients

| Client | Config Location | Format Notes |
|--------|----------------|---------------|
| [![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-MCP-191919?logo=anthropic&logoColor=white)](docs/client-setup.md#claude-desktop) | `~/Library/Application Support/Claude/claude_desktop_config.json` | Standard `mcpServers` |
| [![Claude Code](https://img.shields.io/badge/Claude_Code-MCP-191919?logo=anthropic&logoColor=white)](docs/client-setup.md#claude-code-cli) | `claude mcp add` or `~/.claude.json` | CLI command preferred |
| [![Windsurf](https://img.shields.io/badge/Windsurf-MCP-09B6A2?logo=codeium&logoColor=white)](docs/client-setup.md#windsurf) | `~/.codeium/windsurf/mcp_config.json` | Standard `mcpServers` |
| [![Cursor](https://img.shields.io/badge/Cursor-MCP-000000?logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=deft-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1Yjprdml0aGF5YXRoaWwvZGVmdC1zdWl0ZSIsImRlZnQtbWNwIl19) | `.cursor/mcp.json` or global | One-click install · [guide](docs/client-setup.md#cursor) |
| [![VS Code](https://img.shields.io/badge/VS_Code-MCP-007ACC?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=deft-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D) | `.vscode/mcp.json` | One-click install · [guide](docs/client-setup.md#vs-code-github-copilot) |
| [![Visual Studio](https://img.shields.io/badge/Visual_Studio-MCP-C16FDE?logo=visualstudio&logoColor=white)](https://vs-open.link/mcp-install?%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D) | Settings UI | One-click install · [guide](docs/client-setup.md#visual-studio) |
| [![OpenCode](https://img.shields.io/badge/OpenCode-MCP-333333)](docs/client-setup.md#opencode) | `~/.config/opencode/config.json` or `opencode.jsonc` | Uses `mcp` key — different format · [guide](docs/client-setup.md#opencode) |
| [![Zed](https://img.shields.io/badge/Zed-MCP-084CCF?logo=zedindustries&logoColor=white)](docs/client-setup.md#zed) | `~/.zed/settings.json` | Uses `context_servers` — different format |
| [![JetBrains](https://img.shields.io/badge/JetBrains-MCP-000000?logo=jetbrains&logoColor=white)](docs/client-setup.md#jetbrains-ides-intellij-webstorm-pycharm-etc) | Settings UI or `.mcp.json` | Uses `servers` key + `type` field |
| [![Codex](https://img.shields.io/badge/Codex-MCP-412991?logo=openai&logoColor=white)](docs/client-setup.md#codex-openai-cli) | CLI flag `--mcp-config` | Standard `mcpServers` in file |

> **Tip:** VS Code, VS Code Insiders, Cursor, and Visual Studio badges are **one-click install** links — they open the client and configure the MCP server automatically. Other badges link to the [setup guide](docs/client-setup.md).

<details>
<summary><strong>Quick start (most clients)</strong></summary>

### Via npx (recommended — no local clone needed)

```json
{
  "mcpServers": {
    "deft-mcp": {
      "command": "npx",
      "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
    }
  }
}
```

Pin a specific version for stability:

```json
{
  "mcpServers": {
    "deft-mcp": {
      "command": "npx",
      "args": ["-y", "github:kvithayathil/deft-suite#v1.0.0-beta.3", "deft-mcp"]
    }
  }
}
```

> **Note:** First run is slower while dependencies install and compile. Subsequent runs use the npx cache.

### Via local path (if installed globally or from source)

```json
{
  "mcpServers": {
    "deft-mcp": {
      "command": "deft-mcp"
    }
  }
}
```

</details>

## Quick Start

1. Start the server
2. `get_status` — confirm health
3. `search_skills` — find skills across all sources
4. `install_skill` — install with validation + scanning
5. `get_skill` — retrieve full content with trust indicator
6. `save_skill` — create your own

## Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Unified search with grouped `local` / `catalogs` / `github` response |
| `get_skill` | Full skill content with trust indicator |
| `get_resource` | Skill resource file retrieval |
| `list_categories` | Browse indexed skill categories |
| `install_skill` | Resolve, validate, scan, and install |
| `remove_skill` | Remove an installed skill |
| `save_skill` | Validate, scan, and save a new skill |
| `push_skills` | Push to remote (placeholder) |
| `update_config` | In-memory session config update |
| `save_config` | Persist config with hot reload |
| `get_status` | Health, lifecycle, lock, network, circuit breaker state |

## CLI

```bash
deft search "python" --refresh
deft stats
deft usage export --format json
deft usage reset --all
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | First-time setup and skill lifecycle walkthrough |
| [Client Setup](docs/client-setup.md) | Per-client MCP config (Claude, Windsurf, Cursor, VS Code, Zed, JetBrains, etc.) |
| [Configuration](docs/configuration.md) | Full config schema, merge semantics, environment overrides |
| [Tools Reference](docs/tools-reference.md) | Per-tool parameters, responses, and error codes |
| [Agent Hooks](docs/agent-hooks.md) | Hook integration for consistent MCP usage across agent platforms |
| [Roadmap](docs/roadmap.md) | What shipped, what's next |
| [Changelog](CHANGELOG.md) | Release history |

## Contributing

Contributions welcome. Add tests for behavioral changes and keep docs aligned with implementation.

### Development Setup

```bash
git clone https://github.com/kvithayathil/deft-suite.git
cd deft-suite
npm install        # also configures git hooks and checks prerequisites
npm run build
```

**Recommended**: Install [gitleaks](https://github.com/gitleaks/gitleaks) for pre-commit secret scanning:

```bash
brew install gitleaks   # macOS
```

### Quality Checks

All checks run automatically via pre-commit hook and CI:

| Check | Command | Gate |
|-------|---------|------|
| Type safety | `npm run typecheck` | 0 errors |
| Lint (includes SonarJS) | `npm run lint` | 0 errors |
| Code duplication | `npm run check:duplication` | < 6% |
| Tests | `npm test` | Pass |
| Secret scanning | `gitleaks protect --staged` | 0 leaks |

See [SECURITY.md](SECURITY.md) for the full security tooling overview.
<!-- THIRD-PARTY-START -->

## Third-Party Notices

This project uses the following direct runtime dependencies:

| Package | License |
|---------|---------|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MIT |
| [ajv](https://github.com/ajv-validator/ajv) | MIT |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT |
| [yaml](https://github.com/eemeli/yaml) | ISC |

Full license texts are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

<!-- THIRD-PARTY-END -->

## License

[GPL-3.0](LICENSE) — All derivative works must remain open source. See the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) for details.
