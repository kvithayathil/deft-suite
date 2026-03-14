---
name: mcp-guide
description: How to discover, use, install, and manage skills via the MCP
---

# MCP Guide

The Model Context Protocol (MCP) is the standard for distributing agent skills and tools. Use this skill to understand how to discover, install, and manage skills.

## Key Concepts

- **Skills**: Reusable capabilities providing tools, prompts, and resources to agents
- **Discovery**: Find skills using `search_skills` or `get_skill` tools
- **Installation**: Add skills to your agent with `install_skill` with trust level verification
- **Management**: Update, remove, and manage skills via the skill registry

## Common Tasks

- List available skills: Use `search_skills` with keywords
- Get skill details: Use `get_skill` to fetch a specific skill's metadata
- Install a skill: Use `install_skill` after verifying the trust level
- Check skill status: Use `get_status` to monitor health and activity
- Remove a skill: Use the uninstall command when no longer needed

## Best Practices

- Always verify trust levels before installing skills
- Keep skills updated to get security fixes
- Review permissions requested by skills before installation
- Use allowlist/blocklist to control which sources you trust
