# Getting Started

This guide walks through first-time setup and your first skill lifecycle with `skill-mcp`.

## 1) Install and Build

```bash
npm install
npm run build
```

## 2) Global Config Location

`skill-mcp` uses a global config file at:

`~/.config/skill-mcp/config.json`

If the file does not exist yet, defaults from `src/core/config-merger.ts` are used.

## 3) Run the MCP Server (stdio)

```bash
node dist/index.js
```

The server communicates over stdio and is intended to be launched by an MCP client.

## 4) Configure Your MCP Client

Register `skill-mcp` as a stdio MCP server in your client config.

Example shape:

```json
{
  "mcpServers": {
    "skill-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/skill-mcp/dist/index.js"]
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

At startup and config reload, `skill-mcp` checks for project config in this order:

1. `.skill-mcp/config.json`
2. `.claude/skill-mcp/config.json`
3. `.agents/skill-mcp/config.json`

The first path found is loaded and merged over global config.

## 10) Persist Config Changes

- Use `update_config` for in-session updates (memory only).
- Use `save_config` to write config to disk and trigger reload.

## Next

- `docs/configuration.md` for full schema and merge semantics
- `docs/tools-reference.md` for per-tool parameters and responses
