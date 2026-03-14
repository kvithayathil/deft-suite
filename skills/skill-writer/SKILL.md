---
name: skill-writer
description: How to write new skills with valid frontmatter and best practices
---

# Skill Writer

Learn how to create new skills that are discoverable and compatible with the MCP ecosystem.

## Frontmatter Format

Every SKILL.md file must start with YAML frontmatter:

```yaml
---
name: skill-name
description: One-line description of what the skill does
---
```

Required fields:
- `name`: kebab-case identifier (must match directory name)
- `description`: One-line summary (under 100 characters)

Reserved fields (optional):
- `version`: Semantic versioning for future use
- `dependencies`: Array of required skills
- `min-mcp-version`: Minimum MCP version required

## Content Structure

After frontmatter, add:
1. Main heading (# Skill Title)
2. Brief overview paragraph
3. Key concepts or features
4. Common tasks or examples
5. Best practices

Keep content concise and agent-friendly — 200-400 words maximum.

## Best Practices

- Use clear, imperative language
- Include code examples when helpful
- Define domain-specific terms
- Test that frontmatter is valid YAML
- Follow XDG directory structure conventions
- Include error handling patterns for robustness
