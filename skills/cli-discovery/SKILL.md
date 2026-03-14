---
name: cli-discovery
description: How to discover and use the CLI commands for skill management
---

# CLI Discovery

Learn the command-line interface for discovering, installing, and managing skills.

## Essential Commands

- `skill search <query>`: Search for skills by keywords or tags
- `skill info <name>`: Get detailed information about a specific skill
- `skill install <name>`: Install a skill with verification
- `skill list`: Show all installed skills
- `skill uninstall <name>`: Remove a skill safely
- `skill status`: Check MCP server health and background worker states
- `skill config`: View and edit configuration
- `skill scan`: Run security scanners on installed skills

## Search Patterns

- Search by skill name: `skill search mcp-guide`
- Search by description: `skill search "debugging"`
- Filter by trust level: `skill search --trust verified`
- Show detailed results: `skill search --verbose`

## Installation Flow

```
$ skill search workflow
$ skill info git-workflows        # Review details
$ skill install git-workflows    # Install with verification
$ skill status                    # Confirm installation
```

## Configuration Commands

- `skill config show`: Display current configuration
- `skill config set <key> <value>`: Update a setting
- `skill config import <file>`: Import config from backup
- `skill config export <file>`: Export current configuration

## Troubleshooting

- Use `skill scan` to identify issues
- Check `skill status` for worker health
- View logs with `skill logs [--follow]`
