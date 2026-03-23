---
name: agent-hooks
description: Platform-specific hook setup to enforce consistent deft-mcp usage patterns
---

# Agent Hooks

Enforce consistent skill lifecycle usage across AI coding agents. This skill provides invariants and platform-specific setup for gating tool calls, verifying trust, and auditing installs.

## Invariants

Every agent using deft-mcp should follow these rules:

1. **Health first** — call `get_status` at the start of any session using deft-mcp tools
2. **Search before install** — always call `search_skills` before `install_skill`
3. **Trust gate** — do not install skills with trust level "unknown" (✖) without explicit user confirmation; prefer "bundled" (◆) and "verified" (●)
4. **Scan failure stop** — if `install_skill` or `save_skill` returns `SCAN_FAILED`, report findings to the user instead of retrying
5. **Quarantine respect** — if `get_skill` returns `SKILL_QUARANTINED`, do not attempt to read content
6. **Config persistence** — after `update_config`, remind the user to call `save_config`
7. **Offline grace** — if tools return `NETWORK_UNAVAILABLE`, switch to local-only sources

## Platform Setup

### Claude Code (Hard enforcement)

Shell hooks gate tool calls. Copy from `hooks/claude-code/` or add manually:

```bash
claude hooks add PreToolUse '.claude/hooks/deft/pre-tool-use.sh'
claude hooks add PostToolUse '.claude/hooks/deft/post-tool-use.sh'
```

`PreToolUse` blocks `install_skill` if `search_skills` was not called first in the session. `PostToolUse` logs installs and alerts on scan failures.

### Windsurf (Workflow enforcement)

Create `.windsurf/workflows/deft-install.md`:

```markdown
---
description: Install a skill via deft-mcp with safety checks
---
1. Call `get_status` to confirm server health.
2. Call `search_skills` with the skill name.
3. Review trust level — confirm with user if community or unknown.
4. Call `install_skill`.
5. Verify with `get_skill`.
```

### Cursor (Rule enforcement)

Create `.cursor/rules/deft-mcp.md` with the invariants listed above as rules the agent must follow.

### GitHub Copilot (Advisory)

Add invariants to `.github/copilot-instructions.md` under a `## deft-mcp` section.

### Other Agents

Read and follow the invariants above. No native hook API — enforcement is advisory.

## Recommended Workflow

```
get_status → search_skills → [review trust] → install_skill → get_skill (verify)
```

For saving custom skills:

```
[write content] → save_skill → get_skill (verify) → get_status (confirm lifecycle)
```
