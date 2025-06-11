# Thread Styling Changes Summary

## Overview
Updated the PostCardNative component and ThreadPostList to match Bluesky's thread structure and styling patterns.

## Key Changes Made

### 1. PostCardNative Component Updates
- Added new props: `isInThread`, `isMainPost`, `isParentPost` to control styling based on context
- Added reply indicator for feed view: Shows "Reply to @handle" above posts that are replies
- Adjusted thread line positioning: Now starts at `top-14` to connect from avatar bottom to next avatar top
- Conditional styling based on post type:
  - Main posts: Larger text, more padding
  - Parent posts: Smaller text, reduced opacity
  - Thread posts: No background/hover effects
  - Feed posts: Keep existing card styling

### 2. ThreadPostList Component Updates
- Removed `divide-y divide-gray-800` to eliminate post borders in threads
- Added blue left border to main/focused post
- Removed extra styling from reply posts (no backgrounds or special padding)
- Added proper reply section separator with border and background
- Pass correct props to PostCardNative for context-aware rendering

### 3. Visual Changes
- **Feed View**: 
  - Posts that are replies now show "Reply to @handle" indicator
  - Card styling preserved with hover effects
  
- **Thread View**:
  - No borders between posts - they flow together
  - Main post has blue left accent border and larger text
  - Parent posts are slightly compressed with smaller text
  - Thread lines connect avatars properly
  - Reply section has clear separator

## Implementation Details

### Reply Indicator (Feed View)
```jsx
{!isInThread && item.reply && (
  <div className="flex items-center gap-1.5 px-4 pt-2 text-gray-500 text-sm">
    <div className="w-12" /> {/* Spacer to align with avatar */}
    <MessageCircle size={12} />
    <span>Reply to @{item.reply.parent.author.handle}</span>
  </div>
)}
```

### Conditional Post Styling
```jsx
className={`relative cursor-pointer transition-colors ${
  isInThread 
    ? isMainPost 
      ? 'px-4 py-4' 
      : isParentPost 
        ? 'px-4 py-2 opacity-90' 
        : 'px-4 py-3'
    : 'bg-gray-900 hover:bg-gray-800/50 px-4 py-3'
}`}
```

### Thread Line Positioning
```jsx
{isThreadChild && (
  <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-700" />
)}
```

## Testing
Created `scripts/test-thread-styling.js` to verify the styling changes work correctly in both feed and thread views.

## Next Steps
- Fine-tune thread line connections for nested replies
- Add animation transitions between feed and thread views
- Consider adding subtle hover states for thread posts
- Implement keyboard navigation highlighting