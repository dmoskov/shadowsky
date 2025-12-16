# ThreadViewer Refactoring Plan

## Problem Statement

ThreadViewer.tsx is a churn hotspot with 21 changes in 14 days. Analysis reveals:

- **2,100 lines** - severely over-sized component
- **15+ useState hooks** - complex state management
- **25+ props** - tight coupling and unclear API
- **620+ line render function** - renderThreadNodes is unmaintainable
- **Multiple responsibilities** - violates Single Responsibility Principle

## Root Causes of Churn

1. **Lack of Separation of Concerns**: All thread logic, rendering, and state in one file
2. **Difficult to Test**: Massive component makes unit testing nearly impossible
3. **Hard to Modify**: Changes in one area risk breaking others
4. **Code Duplication**: Similar rendering logic repeated throughout
5. **Poor Abstraction**: Business logic mixed with presentation

## Proposed Component Decomposition

### 1. Extract Components

#### A. `ThreadNode.tsx` (New Component)

**Purpose**: Render a single thread post node
**Props**:

- `node: ThreadNode`
- `isHighlighted: boolean`
- `isFocused: boolean`
- `isCollapsed: boolean`
- `onToggleCollapse: (uri: string) => void`
- `onPostClick: (post: Post, action) => void`
- `renderEmbed: (embed, uri) => ReactNode`
- Visual props (depth colors, indents, etc.)

**Benefits**:

- Reduces main component by ~400 lines
- Makes node rendering testable in isolation
- Easier to optimize (React.memo)

#### B. `EmbedRenderer.tsx` (New Component)

**Purpose**: Handle all embed types (images, videos, quotes, external)
**Props**:

- `embed: any`
- `postUri: string`
- `onImageClick: (images, index) => void`

**Benefits**:

- Removes ~260 lines from main component
- Centralized embed logic
- Easier to add new embed types

#### C. `ThreadPostCard.tsx` (New Component)

**Purpose**: Render individual post card UI
**Props**:

- `post: Post`
- `author: Profile`
- `isCurrentUser: boolean`
- `isHighlighted: boolean`
- `isFocused: boolean`
- Action handlers

**Benefits**:

- ~200 lines extracted
- Reusable across app
- Cleaner API

#### D. `ThreadLoadMoreButton.tsx` (New Component)

**Purpose**: Handle "load more replies" UI
**Props**:

- `hiddenCount: number`
- `onExpand: () => void`
- `depth: number`

**Benefits**:

- Small, focused component
- Removes ~50 lines
- Easy to style consistently

### 2. Extract Custom Hooks

#### A. `useThreadCollapse.ts` (New Hook)

**Purpose**: Manage collapse/expand state with persistence
**Returns**:

```ts
{
  collapsedBranches: Set<string>
  isCollapsed: (uri: string) => boolean
  toggleCollapse: (uri: string) => void
  animatingNodes: Set<string>
}
```

**Benefits**:

- ~120 lines extracted
- Testable in isolation
- Reusable logic

#### B. `useThreadKeyboardNav.ts` (New Hook)

**Purpose**: Handle keyboard navigation logic
**Returns**:

```ts
{
  focusedIndex: number
  setFocusedIndex: (index: number) => void
  handleKeyDown: (e: KeyboardEvent) => void
}
```

**Benefits**:

- ~100 lines extracted
- Easy to test keyboard shortcuts
- Separates navigation concern

#### C. `useScrollPersistence.ts` (New Hook)

**Purpose**: Save/restore scroll position
**Params**:

- `threadId: string`
- `scrollContainerRef: RefObject`
- `focusedIndex: number`

**Benefits**:

- ~150 lines extracted
- Generic, reusable
- Cleaner separation

#### D. `useThreadTree.ts` (New Hook)

**Purpose**: Build and manage thread tree structure
**Returns**:

```ts
{
  threadTree: ThreadNode[]
  flatNodeList: ThreadNode[]
  maxThreadDepth: number
  branchCount: number
  complexityScore: ComplexityScore
}
```

**Benefits**:

- ~100 lines extracted
- Business logic separated
- Easier to optimize

### 3. Extract Utility Functions

Move to `src/utils/thread-helpers.ts`:

- `getPersistedCollapseState`
- `setPersistedCollapseState`
- `getPersistedScrollPosition`
- `setPersistedScrollPosition`
- `clearPersistedScrollPosition`
- `countNodeDescendants`

**Benefits**:

- Pure functions easy to test
- Reusable across app
- ~140 lines extracted

### 4. Simplified ThreadViewer Structure

After refactoring, main component should be ~400-500 lines:

```tsx
export const ThreadViewer: React.FC<ThreadViewerProps> = (props) => {
  // Custom hooks
  const threadState = useThreadTree(props.posts, props.notifications)
  const collapseState = useThreadCollapse(threadId)
  const keyboardNav = useThreadKeyboardNav(threadState.flatNodeList, props.onPostClick)
  const scrollState = useScrollPersistence(threadId, props.scrollContainerRef)

  // Minimal local state
  const [galleryState, setGalleryState] = useState(...)
  const [expandedBranches, setExpandedBranches] = useState(...)

  // Render orchestration
  return (
    <div>
      {hasMoreAbove && <LoadMoreAboveButton />}
      {rootPostObject && <HeroRootPost />}
      {showReplies && (
        <ThreadNodeList
          nodes={threadState.threadTree}
          collapseState={collapseState}
          keyboardNav={keyboardNav}
          onPostClick={props.onPostClick}
        />
      )}
      {galleryState.images && <ImageGallery />}
    </div>
  )
}
```

## Implementation Strategy

### Phase 1: Extract Utilities and Hooks (Low Risk)

1. Create `thread-helpers.ts` with persistence functions
2. Create `useThreadTree.ts` hook
3. Create `useThreadCollapse.ts` hook
4. Create `useScrollPersistence.ts` hook
5. Create `useThreadKeyboardNav.ts` hook
6. Update ThreadViewer to use new hooks

### Phase 2: Extract Rendering Components (Medium Risk)

1. Create `EmbedRenderer.tsx`
2. Create `ThreadPostCard.tsx`
3. Create `ThreadLoadMoreButton.tsx`
4. Update ThreadViewer to use new components

### Phase 3: Extract ThreadNode (High Risk)

1. Create `ThreadNode.tsx` with renderThreadNodes logic
2. Update ThreadViewer to use ThreadNode
3. Remove old renderThreadNodes

### Phase 4: Final Cleanup

1. Remove dead code
2. Update tests
3. Run build and verify

## Expected Outcomes

### Metrics

- **ThreadViewer.tsx**: 2,100 → ~400-500 lines (76% reduction)
- **New Components**: 5 focused components
- **New Hooks**: 4 reusable hooks
- **New Utils**: 1 utility module

### Benefits

1. **Reduced Churn**: Changes isolated to specific components
2. **Better Testability**: Each piece testable in isolation
3. **Improved Maintainability**: Clear responsibilities
4. **Better Performance**: Opportunities for React.memo, useMemo
5. **Enhanced Reusability**: Hooks and components reusable elsewhere
6. **Easier Onboarding**: Smaller files easier to understand

### Risks

- **Breaking Changes**: Careful testing required
- **Context Dependencies**: Need to verify ThreadContext integration
- **Performance Regression**: Monitor render performance
- **TypeScript Complexity**: Props interfaces need careful design

## Testing Strategy

1. **Before Refactoring**: Document current behavior
2. **During Refactoring**: Test each extracted piece
3. **After Refactoring**:
   - Visual regression testing
   - Interaction testing (keyboard nav, collapse, etc.)
   - Performance benchmarks
   - Build verification

## Success Criteria

- [ ] Build passes with no TypeScript errors
- [ ] All existing functionality works
- [ ] ThreadViewer.tsx under 600 lines
- [ ] No performance regressions
- [ ] Code coverage maintained or improved
- [ ] Future changes require fewer file modifications
