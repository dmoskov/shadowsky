# Safe Refactoring Plan for Bluesky Client

## Philosophy: "Move, Don't Change"
The safest approach is to reorganize without modifying functionality. We'll use git to track every step.

## Phase 1: Quick Wins (30 minutes, Zero Risk)

### 1.1 Clean Up Test Files
```bash
# Move all test files to a dedicated directory
mkdir -p tests/playwright
mv test-*.js tests/playwright/
mv *.mjs tests/playwright/

# Archive screenshots
mkdir -p tests/screenshots/archive
mv test-screenshots/* tests/screenshots/archive/
```

### 1.2 Organize Components (Without Breaking Imports)
```bash
# Create subdirectories
mkdir -p src/components/{core,feed,thread,modals,profile,common}

# Use git mv to preserve history
git mv src/components/Header.tsx src/components/core/
git mv src/components/Sidebar.tsx src/components/core/
git mv src/components/ErrorBoundary.tsx src/components/core/

git mv src/components/Feed.tsx src/components/feed/
git mv src/components/PostCard.tsx src/components/feed/

git mv src/components/ThreadView.tsx src/components/thread/
git mv src/components/ThreadBranchDiagram*.tsx src/components/thread/
# ... etc
```

### 1.3 Create Index Files (Maintain Same Import Paths)
```typescript
// src/components/index.ts
export { Header } from './core/Header'
export { Sidebar } from './core/Sidebar'
export { Feed } from './feed/Feed'
export { PostCard } from './feed/PostCard'
// ... etc

// This means existing imports still work:
// import { Header } from './components'
```

## Phase 2: Consolidate Duplicates (1 hour, Low Risk)

### 2.1 Merge Thread Diagram Components
```typescript
// Create a single, configurable component
// src/components/thread/ThreadBranchDiagram.tsx
interface ThreadBranchDiagramProps {
  variant?: 'default' | 'compact'
  // ... other props
}

// Remove duplicate file after testing
```

### 2.2 Extract Common Hooks
```typescript
// src/hooks/useModal.ts
export function useModal() {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  return { isOpen, open, close }
}
```

### 2.3 Organize Styles
```bash
mkdir -p src/styles/{base,components,features,utils}

# Move files logically
git mv src/styles/design-system.css src/styles/base/
git mv src/styles/typography.css src/styles/base/
git mv src/styles/header.css src/styles/components/
git mv src/styles/thread*.css src/styles/features/thread/
```

## Phase 3: Component Splitting (2 hours, Medium Risk)

### 3.1 Split Large Components
Example for PostCard:
```typescript
// Before: 399 lines in one file
// After:
src/components/feed/
  ├── PostCard/
  │   ├── index.tsx         // Main component (50 lines)
  │   ├── PostHeader.tsx    // Author info
  │   ├── PostContent.tsx   // Text and embeds
  │   ├── PostActions.tsx   // Like/Reply/Repost buttons
  │   ├── PostEmbed.tsx     // Image/Link/Quote handling
  │   └── types.ts          // Shared types
```

## Implementation Strategy

### Step 1: Create a Refactoring Branch
```bash
git checkout -b refactor/organize-project-structure
git add -A
git commit -m "Checkpoint: Before refactoring"
```

### Step 2: Run Tests After Each Move
```bash
# After each git mv operation:
npm run dev  # Ensure it still compiles
# Test in browser that everything works
git add -A
git commit -m "Refactor: Move [component] to [location]"
```

### Step 3: Update Imports Incrementally
Use VS Code's "Update Imports on File Move" or:
```bash
# Find and replace imports systematically
grep -r "from '../components/Header'" src/
# Update each file carefully
```

### Step 4: Validate No Functionality Changed
```bash
# Compare functionality before/after
git diff main --name-status  # Should only show renames
```

## Benefits of This Approach

1. **Git tracks everything** - Easy rollback if needed
2. **Incremental commits** - Can stop at any point
3. **No functionality changes** - Just reorganization
4. **Import compatibility** - Old imports still work via index files
5. **Easy to review** - Clear PR showing only moves

## Next Steps After Organization

1. Add unit tests for individual components
2. Set up Storybook for component development
3. Implement proper feature modules
4. Add CI/CD pipeline

## Quick Start Commands

```bash
# Start the refactoring
git checkout -b refactor/organize-project-structure

# Quick wins (5 minutes)
mkdir -p tests/playwright tests/screenshots/archive
mv test-*.js tests/playwright/ 2>/dev/null || true
mv test-screenshots/* tests/screenshots/archive/ 2>/dev/null || true

# Test it still works
npm run dev

# Commit the easy wins
git add -A
git commit -m "Refactor: Organize test files and screenshots"
```

Would you like me to start with Phase 1?