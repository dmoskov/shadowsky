# Root Directory Organization Plan

## Goal
Clean up the root directory to make it easy for humans to navigate while ensuring nothing breaks.

## Principles
1. **Don't break anything** - Keep all config files in root
2. **Clear structure** - Group related files logically
3. **Easy navigation** - Essential files stay visible
4. **Preserve git history** - Use git mv for moves

## Current State
- 103 files in root (way too many!)
- 57 are documentation files
- 18 are test scripts
- 8 are capture scripts

## Proposed Structure

### Files that MUST stay in root:
```
# Configuration (NEVER MOVE THESE)
- package.json
- package-lock.json
- tsconfig.json
- tsconfig.app.json
- tsconfig.node.json
- vite.config.ts
- jest.config.js
- eslint.config.js
- playwright.config.ts
- postcss.config.js
- .gitignore
- .env.example

# Entry Points
- index.html
- README.md

# Core Documentation
- CLAUDE.md (AI instructions)
- SESSION_NOTES.md (active work)
- setup-local-mac.sh (setup script)
```

### New Directory Structure:
```
docs/
├── architecture/
│   ├── ARCHITECTURE_ANALYSIS.md
│   ├── COMPONENT_REFACTOR_PLAN.md
│   ├── CSS-ARCHITECTURE-PLAN.md
│   └── SAFE_REFACTORING_PLAN.md
├── decisions/
│   ├── DECISIONS.md
│   ├── PATTERNS.md
│   └── METRICS.md
├── guides/
│   ├── DEVELOPMENT_PROCESS.md
│   ├── TESTING_STRATEGY.md
│   ├── LIKE_BUTTON_DEBUG_GUIDE.md
│   └── manual-screenshot-guide.md
├── handoff/
│   ├── README-HANDOFF.md
│   ├── CLAUDE-HANDOFF.md
│   └── CLEANUP_PLAN.md
├── migration/
│   ├── tailwind/
│   │   ├── TAILWIND-MIGRATION-PLAN.md
│   │   ├── TAILWIND-MIGRATION-PROGRESS.md
│   │   └── (other tailwind docs)
│   └── CREDENTIAL_MIGRATION_REPORT.json
└── analysis/
    ├── FEED_AUDIT_AND_FIXES.md
    ├── comprehensive-ui-ux-critique.md
    └── (other analysis docs)

scripts/
├── test/
│   ├── test-analytics.mjs
│   ├── test-improvements.mjs
│   └── (other test-*.mjs files)
├── capture/
│   ├── capture-screenshots.js
│   ├── capture-complex-threads.js
│   └── (other capture-*.js files)
└── utils/
    └── fix-imports.cjs

tools/
├── screenshot-helper.html
├── visual-comparison.html
└── style-guides/
    ├── tailwind-style-guide.html
    └── tailwind-v4-test.css
```

## Migration Commands

```bash
# Create directories
mkdir -p docs/{architecture,decisions,guides,handoff,migration/tailwind,analysis}
mkdir -p scripts/{test,capture,utils}
mkdir -p tools/style-guides

# Move documentation files
git mv ARCHITECTURE_ANALYSIS.md docs/architecture/
git mv DECISIONS.md PATTERNS.md METRICS.md docs/decisions/
git mv DEVELOPMENT_PROCESS.md TESTING_STRATEGY.md docs/guides/
git mv README-HANDOFF.md CLAUDE-HANDOFF.md CLEANUP_PLAN.md docs/handoff/
git mv TAILWIND-*.md docs/migration/tailwind/
git mv CREDENTIAL_MIGRATION_REPORT.json docs/migration/

# Move test scripts
git mv test-*.mjs scripts/test/

# Move capture scripts  
git mv capture-*.js capture-*.mjs scripts/capture/

# Move utility files
git mv fix-imports.cjs scripts/utils/
git mv screenshot-helper.html visual-comparison.html tools/
git mv tailwind-style-guide.html tailwind-v4-test.css tools/style-guides/
```

## After Organization

Root directory will have ~20 files (down from 103):
- Essential configs (10 files)
- README.md
- CLAUDE.md  
- SESSION_NOTES.md
- index.html
- setup-local-mac.sh
- A few active working files

This makes it MUCH easier to navigate!