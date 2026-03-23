# Configuration Reference

`deft` merges configuration from three layers:

1. built-in defaults
2. global config (`~/.config/deft/config.json`)
3. project config (first discovered path)

## Global Config

Path:

`~/.config/deft/config.json`

Loaded by `FileConfigStore` during bootstrap.

## Project Config Discovery

By default, project config is discovered in this order:

1. `.deft/config.json`
2. `.claude/deft/config.json`
3. `.agents/deft/config.json`

The first match wins.

You can override discovery directories via `projectConfigPaths`.

## Merge Behavior

Implemented in `mergeConfigs(global, project)`.

- Env overrides are applied first.
- Global config merges over defaults.
- Project config merges over global.
- Top-level arrays:
  - `sources` and `projectConfigPaths` concatenate by default.
  - Use `"<key>:replace": true` to replace instead of concatenate.
- Global access-control precedence is enforced:
  - `blocklist`: global blocked entries are retained.
  - `allowlist`: merged allowed entries are filtered to global allowed keys.

## Environment Variable Overrides

Currently supported:

- `DEFT_LOG_LEVEL` → `logging.level`
- `DEFT_MIN_TRUST` → `security.minTrustLevel`

## Unified Search Configuration

### `registries`

Controls team/community catalog sources used by `search_skills`.

```json
{
  "registries": {
    "cacheMinutes": 60,
    "sources": [
      { "type": "static", "url": "https://example.com/skill-catalog.json" },
      { "type": "git", "url": "https://github.com/acme/skill-catalog.git" }
    ]
  }
}
```

- `cacheMinutes`: freshness window before a source is considered stale.
- `sources`: ordered list of remote catalogs; each source is queried independently.
- Cache behavior in `search_skills`:
  - `refresh: false` (default): uses cached catalog when fresh.
  - stale cache or cache miss: fetches remote catalog.
  - remote failure: falls back to cached catalog when available and sets `offline: true`.

### `github`

Controls opt-in GitHub discovery in `search_skills`.

```json
{
  "github": {
    "search": false,
    "topics": ["mcp-skill"]
  }
}
```

- `search: true` enables GitHub Search API calls.
- `topics` narrows results using topic/tag filters.

Privacy note:
- when enabled, user search queries are sent to GitHub.
- auth chain is opportunistic (`gh auth token` → `GITHUB_TOKEN` → unauthenticated).
- keep `search: false` if your environment disallows outbound query sharing.

### `usage`

Controls local usage/frecency tracking.

```json
{
  "usage": {
    "pruneThreshold": 10000,
    "sessionCap": 3,
    "ceilingPercent": 20,
    "dbPath": ""
  }
}
```

- Data is stored in a local SQLite file (`<configDir>/usage.db` by default).
- Used by `search_skills` to blend keyword relevance with frecency for local ranking.
- Used by CLI usage commands (`usage export`, `usage reset`, `stats`).

## Full Config Shape

```json
{
  "schemaVersion": 1,
  "manifest": {
    "skills": [
      "mcp-guide",
      "skill-writer",
      "security-baseline",
      "mcp-debug",
      "git-workflows",
      "cli-discovery",
      "core-cli-tools",
      "agent-hooks"
    ],
    "maxManifestSize": 10,
    "warnThreshold": 8
  },
  "sources": [],
  "sync": {
    "intervalMinutes": 60,
    "autoUpdate": true
  },
  "security": {
    "minTrustLevel": "community",
    "scanOnInstall": true,
    "periodicScanIntervalHours": 24,
    "accessControl": {
      "mode": "blocklist",
      "blocked": [],
      "allowed": []
    }
  },
  "platformDirectories": {
    "claude-code": ".claude/deft",
    "windsurf": ".windsurf/deft",
    "cursor": ".cursor/deft",
    "opencode": ".opencode/deft",
    "zed": ".zed/deft",
    "copilot": ".copilot/deft",
    "default": ".agents/deft"
  },
  "projectConfigPaths": [
    ".deft",
    ".claude/deft",
    ".agents/deft"
  ],
  "push": {
    "remote": "origin",
    "branch": "main",
    "autoCommit": false
  },
  "logging": {
    "level": "error",
    "file": "~/.cache/deft/logs/deft.log",
    "maxFileSize": "10MB",
    "maxFiles": 3,
    "structured": false
  },
  "telemetry": {
    "enabled": false,
    "exporterEndpoint": null,
    "exporterProtocol": "grpc",
    "serviceName": "deft-mcp",
    "sampleRate": 1
  },
  "resilience": {
    "rateLimits": {
      "search_skills": { "bucketSize": 20, "refillPerMinute": 20 },
      "install_skill": { "bucketSize": 10, "refillPerMinute": 10 },
      "push_skills": { "bucketSize": 5, "refillPerMinute": 5 }
    }
  },
  "backup": {
    "enabled": false,
    "target": "git",
    "interval": "daily",
    "onConfigChange": true
  },
  "metadata": {
    "createdOn": "<platform>",
    "createdBy": "deft-mcp@1.0.0-beta",
    "platforms": ["<platform>"],
    "arch": "<arch>"
  }
}
```

## Hot Reload

`save_config`:

1. writes `ctx.config` to `configStore`
2. calls `onConfigReload()`

Current reload behavior in bootstrap:
- re-load global config
- re-discover project config
- re-merge effective config
- mutate in-memory config object
- rebuild search index metadata

## Notes

- `update_config` modifies session config only and does not persist.
- `schemaVersion` and `metadata` are locked in `update_config`.
