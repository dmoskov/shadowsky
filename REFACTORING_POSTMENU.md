# PostMenu Component Refactoring

## Problem: High Churn Rate

The PostMenu.tsx component was identified as a **churn hotspot** with 10 changes in 14 days, indicating architectural issues causing frequent modifications.

## Root Cause Analysis

### 1. God Component Anti-pattern (635 lines)

The original PostMenu component violated the Single Responsibility Principle by handling:

- Menu positioning logic (50+ lines)
- 12 different action handlers (mute, block, delete, share, etc.)
- Modal state management
- Keyboard navigation
- UI rendering

### 2. Tight Coupling

Direct dependencies on 6 different contexts:

- AuthContext, HiddenPostsContext, ModalContext, ModerationContext, ToastContext
- Any change to these contexts required changes to PostMenu

### 3. Code Duplication

- Every handler repeated: `setIsOpen(false)` followed by action
- URL generation duplicated 5 times
- Error handling patterns repeated throughout

### 4. Low Cohesion

Actions grouped only by "things a menu can do" rather than by related concerns.

## Solution: Extract and Separate Concerns

### Architecture Changes

```
Before:
PostMenu.tsx (635 lines)
├── All positioning logic
├── All action handlers
├── All UI rendering
└── Modal management

After:
PostMenu.tsx (172 lines)
├── useMenuPositioning hook
├── usePostMenuActions hook
└── PostMenuItems component
```

### Files Created

1. **`src/hooks/useMenuPositioning.ts` (82 lines)**
   - Encapsulates all menu positioning logic
   - Reusable for other dropdown menus
   - Clear separation of viewport calculations
   - **Purpose**: Handle menu positioning calculations

2. **`src/hooks/usePostMenuActions.ts` (312 lines)**
   - All 12 action handlers extracted
   - Encapsulates moderation, sharing, and content management logic
   - Single source of truth for post actions
   - **Purpose**: Business logic for post menu actions

3. **`src/components/PostMenuItems.tsx` (215 lines)**
   - Pure presentational component
   - Receives all handlers as props
   - Easy to test and modify
   - **Purpose**: UI rendering of menu items

4. **`src/components/PostMenu.tsx` (172 lines, down from 635)**
   - Orchestrates hooks and components
   - Manages open/close state and keyboard navigation
   - Clean, readable, focused on coordination
   - **Purpose**: Coordinate menu behavior

## Benefits

### 1. Reduced Churn Risk

- **Positioning changes**: Isolated to `useMenuPositioning.ts`
- **Action logic changes**: Isolated to `usePostMenuActions.ts`
- **UI changes**: Isolated to `PostMenuItems.tsx`
- **Menu behavior**: Isolated to `PostMenu.tsx`

Each concern can now change independently without affecting others.

### 2. Improved Testability

- `useMenuPositioning`: Test positioning calculations in isolation
- `usePostMenuActions`: Test action handlers without UI
- `PostMenuItems`: Test rendering without business logic
- `PostMenu`: Test coordination without implementation details

### 3. Better Reusability

- `useMenuPositioning` can be used for any dropdown menu
- `usePostMenuActions` can be reused in other contexts (e.g., swipe actions)
- `PostMenuItems` can be rendered in different containers

### 4. Reduced Complexity

- 72% reduction in PostMenu.tsx (635 → 172 lines)
- Clear separation of concerns
- Easier to understand and modify
- Each file has a single, well-defined purpose

### 5. Enhanced Maintainability

- Changes to positioning logic don't require touching action handlers
- Changes to actions don't require touching UI
- New menu items can be added without touching positioning or actions
- Bug fixes are easier to locate and implement

## Migration Impact

### Breaking Changes

None - the public API of PostMenu remains identical.

### Testing Recommendations

1. Test menu positioning in different viewport sizes
2. Test all action handlers (mute, block, delete, share, etc.)
3. Test keyboard navigation
4. Test modal interactions (report, add to list)

## Future Improvements

### Potential Next Steps

1. **Extract Modal Management**: Create a `useModals` hook to handle report and list modals
2. **Action Grouping**: Group related actions (sharing vs. moderation) into sub-hooks
3. **Configuration**: Make menu items configurable via a declarative config object
4. **Keyboard Navigation**: Extract to a more generic `useDropdownMenu` hook

### Architecture Evolution

This refactoring establishes a pattern for other complex components:

1. Identify responsibilities
2. Extract to hooks (logic) and components (presentation)
3. Keep the parent component as a thin coordinator

## Metrics

### Before

- **Total Lines**: 635 lines in one file
- **Responsibilities**: 6+ (positioning, actions, UI, state, keyboard, modals)
- **Dependencies**: 6 contexts directly imported
- **Change Impact**: High (any change affects the entire component)

### After

- **Total Lines**: 781 lines across 4 files (172 + 82 + 312 + 215)
- **PostMenu Size**: 172 lines (72% reduction)
- **Responsibilities per File**: 1-2 clear responsibilities
- **Change Impact**: Low (changes are isolated to specific files)
- **Reusability**: High (hooks and components can be reused)

## Conclusion

This refactoring stabilizes the PostMenu component by:

1. ✅ Separating concerns into focused, cohesive modules
2. ✅ Reducing coupling between different responsibilities
3. ✅ Improving testability and maintainability
4. ✅ Establishing patterns for future refactoring work
5. ✅ Reducing the likelihood of future churn

The component is now much less likely to require frequent changes, as modifications to positioning, actions, or UI can be made independently without affecting other parts of the system.
