---
name: core-cli-tools
description: Core CLI tool patterns for building on top of skill-mcp
---

# Core CLI Tools

Build CLI tools that integrate with the skill-mcp infrastructure using standard patterns and APIs.

## Core Tool Types

- **Meta-tools**: `search_skills`, `get_skill` — discover and inspect skills
- **Installation tools**: `install_skill`, `uninstall_skill` — manage installations
- **Config tools**: `get_config`, `set_config` — manage settings
- **Status tools**: `get_status`, `scan_skills` — monitor and diagnose
- **Sync tools**: `sync_skills` — reconcile state with lock file

## Tool Context Pattern

All tools receive a ToolContext containing:
- Server instance reference
- Current configuration
- Logger for structured output
- Access to skill store and config store

## Error Handling

All tools return structured errors:

```json
{
  "category": "INVALID_ARGUMENT|NOT_FOUND|PERMISSION_DENIED",
  "code": "SKILL_NOT_FOUND",
  "message": "Human-readable error description",
  "recoverable": true,
  "retry": false
}
```

## Handler Pattern

Implement tool handlers as functions:

```typescript
async function handleTool(context: ToolContext, args: Record<string, unknown>) {
  // Validate inputs
  // Call service methods
  // Return structured result or error
}
```

## Rate Limiting

- Remote skill queries use token bucket rate limiting
- Local operations are unlimited
- Configure limits in config.rateLimiting
- Catch RATE_LIMITED errors and retry with backoff

## Timeout Strategy

Use tiered timeouts:
- Fast operations (config): 100ms
- Network operations: 5s
- Security scans: 30s
