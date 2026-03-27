# Security Policy

## Supported Versions

| Version       | Supported          |
| ------------- | ------------------ |
| 1.x (latest)  | :white_check_mark: |
| < 1.0         | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, please report them privately via one of these methods:

1. **GitHub Security Advisories** (preferred): Use the "Report a vulnerability" button on the [Security tab](../../security/advisories/new) of this repository.
2. **Email**: Send details to the maintainer directly.

### What to include

- Description of the vulnerability
- Steps to reproduce or proof of concept
- Affected versions
- Potential impact

### What to expect

- **Acknowledgment** within 48 hours
- **Status update** within 7 days
- **Fix or mitigation** as soon as reasonably possible, prioritized by severity

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) and will credit reporters in release notes unless anonymity is requested.

## Security Tooling

This project uses a layered approach to prevent vulnerabilities and credential leaks:

### Static Analysis

| Tool | Scope | Integration |
|------|-------|-------------|
| [CodeQL](https://codeql.github.com/) | Code vulnerability detection (`security-and-quality` queries) | CI workflow (push, PR, weekly schedule) |
| [eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security) | Code-level anti-patterns (eval, unsafe regex, etc.) | ESLint config |
| [eslint-plugin-sonarjs](https://github.com/SonarSource/eslint-plugin-sonarjs) | Cognitive complexity, code smells, duplication | ESLint config |

### Secret Scanning (Three-Layer Defense)

| Layer | Tool | When |
|-------|------|------|
| **Pre-commit** | [gitleaks](https://github.com/gitleaks/gitleaks) `protect --staged` | Before every `git commit` |
| **CI** | [gitleaks-action](https://github.com/gitleaks/gitleaks-action) | Every push/PR to main |
| **Server-side** | [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning) + Push Protection | On push to GitHub |

### Dependency Security

| Tool | Scope | Integration |
|------|-------|-------------|
| [Dependency Review](https://github.com/actions/dependency-review-action) | Vulnerability and license audit for dependency changes | CI workflow (PRs modifying package.json) |
| [Dependabot](https://docs.github.com/en/code-security/dependabot) | Automated dependency update PRs | GitHub-native |

### Code Quality Gates

| Check | Threshold | Command |
|-------|-----------|---------|
| Code duplication | < 6% (jscpd) | `npm run check:duplication` |
| Lint | 0 errors | `npm run lint` |
| Type safety | 0 errors | `npm run typecheck` |
| Tests | Pass | `npm test` |

### `.gitignore` Hardening

Sensitive file patterns are blocked from being committed: `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.secret`, `*.credentials`, `**/secrets/`, `.npmrc`.
