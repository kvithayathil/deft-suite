#!/usr/bin/env bash
# deft-mcp PostToolUse hook for Claude Code
# Enforces: install audit trail, scan failure alerts, config persistence reminders
#
# Install:
#   claude hooks add PostToolUse '.claude/hooks/deft/post-tool-use.sh'
#
# Environment (set by Claude Code):
#   TOOL_NAME   — name of the MCP tool that was called
#   TOOL_INPUT  — JSON string of the tool arguments
#   TOOL_OUTPUT — JSON string of the tool response
#   TOOL_ERROR  — set if the tool returned an error
#
# Exit code is informational only (does not block).

set -euo pipefail

DEFT_SESSION_DIR="${TMPDIR:-/tmp}/deft-session-$$"
DEFT_AUDIT_LOG="${DEFT_SESSION_DIR}/audit.log"
mkdir -p "$DEFT_SESSION_DIR"

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-{}}"
TOOL_OUTPUT="${TOOL_OUTPUT:-{}}"
TOOL_ERROR="${TOOL_ERROR:-}"

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

# Only act on deft-mcp tools
case "$TOOL_NAME" in
  search_skills|get_skill|install_skill|remove_skill|save_skill|get_resource|list_categories|push_skills|update_config|save_config|get_status)
    ;;
  *)
    exit 0
    ;;
esac

# Audit trail: log every deft-mcp tool call
echo "$(timestamp) $TOOL_NAME ${TOOL_ERROR:+ERROR}" >> "$DEFT_AUDIT_LOG"

# Invariant 4: Scan failure alerting
if [ -n "$TOOL_ERROR" ]; then
  case "$TOOL_OUTPUT" in
    *SCAN_FAILED*)
      echo "🔴 deft-mcp: Security scan failed. Review the findings before retrying." >&2
      ;;
    *SKILL_QUARANTINED*)
      echo "🔴 deft-mcp: Skill is quarantined. Do not attempt to use its content." >&2
      ;;
    *ACCESS_DENIED*)
      echo "🟡 deft-mcp: Access denied by allowlist/blocklist policy." >&2
      ;;
  esac
fi

# Invariant 5: Post-install confirmation
if [ "$TOOL_NAME" = "install_skill" ] && [ -z "$TOOL_ERROR" ]; then
  echo "✅ deft-mcp: Skill installed. Verify with get_skill and check trust level." >&2
fi

# Invariant 6: Config persistence reminder
if [ "$TOOL_NAME" = "update_config" ] && [ -z "$TOOL_ERROR" ]; then
  echo "💾 deft-mcp: Config updated in session only. Call save_config to persist." >&2
fi

exit 0
