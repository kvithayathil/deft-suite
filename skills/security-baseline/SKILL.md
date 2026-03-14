---
name: security-baseline
description: Security scanning patterns and trust levels for managing skill sources
---

# Security Baseline

Understand how to assess skill security, interpret scanner findings, and apply trust policies.

## Trust Levels

Five levels control skill access:

- **Bundled ◆**: Core skills from official distribution (highest trust)
- **Verified ●**: Third-party skills signed by agentskills.io registry
- **Self-Approved ▲**: Skills you've manually reviewed and approved
- **Community ◇**: Publicly available, not verified (use with caution)
- **Unknown ✖**: Unrecognized sources (blocked by default)

## Scanner Findings

Built-in scanners detect:
- **Manifest errors**: Invalid SKILL.md frontmatter, missing fields
- **Trust violations**: Installation blocked by allowlist/blocklist policies
- **Dependency issues**: Missing or incompatible required skills
- **Code patterns**: (Optional enhanced scanners) ESLint violations, security anti-patterns

Findings are advisory in v1 — use threshold settings to enforce policies.

## Security Patterns

- Always verify the source before installing unknown skills
- Use allowlist to restrict to trusted registries only
- Enable blocklist for known-bad sources
- Review scanner findings before promoting skills to active
- Keep skills in scan-only mode during evaluation period

## Best Practices

- Start with Bundled and Verified skills
- Quarantine Community skills until verified
- Document approval rationale in metadata
- Audit trust changes regularly
