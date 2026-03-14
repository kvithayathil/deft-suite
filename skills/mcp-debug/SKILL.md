---
name: mcp-debug
description: How to diagnose and debug MCP issues including status checks and lock mismatches
---

# MCP Debug

Use this skill to diagnose and resolve MCP server issues, configuration problems, and skill conflicts.

## Diagnostic Tools

- `get_status`: Check server health, worker states, and error metrics
- `scan_skills`: Run security scanners and identify configuration issues
- `check_config`: Validate configuration syntax and trust settings
- `view_logs`: Inspect server logs for error messages and warnings

## Common Issues

**Lock mismatch**: skill-lock.json disagrees with installed skills
- Solution: Run `sync_skills` to reconcile, or delete lock file to force rescan

**Offline mode**: Network-dependent tools fail gracefully
- Expected behavior — check local fallbacks first
- Verify NETWORK_UNAVAILABLE errors are recoverable

**Worker heartbeat**: Background workers not responding
- Check memory usage and process load
- Inspect console logs for stack traces

**Trust level blocked**: Skill installation rejected by policy
- Review allowlist/blocklist in config
- Verify skill source is in trusted registry

## Debugging Workflow

1. Run `get_status` to identify unhealthy components
2. Check scan findings for security or validation errors
3. Review configuration with `check_config`
4. Inspect logs for error codes and patterns
5. Try incremental recovery: restart, rescan, or reset state
