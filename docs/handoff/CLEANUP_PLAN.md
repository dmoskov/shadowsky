# Bluesky Client Cleanup Plan

## Executive Summary

This cleanup plan addresses critical security issues, organizational debt, and prepares the codebase for handoff to another developer.

## Critical Security Issues (P0 - Immediate)

### 1. Remove Hardcoded Credentials

- [ ] Update all 39 test files to use environment variables via `getTestCredentials()`
- [ ] Remove hardcoded email `test-account@example.com` from all files
- [ ] Create migration script to update all test files automatically
- [ ] Add pre-commit hook to prevent future credential commits

### 2. Secure Credential Management

- [ ] Create `.env.example` with template variables
- [ ] Update all test scripts to use environment variables
- [ ] Add credential validation to test setup
- [ ] Document proper credential management in README

## Code Organization (P1 - High Priority)

### 1. File Structure Reorganization

```
BSKY/
├── docs/                    # Move 34 documentation files here
│   ├── architecture/
│   ├── decisions/
│   └── progress/
├── scripts/                 # Already exists, consolidate test scripts
│   ├── test/               # Move test-*.mjs files here
│   ├── analyze/            # Move analyze-*.mjs files here
│   └── utils/              # Helper scripts
├── tests/                   # Consolidate all test files
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
└── tools/                   # Development tools
    ├── setup/              # Setup scripts
    └── cleanup/            # Cleanup utilities
```

### 2. Component Consolidation

- [ ] Remove duplicate PostCard components (keep PostCardBluesky)
- [ ] Remove abandoned Tailwind migration files (.original.tsx)
- [ ] Consolidate Feed components (keep Feed.tsx)
- [ ] Remove unused ParentPost component

### 3. Test File Cleanup

- [ ] Move 38 root-level test scripts to appropriate directories
- [ ] Update import paths in moved files
- [ ] Create test runner script for common test scenarios

## Development Artifacts (P2 - Medium Priority)

### 1. Update .gitignore

```gitignore
# Test artifacts
test-screenshots/
test-results/
playwright-report/
coverage/

# Build artifacts
dist/
build/

# Local development
.env.local
.test-credentials
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
```

### 2. Remove Committed Artifacts

- [ ] Remove test-screenshots directory (50+ files)
- [ ] Remove playwright-report directory
- [ ] Remove coverage directory
- [ ] Clean up root HTML test fixtures

## Database & Analytics (P3 - Documentation)

### 1. Document IndexedDB Setup

- [ ] Create setup guide for analytics database
- [ ] Document data persistence limitations
- [ ] Provide migration path to server-side storage

### 2. Create Analytics Export Tool

- [ ] Build export functionality for existing data
- [ ] Document data schema
- [ ] Provide import functionality for new installations

## Automation Scripts

### 1. Credential Migration Script

```bash
#!/bin/bash
# scripts/migrate-credentials.sh
echo "Migrating hardcoded credentials to environment variables..."
# Implementation details...
```

### 2. Cleanup Script

```bash
#!/bin/bash
# scripts/cleanup-project.sh
echo "Cleaning up project artifacts..."
# Implementation details...
```

### 3. Setup Script for New Developers

```bash
#!/bin/bash
# scripts/setup-dev.sh
echo "Setting up Bluesky client development environment..."
# Implementation details...
```

## Timeline

### Week 1: Critical Security

- Day 1-2: Remove all hardcoded credentials
- Day 3-4: Implement secure credential system
- Day 5: Security audit and verification

### Week 2: Organization

- Day 1-2: Reorganize file structure
- Day 3-4: Consolidate components
- Day 5: Update documentation

### Week 3: Polish

- Day 1-2: Remove artifacts
- Day 3-4: Create automation scripts
- Day 5: Final testing and handoff preparation

## Success Criteria

- [ ] Zero hardcoded credentials in codebase
- [ ] All tests use environment variables
- [ ] Clean, organized file structure
- [ ] No unnecessary files in repository
- [ ] Complete documentation for handoff
- [ ] One-command setup for new developers
