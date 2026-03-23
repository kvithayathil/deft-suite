# Getting Started

This guide walks through first-time setup and your first skill lifecycle with Deft Suite (`deft-mcp`).

## 1) Install

### From GitHub (no npm publish required)

```bash
npm install -g github:kvithayathil/deft-suite
```

Or pin a specific tag:

```bash
npm install -g github:kvithayathil/deft-suite#v1.0.0-beta
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

## 2) Global Config Location

Deft uses a global config file at:

`~/.config/deft/config.json`

If the file does not exist yet, defaults from `src/core/config-merger.ts` are used.

## 3) Run the MCP Server (stdio)

```bash
node dist/index.js
```

The server communicates over stdio and is intended to be launched by an MCP client.

## 4) Configure Your MCP Client

Add `deft-mcp` to your MCP client config (Claude Desktop, Windsurf, Cursor, VS Code, etc.):

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
      "args": ["-y", "github:kvithayathil/deft-suite#v1.0.0-beta", "deft-mcp"]
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

## 5) Verify Server Health

Call `get_status`.

Expected top-level fields include:
- `summary`
- `skills`
- `lock`
- `circuitBreakers`
- `accessControl`
- `network`

## 6) Install Your First Skill

Call `install_skill`:

```json
{
  "skill": "tdd-python"
}
```

What happens:
- duplicate check
- access-control check
- resolve from configured sources
- metadata validation
- security scan
- write to local store + lock update

## 7) Read a Skill

Call `get_skill`:

```json
{
  "name": "tdd-python"
}
```

Response includes trust indicator, full content, and `stale` state.

## 8) Save a Custom Skill

Call `save_skill`:

```json
{
  "name": "my-custom-skill",
  "content": "---\nname: my-custom-skill\ndescription: custom skill\n---\n# My skill",
  "description": "custom skill"
}
```

`save_skill` validates metadata, checks duplicates, scans content, and then saves.

## 9) Project-Level Config Discovery

At startup and config reload, Deft checks for project config in this order:

1. `.deft/config.json`
2. `.claude/deft/config.json`
3. `.agents/deft/config.json`

The first path found is loaded and merged over global config.

## 10) Persist Config Changes

- Use `update_config` for in-session updates (memory only).
- Use `save_config` to write config to disk and trigger reload.

## 11) Configure Team Catalogs (Optional)

Add registry sources to your config to include team-maintained catalogs in unified search:

```json
{
  "registries": {
    "cacheMinutes": 60,
    "sources": [
      { "type": "static", "url": "https://example.com/skill-catalog.json" },
      { "type": "git", "url": "https://github.com/acme/skill-catalog.git" }
    ]
  }
}
```

Then call `search_skills` and you will receive grouped results under `local`, `catalogs`, and `github`.

## 12) Enable GitHub Search (Optional)

GitHub search is opt-in:

```json
{
  "github": {
    "search": true,
    "topics": ["mcp-skill"]
  }
}
```

- Keep this disabled if you do not want search queries sent to GitHub.
- For best rate limits, authenticate with `gh auth login` or set `GITHUB_TOKEN`.

## 13) Inspect Usage and Frecency (CLI)

The CLI includes usage analytics commands backed by local SQLite storage:

```bash
deft stats
deft usage export --format json
deft usage reset --all
```

You can also install and use the bundled `usage-stats` skill to help interpret frecency/search analytics.

## Next

- `docs/configuration.md` for full schema and merge semantics
- `docs/tools-reference.md` for per-tool parameters and responses
