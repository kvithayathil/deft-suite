# Configuration Reference

`deft` merges configuration from three layers:

1. built-in defaults
2. global config (`~/.config/deft/config.json`)
3. project config (first discovered path)

## Global Config

Path:

`~/.config/deft/config.json`

Loaded by `FileConfigStore` during bootstrap.
On the very first run (when no config file exists), the server automatically
creates this file with the merged default values so you have a starting point
to inspect and edit.

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
  - `sources.local`, `sources.remote`, and `projectConfigPaths` concatenate by default.
  - `sources.catalogs` replaces by default (project overrides global).
  - Use `"<key>:replace": true` to force replacement on any array.
- Legacy configs (`sources` as flat array, `registries` object) are auto-migrated at load time.
- Global access-control precedence is enforced:
  - `blocklist`: global blocked entries are retained.
  - `allowlist`: merged allowed entries are filtered to global allowed keys.

## Environment Variable Overrides

Currently supported:

- `DEFT_LOG_LEVEL` → `logging.level`
- `DEFT_MIN_TRUST` → `security.minTrustLevel`

## Sources Configuration

The `sources` key defines where skills are resolved from and where catalogs live.

```json
{
  "sources": {
    "local": [
      { "path": "/home/user/skills", "trust": "verified" }
    ],
    "remote": [
      { "url": "https://github.com/org/skills.git", "type": "git", "branch": "main" }
    ],
    "catalogs": [
      { "url": "https://example.com/skill-catalog.json", "type": "static", "cacheMinutes": 60 },
      { "url": "https://github.com/acme/skill-catalog.git", "type": "git" }
    ]
  }
}
```

- **`local`**: filesystem paths to skill directories. Optional `trust` and `sync` fields.
- **`remote`**: skills fetched from remote sources. `type` is `git` or `hosted`.
- **`catalogs`**: searchable indexes of skills used by `search_skills`. `type` is `git` or `static`.
  - `cacheMinutes` (optional, per-catalog): freshness window before a source is considered stale.
  - Cache behavior in `search_skills`:
    - `refresh: false` (default): uses cached catalog when fresh.
    - stale cache or cache miss: fetches remote catalog.
    - remote failure: falls back to cached catalog when available and sets `offline: true`.

### Migration from legacy config

Old config shapes are auto-migrated at runtime — no manual changes required:

| Legacy | Migrated to |
|--------|-------------|
| `"sources": [{"type": "local", ...}]` | `"sources": {"local": [...], "remote": [...]}` |
| `"registries": {"sources": [...]}` | `"sources": {"catalogs": [...]}` |
| `"registries": {"cacheMinutes": N}` | `cacheMinutes` folded into each catalog entry |

## Unified Search Configuration

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

<!-- CONFIG_SHAPE_START -->

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
  "sources": {
    "local": [],
    "remote": [],
    "catalogs": []
  },
  "github": {
    "search": false,
    "topics": [
      "mcp-skill",
      "agent-skill"
    ]
  },
  "usage": {
    "pruneThreshold": 10000,
    "sessionCap": 3,
    "ceilingPercent": 20,
    "dbPath": ""
  },
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
      "search_skills": {
        "bucketSize": 20,
        "refillPerMinute": 20
      },
      "install_skill": {
        "bucketSize": 10,
        "refillPerMinute": 10
      },
      "push_skills": {
        "bucketSize": 5,
        "refillPerMinute": 5
      }
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
    "createdBy": "deft-mcp@1.0.0-beta.5",
    "platforms": [
      "<platform>"
    ],
    "arch": "<arch>"
  }
}
```

<!-- CONFIG_SHAPE_END -->

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
