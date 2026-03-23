# Claude Code Hooks for deft-mcp

Hard-enforcement hooks that gate MCP tool calls and audit skill lifecycle events.

## Scripts

| Script | Event | Purpose |
|--------|-------|---------|
| `pre-tool-use.sh` | `PreToolUse` | Blocks `install_skill` unless `search_skills` was called first; health check reminder |
| `post-tool-use.sh` | `PostToolUse` | Audit trail, scan failure alerts, config persistence reminders |

## Install

### Option A: Copy into your project

```bash
mkdir -p .claude/hooks/deft
cp hooks/claude-code/*.sh .claude/hooks/deft/
chmod +x .claude/hooks/deft/*.sh
```

Then register the hooks:

```bash
claude hooks add PreToolUse '.claude/hooks/deft/pre-tool-use.sh'
claude hooks add PostToolUse '.claude/hooks/deft/post-tool-use.sh'
```

### Option B: Reference directly (if deft-mcp is installed globally)

```bash
claude hooks add PreToolUse "$(npm root -g)/deft-mcp/hooks/claude-code/pre-tool-use.sh"
claude hooks add PostToolUse "$(npm root -g)/deft-mcp/hooks/claude-code/post-tool-use.sh"
```

## Environment Variables

Claude Code sets these automatically when hooks fire:

| Variable | Description |
|----------|-------------|
| `TOOL_NAME` | Name of the MCP tool (e.g., `install_skill`) |
| `TOOL_INPUT` | JSON string of tool arguments |
| `TOOL_OUTPUT` | JSON string of tool response (PostToolUse only) |
| `TOOL_ERROR` | Set if the tool returned an error (PostToolUse only) |

## Session State

Hooks use `$TMPDIR/deft-session-$$` for per-process session markers. This is cleaned up when the shell process exits.

## Behavior

### PreToolUse

- **First call**: If the first deft-mcp tool call is not `get_status`, prints a warning to stderr.
- **install_skill**: Blocked (exit 1) if `search_skills` has not been called in the current session.

### PostToolUse

- **Every call**: Appends to `audit.log` in the session directory.
- **Errors**: Prints specific alerts for `SCAN_FAILED`, `SKILL_QUARANTINED`, and `ACCESS_DENIED`.
- **install_skill success**: Prints a confirmation and suggests verifying with `get_skill`.
- **update_config success**: Reminds to call `save_config` for persistence.

## Uninstall

```bash
claude hooks remove PreToolUse '.claude/hooks/deft/pre-tool-use.sh'
claude hooks remove PostToolUse '.claude/hooks/deft/post-tool-use.sh'
rm -rf .claude/hooks/deft
```
