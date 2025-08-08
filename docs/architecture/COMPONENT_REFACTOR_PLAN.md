# Component Refactoring Plan

## Safety Checklist

- [x] Create dedicated branch: `refactor/split-components`
- [ ] Test app functionality before starting
- [ ] Refactor one component at a time
- [ ] Test after each component refactor
- [ ] Commit after each successful refactor
- [ ] Final testing before merge

## Components to Split (in order of priority)

### 1. PostCard (397 lines) - HIGH PRIORITY

**Current file**: `src/components/feed/PostCard.tsx`
**Split into**:

- `PostCard.tsx` - Main container (orchestrator)
- `PostHeader.tsx` - Author info, timestamp, menu button ✅
- `PostContent.tsx` - Text content and reply context
- `PostEmbeds.tsx` - Images, quotes, external links ✅
- `PostEngagementBar.tsx` - Like, repost, reply, share buttons ✅
- `PostMenu.tsx` - Dropdown menu with actions

### 2. ThreadView (432 lines)

**Current file**: `src/components/thread/ThreadView.tsx`
**Split into**:

- `ThreadView.tsx` - Main container
- `ThreadViewHeader.tsx` - Navigation and mode toggles
- `ThreadViewModes.tsx` - Reader/compact mode UI
- `ThreadPostList.tsx` - List of posts in thread
- `useThreadData.ts` - Data fetching hook

### 3. Profile (359 lines)

**Current file**: `src/components/profile/Profile.tsx`
**Split into**:

- `Profile.tsx` - Main container
- `ProfileHeader.tsx` - Avatar, name, follow button
- `ProfileStats.tsx` - Followers/following counts
- `ProfileTabs.tsx` - Tab navigation
- `ProfileContent.tsx` - Tab content rendering

### 4. Search (291 lines)

**Current file**: `src/components/profile/Search.tsx`
**Split into**:

- `Search.tsx` - Main container
- `SearchInput.tsx` - Search bar with suggestions
- `SearchTabs.tsx` - Posts/Users tabs
- `SearchResults.tsx` - Results list
- `UserSearchResult.tsx` - Individual user result

### 5. Header (245 lines)

**Current file**: `src/components/core/Header.tsx`
**Split into**:

- `Header.tsx` - Main container
- `HeaderSearch.tsx` - Search functionality
- `UserDropdown.tsx` - User menu
- `NotificationBell.tsx` - Notification badge
- `useHeaderScroll.ts` - Scroll behavior hook

## Refactoring Process

### For each component:

1. **Analyze** current implementation
2. **Create** new sub-components
3. **Move** code carefully, preserving functionality
4. **Update** imports in parent component
5. **Test** in browser - verify no regressions
6. **Commit** with descriptive message

### Testing checklist after each refactor:

- [ ] Component renders correctly
- [ ] All interactions work (clicks, hovers)
- [ ] Data flows properly (props, hooks)
- [ ] Styles applied correctly
- [ ] No console errors
- [ ] No TypeScript errors

## Rollback Strategy

If anything breaks:

```bash
# Check what changed
git status
git diff

# Revert last commit if needed
git reset --hard HEAD~1

# Or revert to specific commit
git log --oneline
git reset --hard <commit-hash>

# Nuclear option - go back to main branch
git checkout refactor/organize-project-structure
git branch -D refactor/split-components
```

## Success Criteria

- All components < 200 lines
- Clear separation of concerns
- No functionality lost
- Better code organization
- Easier to maintain
