# Tools Reference

This reference describes the MCP tools exposed by `skill-mcp` (`src/adapters/driving/mcp-server.ts`).

All successful calls return a `content` array with a single text JSON payload.

## `search_skills`

Search skills by keyword.

### Input

```json
{
  "query": "tdd",
  "limit": 10,
  "sources": ["local", "catalog", "github"],
  "refresh": false
}
```

- `query` (required): non-empty string
- `limit` (optional): max results per source
- `sources` (optional): subset of `local`, `catalog`, `github`
- `refresh` (optional): if `true`, bypasses catalog freshness checks and fetches remotes

### Output

```json
{
  "local": [
    {
      "name": "tdd-python",
      "description": "...",
      "trustLevel": "community",
      "score": 1,
      "installed": true,
      "frecency": 0.7
    }
  ],
  "catalogs": {
    "catalog.test-skills.json": [
      {
        "name": "catalog-python-skill",
        "description": "...",
        "catalogName": "team-catalog",
        "score": 2,
        "source": { "type": "url", "url": "https://catalog.test/python" }
      }
    ]
  },
  "github": [
    {
      "name": "owner/python-skill",
      "description": "...",
      "tags": ["mcp-skill"],
      "score": 10,
      "installable": true,
      "source": { "type": "github", "repo": "owner/python-skill" }
    }
  ],
  "offline": false
}
```

Backward compatibility:

- If no catalog/github sources are configured, `search_skills` still returns the grouped shape with:
  - `local`: local results
  - `catalogs`: `{}`
  - `github`: `[]`

## `get_skill`

Return full skill content.

### Input

```json
{
  "name": "tdd-python"
}
```

### Behavior

- If quarantined, returns `SKILL_QUARANTINED`.
- If scanning, returns a stale/scanning payload when a prior version is available.
- Includes trust indicator + trust level (for example `"◇ community"`).

### Output (normal)

```json
{
  "name": "tdd-python",
  "description": "...",
  "trust": "◇ community",
  "content": "...",
  "resources": [],
  "stale": false
}
```

### Output (scanning)

```json
{
  "name": "tdd-python",
  "description": "...",
  "trust": "◇ community",
  "content": "...",
  "resources": [],
  "stale": true,
  "scanning": true
}
```

## `get_resource`

Return a resource file under an installed skill.

### Input

```json
{
  "skill": "tdd-python",
  "path": "templates/example.md"
}
```

### Output

```json
{
  "skill": "tdd-python",
  "path": "templates/example.md",
  "content": "..."
}
```

## `list_categories`

Return indexed categories based on skill metadata tags.

### Input

```json
{}
```

### Output

```json
{
  "categories": ["git", "python", "testing"],
  "count": 3
}
```

## `install_skill`

Resolve and install a skill.

### Input

```json
{
  "skill": "tdd-python",
  "target_dir": "optional",
  "platform": "optional",
  "source": "optional"
}
```

### Behavior

1. reject if already installed (`ALREADY_INSTALLED`)
2. enforce access control
3. resolve skill
4. validate metadata
5. scan before install (`SCAN_FAILED` on findings)
6. write skill + lifecycle + lock update

### Output

```json
{
  "installed": "tdd-python",
  "path": "tdd-python",
  "platform": "generic",
  "registration": "Skill 'tdd-python' installed successfully."
}
```

## `save_skill`

Validate, scan, and save a new local skill.

### Input

```json
{
  "name": "my-custom-skill",
  "content": "---\nname: my-custom-skill\ndescription: custom\n---\n# Content",
  "description": "custom"
}
```

### Behavior

1. validate required fields
2. validate metadata format
3. reject duplicates (`ALREADY_EXISTS`)
4. scan before save (`SCAN_FAILED`)
5. write skill + lifecycle + lock update

### Output

```json
{
  "saved": "my-custom-skill",
  "hash": "abcd1234",
  "message": "Skill 'my-custom-skill' saved successfully."
}
```

## `remove_skill`

Remove an installed skill.

### Input

```json
{
  "name": "my-custom-skill"
}
```

### Behavior

- validates `name`
- requires skill to exist
- deletes from store, lock, and lifecycle

### Output

```json
{
  "removed": "my-custom-skill",
  "message": "Skill 'my-custom-skill' has been removed successfully."
}
```

### `SKILL_LOCKED` note

`SKILL_LOCKED` exists in the error catalog for lock-enforcement mode, but current `remove_skill` behavior does not enforce it yet.

## `update_config`

Update in-memory session config only.

### Input

```json
{
  "key": "logging.level",
  "value": "debug"
}
```

### Output

```json
{
  "updated": "logging.level",
  "value": "debug",
  "persisted": false,
  "message": "Config key 'logging.level' updated in session. Use save_config to persist."
}
```

## `save_config`

Persist current config and trigger hot reload.

### Input

```json
{}
```

### Output

```json
{
  "saved": true,
  "path": "~/.config/skill-mcp/config.json",
  "message": "Config saved and reloaded from '...'."
}
```

## `get_status`

Return lifecycle and system status.

### Input

```json
{}
```

### Output

```json
{
  "summary": {
    "installed": 0,
    "active": 0,
    "scanning": 0,
    "quarantined": 0,
    "forced": 0,
    "locked": 0
  },
  "skills": {},
  "lock": {
    "lockedSkills": []
  },
  "circuitBreakers": {},
  "accessControl": {
    "mode": "blocklist"
  },
  "network": "available"
}
```

## `push_skills`

Push local skills to configured remote.

### Input

```json
{}
```

### Current behavior

- If offline: returns `NETWORK_UNAVAILABLE`.
- Otherwise: currently returns `NETWORK_UNAVAILABLE` with `"push is not yet implemented"`.

## Error Codes

Common error codes returned by tools:

- `SKILL_NOT_FOUND`
- `RESOURCE_NOT_FOUND`
- `SCAN_FAILED`
- `SKILL_QUARANTINED`
- `NETWORK_UNAVAILABLE`
- `VALIDATION_FAILED`
- `ACCESS_DENIED`
- `ALREADY_INSTALLED`
- `SKILL_LOCKED`
- `CONFIG_LOCKED`
- `RATE_LIMITED`
- `OPERATION_TIMEOUT`
- `INVALID_QUERY`
- `ALREADY_EXISTS`
- `INTERNAL_ERROR`

See `src/core/errors.ts` for full details and payload shape.
