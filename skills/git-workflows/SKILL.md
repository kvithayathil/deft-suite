---
name: git-workflows
description: Git workflow patterns for skill repositories, branching, PRs, and syncing
---

# Git Workflows

Master Git patterns for managing skill repositories, collaborating with teams, and keeping changes in sync.

## Branching Strategy

- `main`: Stable, released skill versions (protected branch)
- `develop`: Integration branch for features and fixes
- `feature/*`: Individual feature branches off develop
- `bugfix/*`: Hotfix branches for critical issues

## Pull Request Workflow

1. Create feature branch from develop: `git checkout -b feature/skill-name`
2. Make changes and commit frequently with clear messages
3. Push to remote and open pull request
4. Request review from skill maintainers
5. Address review feedback with new commits (don't amend)
6. Rebase onto develop when approved: `git rebase develop`
7. Merge to develop, then create release PR to main

## Keeping Skills in Sync

- Pull regularly from upstream before pushing
- Use `git pull --rebase` to avoid unnecessary merge commits
- Squash related commits before PR review
- Tag releases with semantic versioning: `git tag v1.0.0`

## Collaboration Patterns

- Use `.gitignore` to exclude node_modules, dist, and config files
- Write clear commit messages: "feat: add X" or "fix: resolve Y"
- Link PRs to issues for traceability
- Archive branches after merging to keep repo clean
