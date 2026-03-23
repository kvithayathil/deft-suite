# Deft Suite

> **v1.0.0-beta** — [Changelog](CHANGELOG.md)

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

## Install and Build

```bash
npm install
npm run build
```

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

Register as a stdio server in your MCP client config:

```json
{
  "mcpServers": {
    "deft-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/deft-mcp/dist/index.js"]
    }
  }
}
```

Works with Claude Desktop, Windsurf, Cursor, VS Code, and any MCP-compatible client.

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
| [Configuration](docs/configuration.md) | Full config schema, merge semantics, environment overrides |
| [Tools Reference](docs/tools-reference.md) | Per-tool parameters, responses, and error codes |
| [Roadmap](docs/roadmap.md) | What shipped, what's next |
| [Changelog](CHANGELOG.md) | Release history |

## Contributing

Contributions welcome. Add tests for behavioral changes and keep docs aligned with implementation.

## License

[GPL-3.0](LICENSE) — All derivative works must remain open source. See the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) for details.
