# Client Setup Guide

This guide shows how to configure `deft-mcp` for each supported MCP client. The server payload is the same everywhere — what differs is **where** you place it and minor format variations.

> **Tip:** Badges for VS Code, VS Code Insiders, Cursor, and Visual Studio are **one-click install** links that open the client and configure the MCP server automatically. Other badges link to their respective sections below.

## Universal Server Config

All clients use the same server definition. Choose one:

### Via npx (recommended)

```json
{
  "command": "npx",
  "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
}
```

### Via local install

```json
{
  "command": "deft-mcp"
}
```

> **Tip:** Pin a version for stability: `"args": ["-y", "github:kvithayathil/deft-suite#v1.0.0-beta.5", "deft-mcp"]`

### Version Pinning

Appending `#<tag>` to the GitHub specifier locks `npx` to a specific release:

```
github:kvithayathil/deft-suite#v1.0.0-beta.5
```

**Why pin?**
- Reproducible behavior across machines and CI
- Protection against breaking changes in new releases
- Deterministic builds for team environments

**How to check available versions:**

```bash
git ls-remote --tags https://github.com/kvithayathil/deft-suite.git
```

**Trade-offs vs unpinned (`@latest`):**
- **Pinned** — stable, predictable; requires manual updates to pick up fixes
- **Unpinned** — always gets the latest; may introduce unexpected changes

For production and shared team configs, pinning is recommended. For personal experimentation, unpinned is fine.

---

## Claude Desktop

![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-MCP-191919?style=for-the-badge&logo=anthropic&logoColor=white)

**Config file (macOS):**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Config file (Windows):**

```
%APPDATA%\Claude\claude_desktop_config.json
```

**Config file (Linux):**

```
~/.config/Claude/claude_desktop_config.json
```

Add `deft-mcp` under the `mcpServers` key:

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

Restart Claude Desktop after saving.

---

## Claude Code (CLI)

![Claude Code](https://img.shields.io/badge/Claude_Code-MCP-191919?style=for-the-badge&logo=anthropic&logoColor=white)

The simplest approach is the `claude mcp add` command:

```bash
claude mcp add deft-mcp -- npx -y github:kvithayathil/deft-suite deft-mcp
```

This writes the config to `~/.claude.json` automatically.

To scope it to a project instead:

```bash
claude mcp add --scope project deft-mcp -- npx -y github:kvithayathil/deft-suite deft-mcp
```

Alternatively, edit `~/.claude.json` directly:

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

---

## Windsurf

![Windsurf](https://img.shields.io/badge/Windsurf-MCP-09B6A2?style=for-the-badge&logo=codeium&logoColor=white)

**Config file:**

```
~/.codeium/windsurf/mcp_config.json
```

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

Restart Windsurf or reload the window after saving.

---

## Cursor

[![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=deft-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1Yjprdml0aGF5YXRoaWwvZGVmdC1zdWl0ZSIsImRlZnQtbWNwIl19)

Click the badge above to install automatically, or configure manually below.

Cursor supports both project-level and global MCP configs.

### Project-level (recommended for teams)

Create `.cursor/mcp.json` in your project root:

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

### Global

Create `~/.cursor/mcp.json`:

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

Alternatively, add via **Settings → Features → MCP Servers → Add Server**.

---

## VS Code (GitHub Copilot)

[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=deft-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/Install_in-VS_Code_Insiders-24bfa5?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=deft-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D&quality=insiders)

Click a badge above to install automatically, or configure manually below.

VS Code supports MCP servers through GitHub Copilot Chat (requires Copilot extension).

### Project-level (recommended for teams)

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "deft-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
    }
  }
}
```

### User settings

Add to your `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "deft-mcp": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
      }
    }
  }
}
```

> **Note:** VS Code uses `"servers"` (not `"mcpServers"`) and requires a `"type": "stdio"` field.

---

## OpenCode

![OpenCode](https://img.shields.io/badge/OpenCode-MCP-333333?style=for-the-badge)

OpenCode uses a different format from the standard `mcpServers` convention — it requires a `"mcp"` top-level key, a `"type": "local"` field, and a combined `command` array (not separate `command` + `args`).

### Config file locations

OpenCode supports config in two locations:

- **Global:** `~/.config/opencode/config.json`
- **Project-level:** `opencode.jsonc` in your project root

### Configuration

```json
{
  "mcp": {
    "deft-mcp": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "-y", "github:kvithayathil/deft-suite", "deft-mcp"],
      "timeout": 30000
    }
  }
}
```

> **Note:** The first `npx` run compiles native dependencies (`better-sqlite3`) and can take 30–60 seconds. A `timeout` of `30000` (30 s) or higher is recommended to prevent premature timeouts.

### Pin a version

```json
{
  "mcp": {
    "deft-mcp": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "-y", "github:kvithayathil/deft-suite#v1.0.0-beta.5", "deft-mcp"],
      "timeout": 30000
    }
  }
}
```

### Key differences from other clients

| Aspect | Standard (`mcpServers`) | OpenCode (`mcp`) |
|--------|------------------------|-------------------|
| Top-level key | `"mcpServers"` | `"mcp"` |
| Command format | `"command"` + `"args"` | Combined `"command"` array |
| Extra fields | — | `"type": "local"`, `"enabled": true` |

---

## Zed

![Zed](https://img.shields.io/badge/Zed-MCP-084CCF?style=for-the-badge&logo=zedindustries&logoColor=white)

Zed uses a different format (`context_servers` instead of `mcpServers`).

**Config file:**

```
~/.zed/settings.json
```

Add under the `context_servers` key:

```json
{
  "context_servers": {
    "deft-mcp": {
      "command": {
        "path": "npx",
        "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
      },
      "settings": {}
    }
  }
}
```

> **Note:** Zed wraps the command in a `"command"` object with `"path"` instead of `"command"`.

---

## JetBrains IDEs (IntelliJ, WebStorm, PyCharm, etc.)

![JetBrains](https://img.shields.io/badge/JetBrains-MCP-000000?style=for-the-badge&logo=jetbrains&logoColor=white)

JetBrains IDEs support MCP via the AI Assistant plugin (2025.1+).

### Via Settings UI

1. Open **Settings → Tools → AI Assistant → MCP Servers**
2. Click **+ Add**
3. Set **Name** to `deft-mcp`
4. Set **Command** to `npx`
5. Set **Arguments** to `-y github:kvithayathil/deft-suite deft-mcp`
6. Click **OK**

### Via project config

Create `.mcp.json` in your project root:

```json
{
  "servers": {
    "deft-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
    }
  }
}
```

---

## Visual Studio

[![Install in Visual Studio](https://img.shields.io/badge/Install_in-Visual_Studio-C16FDE?style=for-the-badge&logo=visualstudio&logoColor=white)](https://vs-open.link/mcp-install?%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3Akvithayathil%2Fdeft-suite%22%2C%22deft-mcp%22%5D%7D)

Click the badge above to install automatically. Visual Studio 2022 17.14+ supports MCP servers via the AI Assistant.

---

## Codex (OpenAI CLI)

![Codex](https://img.shields.io/badge/Codex-MCP-412991?style=for-the-badge&logo=openai&logoColor=white)

Codex uses CLI flags or environment-based config to register MCP servers:

```bash
codex --mcp-config mcp.json
```

Where `mcp.json` contains:

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

---

## Troubleshooting

### Server not starting

- Ensure Node.js ≥ 20 is installed and on your `PATH`
- First `npx` run compiles native dependencies (`better-sqlite3`) — this can take 30–60 seconds. Set a `timeout` of at least `30000` (30 s) in your client config to avoid premature timeouts
- Check client logs for stderr output from the server process

### Tools not appearing

- Some clients require a window reload or restart after config changes
- Verify the config JSON is valid (no trailing commas, correct nesting)
- Check that the `deft-mcp` binary name matches exactly

### PATH issues with npx

If your client cannot find `npx`, use the full path:

```json
{
  "command": "/usr/local/bin/npx",
  "args": ["-y", "github:kvithayathil/deft-suite", "deft-mcp"]
}
```

Find your npx path with `which npx` (macOS/Linux) or `where npx` (Windows).

---

## Platform Directories

Deft automatically detects your platform and places project-level skill configs in the appropriate directory. See the `platformDirectories` config key in [Configuration](configuration.md):

```json
{
  "platformDirectories": {
    "claude-code": ".claude/deft",
    "windsurf": ".windsurf/deft",
    "cursor": ".cursor/deft",
    "opencode": ".opencode/deft",
    "zed": ".zed/deft",
    "copilot": ".copilot/deft",
    "default": ".agents/deft"
  }
}
```
