# Agent Hooks Integration Guide

This guide describes how to integrate agent hooks with `deft-mcp` to enforce consistent skill lifecycle usage across AI coding agents.

## Why Hooks?

Without hooks, agents may:
- Install skills blindly without searching first
- Skip trust verification before installation
- Forget to check server health at session start
- Miss scan failures or quarantined skills
- Use `update_config` without persisting changes

Hooks enforce these invariants automatically.

## Invariants

| # | Invariant | Enforcement Level |
|---|-----------|-------------------|
| 1 | Health check on first MCP interaction | Soft (instructions) or Hard (hook script) |
| 2 | Search before install | Hard (PreToolUse gate) |
| 3 | Trust level verification before install | Hard (PreToolUse gate) |
| 4 | Post-install confirmation + frecency tracking | Soft (PostToolUse) |
| 5 | Scan failure alerting | Soft (PostToolUse) |
| 6 | Config persistence reminder | Soft (instructions) |

## Platform Support Matrix

| Platform | Mechanism | Enforcement | Setup |
|----------|-----------|-------------|-------|
| Claude Code | Shell hooks (`PreToolUse`/`PostToolUse`) | **Hard** — can block tool calls | [Claude Code setup](#claude-code) |
| Windsurf | Workflows (`.windsurf/workflows/`) | **Soft** — user invokes slash command | [Windsurf setup](#windsurf) |
| Cursor | Rules (`.cursor/rules`) | **Soft** — system prompt injection | [Cursor setup](#cursor) |
| GitHub Copilot | Instructions (`.github/copilot-instructions.md`) | **Soft** — advisory | [Copilot setup](#github-copilot) |
| Zed / JetBrains | MCP tool descriptions only | **None** — no hook API | Use bundled `agent-hooks` skill |

## Claude Code

Claude Code has the richest hook system. Hooks are shell scripts that execute on lifecycle events.

### Hook Events

- **`PreToolUse`** — runs before any MCP tool call; exit non-zero to block
- **`PostToolUse`** — runs after a tool returns; can log or alert
- **`PreMessage`** — runs before Claude processes a user message
- **`PostMessage`** — runs after Claude sends a response

### Setup

Copy the hook scripts from `hooks/claude-code/` into your project:

```bash
# From a project that has deft-mcp installed
cp -r node_modules/deft-mcp/hooks/claude-code/ .claude/hooks/deft/
```

Or add hooks manually via the Claude Code CLI:

```bash
claude hooks add PreToolUse '.claude/hooks/deft/pre-tool-use.sh'
claude hooks add PostToolUse '.claude/hooks/deft/post-tool-use.sh'
```

### Pre-install gate (PreToolUse)

The `pre-tool-use.sh` script enforces:

1. **Search-before-install**: When `install_skill` is called, checks that `search_skills` was called earlier in the session (via a session marker file).
2. **Trust acknowledgment**: Warns the agent if the skill's trust level is below the configured minimum.
3. **Health check reminder**: On the first deft-mcp tool call in a session, reminds the agent to call `get_status`.

### Post-install logger (PostToolUse)

The `post-tool-use.sh` script:

1. Logs successful installs and saves to a session audit trail.
2. Alerts on `SCAN_FAILED` or `SKILL_QUARANTINED` errors.
3. Reminds agents to persist config changes after `update_config`.

### Shipped Scripts

```
hooks/claude-code/
├── pre-tool-use.sh      # PreToolUse gate script
├── post-tool-use.sh     # PostToolUse logger/alerter
└── README.md            # Claude Code-specific setup instructions
```

## Windsurf

Windsurf supports workflows — step-by-step sequences invoked via slash commands.

### Recommended Workflows

Add to `.windsurf/workflows/`:

**`/deft-install`** — enforces search → verify → install → confirm:

```markdown
---
description: Install a skill via deft-mcp with safety checks
---

1. Call `get_status` via deft-mcp to confirm the server is healthy.
2. Call `search_skills` with the skill name to verify it exists and check available sources.
3. Review the trust level in search results. If community or unknown, confirm with the user before proceeding.
4. Call `install_skill` with the chosen skill name.
5. Verify the install succeeded by calling `get_skill` on the installed skill.
```

**`/deft-status`** — quick health check:

```markdown
---
description: Check deft-mcp server health and skill status
---

1. Call `get_status` via deft-mcp.
2. Summarize: installed count, quarantined count, circuit breaker state, network status.
3. If any skills are quarantined or circuit breakers are open, alert the user.
```

## Cursor

Cursor uses `.cursor/rules` files for system prompt injection.

### Setup

Create `.cursor/rules/deft-mcp.md`:

```markdown
# deft-mcp Usage Rules

When using the deft-mcp MCP server tools, always follow this protocol:

1. **Health first**: Call `get_status` at the start of any session that uses deft-mcp tools.
2. **Search before install**: Always call `search_skills` before `install_skill` to verify the skill exists and review trust levels.
3. **Trust verification**: Do not install skills with trust level "unknown" (✖) without explicit user confirmation. Prefer "bundled" (◆) and "verified" (●) skills.
4. **Scan failures**: If `install_skill` or `save_skill` returns `SCAN_FAILED`, do not retry — report the findings to the user.
5. **Config persistence**: After calling `update_config`, remind the user to call `save_config` if they want changes to persist.
6. **Quarantined skills**: If `get_skill` returns `SKILL_QUARANTINED`, do not attempt to read the content — inform the user.
7. **Offline mode**: If tools return `NETWORK_UNAVAILABLE`, switch to local-only sources gracefully.
```

## GitHub Copilot

### Setup

Add to `.github/copilot-instructions.md`:

```markdown
## deft-mcp MCP Server

When using deft-mcp tools:
- Always call `get_status` first to confirm server health.
- Call `search_skills` before `install_skill` to verify trust levels.
- Never install "unknown" trust skills without user confirmation.
- Report `SCAN_FAILED` findings to the user instead of retrying.
- After `update_config`, suggest `save_config` for persistence.
```

## Universal Approach: Bundled Skill

For agents without a native hook system, the bundled `agent-hooks` skill provides the same invariants as prose instructions. Any agent connected to deft-mcp can call:

```json
{ "name": "agent-hooks" }
```

via `get_skill` to receive platform-specific setup guidance and usage invariants.

## Verification

After setting up hooks, verify they work:

1. Start a new agent session.
2. Try calling `install_skill` without calling `search_skills` first.
   - **Claude Code**: Should be blocked by `pre-tool-use.sh`.
   - **Other agents**: Should self-correct based on rules/instructions.
3. Call `get_status` and confirm the health response.
4. Install a skill and verify the post-install audit trail (Claude Code) or confirmation step (workflows).
