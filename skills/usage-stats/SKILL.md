---
name: usage-stats
description: Interpret skill usage and frecency trends using deft usage and stats commands
---

# Usage Stats

Use this skill when you need to understand which skills are actually helping and where search quality can improve.

## Core Commands

- `deft stats` — high-level dashboard for top skills, search activity, and usage database health
- `deft usage export --format json` — full raw usage data for deeper analysis
- `deft usage export --format csv` — spreadsheet-friendly export for reports
- `deft usage reset <name>` — reset one skill's accumulated score
- `deft usage reset --all` — reset all usage/frecency data

## Frecency Semantics

Frecency combines frequency and recency:

- **Frequency**: each successful skill access increases the base score
- **Recency decay**: newer access weighs more than older access
- **Result ranking impact**: local search blends keyword relevance with normalized frecency

Interpretation tips:

- High score + recent access = strong default recommendation candidate
- High score + stale access = historically useful but possibly outdated
- Low score + recent access = emerging skill worth monitoring

## Analysis Workflow

1. Run `deft stats` and identify top recurring skills.
2. Export raw data with `deft usage export --format json` for trend inspection.
3. Correlate search source breakdown with discovery strategy (local/catalog/github).
4. Reset outliers with `deft usage reset <name>` when testing ranking changes.

## Guardrails

- Usage data is local to the current machine/config directory.
- Resetting usage data changes local ranking behavior immediately.
- Treat frecency as a ranking signal, not an absolute quality metric.
