# Loading State Migration Guide

This guide documents the unified loading state system and provides migration patterns for replacing ad-hoc loading implementations.

## Overview

The loading state system provides:

- **Consistent timing**: All loading indicators use coordinated animation tokens
- **Accessibility**: Proper ARIA attributes and screen reader support
- **Minimum display duration**: Prevents jarring flash of loading state (300ms default)
- **Loading delay**: Prevents flash for quick operations (150ms default)
- **Theme-aware colors**: Skeletons use `bsky-bg-tertiary` instead of hardcoded grays

## Components

### LoadingState

Main loading indicator component with multiple variants.

```tsx
import { LoadingState } from "@/components/ui/LoadingState";

// Spinner (default)
<LoadingState variant="spinner" size="md" message="Loading..." />

// Skeleton
<LoadingState variant="skeleton" />

// Overlay (full screen blocking)
<LoadingState variant="overlay" message="Processing..." />

// Inline (for text contexts)
<LoadingState variant="inline" size="sm" />
```

### LoadingBoundary

Wrapper component for conditional loading states with automatic minimum duration.

```tsx
import { LoadingBoundary } from "@/components/ui/LoadingState";

<LoadingBoundary
  isLoading={isLoading}
  fallback={<FeedSkeleton count={3} />}
  minDuration={true}
  delay={true}
>
  <FeedContent data={data} />
</LoadingBoundary>;
```

### LoadingOverlay

Overlay loading indicator that can be placed over existing content.

```tsx
import { LoadingOverlay } from "@/components/ui/LoadingState";

<LoadingOverlay isLoading={isSaving} message="Saving changes..." blur={true}>
  <FormContent />
</LoadingOverlay>;
```

### Skeleton Components

Pre-built skeleton components for common UI patterns.

```tsx
import {
  PostSkeleton,
  FeedSkeleton,
  ProfileSkeleton,
  NotificationSkeleton,
  NotificationFeedSkeleton,
  SearchResultSkeleton,
  ColumnHeaderSkeleton,
} from "@/components/ui/SkeletonLoader";

// Post skeleton with optional image placeholder
<PostSkeleton showImage={true} />

// Feed skeleton with count
<FeedSkeleton count={5} showImages={true} />

// Profile skeleton with optional banner
<ProfileSkeleton showBanner={true} />

// Column header skeleton
<ColumnHeaderSkeleton />
```

### Spinner Variants

```tsx
import { Spinner, InlineSpinner, BorderSpinner } from "@/components/ui/LoadingState";

// Icon-based spinner (lucide-react Loader)
<Spinner size="md" />

// Inline for text contexts
<InlineSpinner size="sm" />

// CSS-only border spinner (no icon dependency)
<BorderSpinner size="md" color="primary" />
```

## Hooks

### useMinDuration (Recommended)

**Primary hook for preventing jarring flash of loading state.** Import from the centralized timing utilities:

```tsx
import { useMinDuration } from "@/hooks/useTiming";

const Component = () => {
  const { isLoading: isLoadingRaw } = useQuery(/* ... */);

  // Apply minimum duration (300ms default) to prevent flash
  const isLoading = useMinDuration(isLoadingRaw);

  if (isLoading) {
    return <FeedSkeleton count={5} />;
  }

  return <Content />;
};
```

### useMinLoadingDuration (Deprecated)

Legacy hook re-exported from LoadingState for backward compatibility. **Use `useMinDuration` instead.**

```tsx
// Deprecated - use useMinDuration from hooks/useTiming
import { useMinLoadingDuration } from "@/components/ui/LoadingState";

const showLoading = useMinLoadingDuration(isLoading, 300);
```

### useDelayedBoolean

Delays showing a true state until after a specified delay. Useful for preventing flash of loading indicators for quick operations.

```tsx
import { useDelayedBoolean } from "@/hooks/useTiming";

const Component = () => {
  const { isLoading } = useQuery(/* ... */);
  // Only show loading after 150ms to prevent flash for quick loads
  const showLoading = useDelayedBoolean(isLoading, 150);

  if (!showLoading) return <Content />;
  return <LoadingState />;
};
```

## Loading Tokens

CSS custom properties for loading animations:

```css
:root {
  --loading-min-display: 300ms;
  --loading-delay: 150ms;
  --loading-spinner-duration: 1000ms;
  --loading-pulse-duration: 2000ms;
  --loading-shimmer-duration: 2000ms;
  --loading-skeleton-bg: var(--bsky-bg-tertiary);
  --loading-skeleton-highlight: var(--bsky-bg-hover);
  --loading-overlay-bg: rgba(0, 0, 0, 0.5);
}
```

JavaScript constants:

```tsx
import { LOADING_TOKENS } from "@/components/ui/LoadingState";

LOADING_TOKENS.MIN_DISPLAY_DURATION; // 300
LOADING_TOKENS.LOADING_DELAY; // 150
LOADING_TOKENS.SKELETON_PULSE_DURATION; // 2000
LOADING_TOKENS.SHIMMER_DURATION; // 2000
LOADING_TOKENS.SPINNER_DURATION; // 1000
```

## Migration Patterns

### Pattern 1: Replace inline spinners

**Before:**

```tsx
{
  isLoading && (
    <div className="flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
    </div>
  );
}
```

**After:**

```tsx
{
  isLoading && <LoadingState size="md" />;
}
```

### Pattern 2: Replace ad-hoc skeleton loading

**Before:**

```tsx
{
  loading ? (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-3/4 rounded bg-gray-200" />
      <div className="h-4 rounded bg-gray-200" />
    </div>
  ) : (
    <Content />
  );
}
```

**After:**

```tsx
<LoadingBoundary
  isLoading={loading}
  fallback={<LoadingState variant="skeleton" />}
>
  <Content />
</LoadingBoundary>
```

### Pattern 3: Replace feed loading

**Before:**

```tsx
{
  isLoading ? (
    <div className="divide-y divide-gray-200">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse p-4">
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-4 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Feed posts={posts} />
  );
}
```

**After:**

```tsx
<LoadingBoundary isLoading={isLoading} fallback={<FeedSkeleton count={5} />}>
  <Feed posts={posts} />
</LoadingBoundary>
```

### Pattern 4: Replace loading overlays

**Before:**

```tsx
<div className="relative">
  {content}
  {isSaving && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <Loader className="animate-spin" />
    </div>
  )}
</div>
```

**After:**

```tsx
<LoadingOverlay isLoading={isSaving} message="Saving...">
  {content}
</LoadingOverlay>
```

### Pattern 5: Replace RefreshCw loading state

**Before:**

```tsx
<RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
```

**After (keep this pattern for action buttons):**

```tsx
// This pattern is acceptable for action buttons that show loading state
// The new system is primarily for content loading, not action feedback
<RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
```

## Migration Status

### Migrated Components ✅

The following high-traffic components now use the standardized loading pattern with `useMinDuration`:

1. **Home.tsx** - Main feed loading with FeedSkeleton and 300ms minimum duration
2. **NotificationsFeed.tsx** - Notification loading with NotificationSkeleton and 300ms minimum duration
3. **BookmarksColumn.tsx** - Bookmarks loading with FeedSkeleton and 300ms minimum duration
4. **SearchTabbed.tsx** - Search results loading with LoadingState spinner and 300ms minimum duration

### Remaining Migration Targets

#### High Traffic Components (Priority 1)

1. **ThreadViewer.tsx** - Thread loading
2. **DirectMessages.tsx** - DM loading
3. **SearchColumn.tsx** - Search results loading

#### Settings Components (Priority 2)

1. **DataSettings.tsx** - Multiple loading states
2. **StorageOptionSelector.tsx** - Migration loading
3. **PrivacySettings.tsx** - Settings loading

#### Modal Components (Priority 3)

1. **UserListModal.tsx** - User list loading
2. **AddToListModal.tsx** - List loading
3. **ThreadModal.tsx** - Thread loading

## Best Practices

1. **Always use LoadingBoundary for data fetching** - It handles minimum duration automatically

2. **Use appropriate skeleton for content type** - Don't use generic skeletons when specific ones exist

3. **Add aria-labels to skeletons** - Helps screen readers understand what's loading

4. **Use delay for quick operations** - Prevents flash for fast network responses

5. **Keep action button spinners inline** - RefreshCw animate-spin pattern is still appropriate for action feedback

## Accessibility

All loading components include:

- `role="status"` for ARIA live regions
- `aria-busy="true"` to indicate loading state
- `aria-label` descriptions for screen readers
- Support for `prefers-reduced-motion` (animation disabled in reduced motion mode)
