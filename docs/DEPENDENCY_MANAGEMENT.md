# Dependency Management Guidelines

## Current State Analysis

As of December 2024, this project experienced high package.json churn (14 changes in 14 days). This document outlines the root causes and provides guidelines to reduce unnecessary dependency changes while maintaining security and stability.

## Root Causes of Dependency Churn

1. **Unrestricted Semver Ranges**: All 55 dependencies use caret (^) ranges, allowing automatic minor and patch updates
2. **Manual Dependency Management**: No automated tooling (Dependabot/Renovate) leading to ad-hoc updates
3. **Large Dependency Surface**: 24 production + 31 dev dependencies = 55 potential update points
4. **Active Feature Development**: Frequent feature additions naturally require new dependencies

## Dependency Categories

### Critical Production Dependencies

These are core to the application and require careful version management:

- `@atproto/api` - AT Protocol API client
- `@atproto/oauth-client-browser` - Authentication
- `react`, `react-dom` - UI framework
- `react-router` - Navigation
- `@tanstack/react-query` - Data fetching
- `aws-amplify` - Backend services

### Media & UI Libraries

- `@ffmpeg/ffmpeg`, `@ffmpeg/util` - Video processing
- `hls.js` - Video streaming
- `html2canvas` - Screenshots
- `lucide-react` - Icons
- `dompurify` - XSS protection

### Storage & Data

- `dexie` - IndexedDB wrapper
- `idb` - IndexedDB operations

### Build & Development Tools

- `vite` - Build tool
- `wireit` - Task orchestration
- `typescript` - Type checking
- `eslint`, `prettier` - Code quality
- `vitest`, `@playwright/test` - Testing

## Recommendations

### 1. Implement Automated Dependency Management

**Create `.github/dependabot.yml`:**

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      # Group minor/patch updates together
      non-breaking:
        update-types:
          - "minor"
          - "patch"
      # Keep major updates separate for review
      testing:
        patterns:
          - "@playwright/*"
          - "@testing-library/*"
          - "vitest"
          - "jsdom"
      linting:
        patterns:
          - "eslint*"
          - "prettier*"
          - "@eslint/*"
          - "typescript-eslint"
      build-tools:
        patterns:
          - "vite"
          - "esbuild"
          - "rollup*"
          - "postcss"
          - "autoprefixer"
          - "tailwindcss"
```

**Benefits:**

- Consolidates updates into weekly batches
- Groups related updates to reduce PR noise
- Maintains package-lock.json integrity
- Provides security alerts

### 2. Pin Critical Dependencies

For stability-critical packages, consider exact versions:

```json
{
  "dependencies": {
    "@atproto/api": "0.16.7", // Pin AT Protocol SDK
    "@atproto/oauth-client-browser": "0.3.35", // Pin auth
    "react": "18.2.0", // Pin framework major
    "react-dom": "18.2.0"
  }
}
```

**When to pin:**

- Authentication libraries (security-critical)
- Major framework versions (stability)
- APIs with breaking changes (AT Protocol during development)

**When to use ranges:**

- Development tools (ESLint, Prettier)
- Build tools (Vite, TypeScript)
- Testing frameworks (Vitest, Playwright)

### 3. Establish Update Cadence

**Weekly Schedule:**

- Monday: Dependabot PRs created
- Tuesday-Wednesday: Review and merge non-breaking groups
- Thursday: Test major updates in isolation
- Friday: Deploy if all tests pass

**Monthly Reviews:**

- Audit unused dependencies
- Evaluate new package alternatives
- Review bundle size impact
- Update documentation

### 4. Bundle Size Monitoring

The CI already monitors bundle sizes. Set alerts for dependency-driven bloat:

```bash
# Current budgets (from ci.yml)
MAX_MAIN_BUNDLE=150KB   # Main entry chunk (gzipped)
MAX_VENDOR_CHUNK=200KB  # Vendor chunks (gzipped)
```

**Before adding dependencies:**

1. Check bundle impact: `npm run analyze`
2. Look for lighter alternatives
3. Consider dynamic imports for large libraries
4. Verify tree-shaking support

### 5. Dependency Hygiene Practices

**Before updating package.json:**

```bash
# 1. Check what would change
npm outdated

# 2. Review changelogs for breaking changes
# Visit GitHub releases for major dependencies

# 3. Test in isolation
npm install <package>@latest
npm test
npm run build

# 4. Update lock file
npm install

# 5. Verify CI passes
git push
```

**Commit message format:**

```
deps: update <category> dependencies

- @atproto/api: 0.16.6 -> 0.16.7
- vite: 7.2.5 -> 7.2.6

Changes: <brief description>
Breaking: <yes/no>
```

### 6. Security Update Policy

**Immediate updates (within 24 hours):**

- Critical security vulnerabilities (CVSS >= 7.0)
- Authentication/authorization issues
- XSS/injection vulnerabilities

**Scheduled updates (next weekly cycle):**

- Moderate vulnerabilities (CVSS 4.0-6.9)
- Low-risk security patches

**Monitor with:**

```bash
npm audit
npm audit --production  # Production dependencies only
```

### 7. Reduce Dependency Count

**Audit opportunities:**

```bash
# Find duplicate functionality
npm ls <package>

# Check dependency tree depth
npm ls --depth=0
```

**Consider removing/replacing:**

- Packages with < 100 weekly downloads
- Unmaintained packages (last update > 1 year)
- Packages with critical security issues
- Duplicate functionality (e.g., multiple date libraries)

### 8. Lock File Discipline

**Always:**

- Commit `package-lock.json` with package.json changes
- Run `npm ci` in CI (never `npm install`)
- Use `npm install` locally (keeps lock file updated)

**Never:**

- Manually edit package-lock.json
- Use `npm install --package-lock-only` (use `npm install` instead)
- Mix package managers (npm/yarn/pnpm)

## Implementation Plan

### Phase 1: Stabilization (Week 1)

- [ ] Add Dependabot configuration
- [ ] Pin critical dependencies (@atproto/\*, react)
- [ ] Document current dependency rationale
- [ ] Audit for unused dependencies

### Phase 2: Process (Weeks 2-3)

- [ ] Establish weekly update schedule
- [ ] Create dependency update checklist
- [ ] Add bundle size regression tests
- [ ] Document emergency security update process

### Phase 3: Optimization (Month 2)

- [ ] Review and reduce dependency count
- [ ] Implement dynamic imports for large packages
- [ ] Set up automated security scanning
- [ ] Create dependency decision matrix

## Decision Matrix: Adding New Dependencies

Before adding a new dependency, evaluate:

| Criteria           | Weight | Threshold          |
| ------------------ | ------ | ------------------ |
| Weekly downloads   | 🟢     | > 10,000           |
| Last update        | 🟢     | < 6 months         |
| Open issues        | 🟡     | < 50               |
| Bundle size        | 🟡     | < 50KB             |
| Tree-shakeable     | 🟢     | Yes                |
| TypeScript support | 🟢     | Built-in or @types |
| License            | 🔴     | MIT/Apache/BSD     |
| Maintainer count   | 🟡     | > 2                |
| Security audit     | 🔴     | 0 critical         |

🔴 = Blocker, 🟡 = Consider carefully, 🟢 = Nice to have

## Measuring Success

Track these metrics monthly:

1. **Churn Rate**: package.json changes per month (target: < 4)
2. **Security Lag**: Days to patch critical vulnerabilities (target: < 1)
3. **Bundle Size**: Total vendor chunk size (target: < 200KB gzipped)
4. **Build Time**: CI test duration (target: < 5 minutes)
5. **Dependency Count**: Total dependencies (target: maintain or reduce)

## References

- [npm Semver Calculator](https://semver.npmjs.com/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Can I Use](https://caniuse.com/) - Browser compatibility
- [Bundlephobia](https://bundlephobia.com/) - Package size analysis
- [Snyk Advisor](https://snyk.io/advisor/) - Package health scoring

## Questions?

For questions about dependency management:

1. Check this document first
2. Review existing dependency patterns in package.json
3. Ask in team chat for clarification
4. Update this document with new learnings
