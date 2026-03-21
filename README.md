# skill-mcp

`skill-mcp` is a Model Context Protocol (MCP) server for discovering, validating, installing, and managing reusable agent skills.

It focuses on:
- secure skill install/save flows (validation + scanning)
- trust-aware skill lifecycle and lock tracking
- compact manifest injection at MCP initialize time
- project-aware config overlays

## Prerequisites

- Node.js `>=20.0.0`
- npm

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

You can also build and run the CLI entrypoint:

```bash
node dist/cli.js --help
```

## MCP Client Setup

Add a stdio server entry in your MCP client config that points to `node` + `dist/index.js`.

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

Use your client’s specific config file location (for example Claude Desktop, Windsurf, VS Code MCP-compatible clients).

## Quick Start

1. Start the server.
2. Call `get_status` to confirm health.
3. Call `search_skills` and `install_skill` to install a skill.
4. Call `get_skill` to inspect installed content.
5. Call `save_skill` to add your own skill.

## Available Tools

- `search_skills`: Search by keyword.
- `get_skill`: Return full skill content and trust indicator.
- `get_resource`: Return a skill resource file.
- `list_categories`: Return indexed skill categories.
- `install_skill`: Resolve, validate, scan, and install a skill.
- `remove_skill`: Remove an installed skill.
- `save_skill`: Validate, scan, and save a new skill.
- `push_skills`: Push skills to remote (currently placeholder; returns unavailable).
- `update_config`: Update session config in memory.
- `save_config`: Persist config and trigger reload.
- `get_status`: Return summary, lifecycle, lock, network, and circuit breaker state.

## Documentation

- `docs/getting-started.md`
- `docs/configuration.md`
- `docs/tools-reference.md`

## Contributing

Contributions are welcome. Add tests for behavioral changes and keep docs aligned with implementation.

## License

MIT
