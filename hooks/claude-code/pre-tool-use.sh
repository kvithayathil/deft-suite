#!/usr/bin/env bash
# deft-mcp PreToolUse hook for Claude Code
# Enforces: search-before-install, health check reminder, trust gate
#
# Install:
#   claude hooks add PreToolUse '.claude/hooks/deft/pre-tool-use.sh'
#
# Environment (set by Claude Code):
#   TOOL_NAME   — name of the MCP tool being called
#   TOOL_INPUT  — JSON string of the tool arguments
#
# Exit 0 to allow, non-zero to block.

set -euo pipefail

DEFT_SESSION_DIR="${TMPDIR:-/tmp}/deft-session-$$"
mkdir -p "$DEFT_SESSION_DIR"

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-{}}"

# Track which deft tools have been called this session
mark_called() {
  touch "$DEFT_SESSION_DIR/$1"
}

was_called() {
  [ -f "$DEFT_SESSION_DIR/$1" ]
}

# Only act on deft-mcp tools
case "$TOOL_NAME" in
  search_skills|get_skill|install_skill|remove_skill|save_skill|get_resource|list_categories|push_skills|update_config|save_config|get_status)
    ;;
  *)
    exit 0
    ;;
esac

# Invariant 1: Health check reminder on first deft-mcp tool call
if ! was_called "_any_deft_tool" && [ "$TOOL_NAME" != "get_status" ]; then
  echo "⚠️  deft-mcp: Consider calling get_status first to verify server health." >&2
fi
mark_called "_any_deft_tool"

# Invariant 2: Search before install
if [ "$TOOL_NAME" = "install_skill" ]; then
  if ! was_called "search_skills"; then
    echo "🚫 deft-mcp: install_skill blocked — call search_skills first to verify the skill exists and review trust levels." >&2
    exit 1
  fi
fi

# Track this tool call
mark_called "$TOOL_NAME"

exit 0
