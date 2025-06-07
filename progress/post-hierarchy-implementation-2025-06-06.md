# Post Hierarchy Implementation Plan
Date: June 6, 2025
Based on: post-hierarchy-critique-2025-06-06.md
Type: Detailed Implementation Guide

## 1. Executive Summary

### Key Improvements to Conversation/Thread UX
- **Visual Thread Hierarchy**: Implement indentation and connecting lines to show conversation structure
- **Reply Context**: Add clear indicators showing who is replying to whom
- **Thread Navigation**: Floating context bar and jump-to navigation for long threads
- **Quoted Post Enhancement**: Better interaction model with engagement previews
- **Information Density**: Compact view option for power users

### Expected Impact on User Engagement
- **50% reduction** in time to understand thread structure
- **30% increase** in thread participation due to clearer context
- **40% reduction** in mis-targeted replies
- **25% increase** in quoted post interactions

### Implementation Timeline
- **Week 1**: Critical fixes (thread hierarchy, reply context)
- **Week 2**: Quick wins (navigation, visual improvements)
- **Week 3**: Major features (compact mode, advanced navigation)

## 2. Priority Implementation Order

### Immediate Fixes (2 hours)
1. **Reply Context Indicator**
   - Add "Replying to @username" text
   - Technical complexity: Low
   - Dependencies: None

2. **Parent Post Border Enhancement**
   - Strengthen visual distinction
   - Technical complexity: Low
   - Dependencies: None

### Quick Wins (1 day)
1. **Basic Thread Indentation**
   - 20px indentation per level
   - Technical complexity: Medium
   - Dependencies: Thread data structure

2. **Thread Connecting Lines**
   - Vertical lines between posts
   - Technical complexity: Medium
   - Dependencies: Basic indentation

3. **Participant Avatars**
   - Show thread participants at top
   - Technical complexity: Low
   - Dependencies: Thread data

### Major Features (1 week)
1. **Floating Context Bar**
   - Persistent parent post preview
   - Technical complexity: High
   - Dependencies: Scroll handling

2. **Compact View Mode**
   - User preference for density
   - Technical complexity: High
   - Dependencies: Settings system

3. **Thread Navigation Menu**
   - Jump-to functionality
   - Technical complexity: High
   - Dependencies: Thread structure analysis

## 3. Detailed Implementation Tasks

### 3.1 Reply Context Indicator

**Feature**: Show who each post is replying to

**Implementation Steps**:
1. Modify `PostCard.tsx` to extract reply parent information
2. Add reply context component above post content
3. Style with subtle gray text and @ mention highlighting

**Code Components to Modify**:
- `/src/components/PostCard.tsx`
- `/src/styles/post-card.css`

**CSS Requirements**:
```css
.reply-context {
  font-size: 13px;
  color: var(--gray-500);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.reply-context-icon {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}

.reply-context-username {
  color: var(--blue-400);
  text-decoration: none;
}
```

**Example Code Snippet**:
```tsx
// In PostCard.tsx
const ReplyContext = ({ post }: { post: PostView }) => {
  if (!post.record.reply?.parent) return null;
  
  const parentAuthor = post.record.reply.parent.author;
  
  return (
    <div className="reply-context">
      <svg className="reply-context-icon" viewBox="0 0 24 24">
        <path d="M9 16h6v-6h4l-7-7-7 7h4z" />
      </svg>
      <span>Replying to</span>
      <a href={`/profile/${parentAuthor.handle}`} className="reply-context-username">
        @{parentAuthor.handle}
      </a>
    </div>
  );
};
```

**Accessibility**: Add aria-label="Reply to {username}"

### 3.2 Visual Thread Hierarchy

**Feature**: Indentation and connecting lines for nested replies

**Implementation Steps**:
1. Calculate reply depth from thread data
2. Apply dynamic margin-left based on depth
3. Add CSS pseudo-elements for connecting lines

**Code Components to Modify**:
- `/src/components/Feed.tsx`
- `/src/components/PostCard.tsx`
- `/src/styles/thread.css`

**CSS Requirements**:
```css
.thread-post {
  position: relative;
  margin-left: calc(var(--thread-depth, 0) * 20px);
}

.thread-line {
  position: absolute;
  left: -10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--gray-700);
  border-radius: 1px;
}

.thread-line::before {
  content: '';
  position: absolute;
  top: 30px;
  left: 0;
  width: 10px;
  height: 2px;
  background: var(--gray-700);
}

.thread-post:last-child .thread-line {
  height: 30px;
}
```

**Example Code Snippet**:
```tsx
// In Feed.tsx
const ThreadPost = ({ post, depth = 0 }: { post: PostView; depth: number }) => {
  return (
    <div 
      className="thread-post" 
      style={{ '--thread-depth': depth } as React.CSSProperties}
    >
      {depth > 0 && <div className="thread-line" />}
      <PostCard post={post} isInThread={true} />
    </div>
  );
};
```

### 3.3 Quoted Post Enhancements

**Feature**: Better interaction model for quoted posts

**Implementation Steps**:
1. Add engagement metrics preview
2. Add "View original thread" button
3. Enhance visual distinction

**Code Components to Modify**:
- `/src/components/PostCard.tsx` (QuotedPost section)
- `/src/styles/post-card.css`

**CSS Requirements**:
```css
.quoted-post {
  border: 1px solid var(--gray-700);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
  background: var(--gray-900);
  position: relative;
  transition: border-color 0.2s;
}

.quoted-post:hover {
  border-color: var(--gray-600);
}

.quoted-post-metrics {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--gray-500);
}

.view-thread-button {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 12px;
  color: var(--blue-400);
  background: var(--gray-800);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--gray-700);
}
```

### 3.4 Floating Context Bar

**Feature**: Persistent parent post preview when scrolling

**Implementation Steps**:
1. Create FloatingContextBar component
2. Implement scroll position detection
3. Show/hide based on parent post visibility

**Code Components to Create**:
- `/src/components/FloatingContextBar.tsx`

**Example Code Snippet**:
```tsx
const FloatingContextBar = ({ parentPost }: { parentPost: PostView }) => {
  const [isVisible, setIsVisible] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    
    if (parentRef.current) {
      observer.observe(parentRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div className="floating-context-bar">
      <img src={parentPost.author.avatar} alt="" className="context-avatar" />
      <div className="context-content">
        <span className="context-author">{parentPost.author.displayName}</span>
        <span className="context-text">{parentPost.record.value.text.slice(0, 50)}...</span>
      </div>
    </div>
  );
};
```

### 3.5 Compact View Mode

**Feature**: Condensed view for power users

**Implementation Steps**:
1. Add view mode toggle to settings
2. Create compact PostCard variant
3. Store preference in localStorage

**CSS Requirements**:
```css
.post-card-compact {
  padding: 8px 12px;
}

.post-card-compact .post-content {
  font-size: 14px;
  line-height: 1.4;
  max-height: 3.6em;
  overflow: hidden;
}

.post-card-compact .post-media {
  max-height: 100px;
  overflow: hidden;
}

.post-card-compact .engagement-buttons {
  gap: 12px;
}
```

## 4. Visual Design Specifications

### Thread Connection System
- **Line width**: 2px
- **Line color**: `var(--gray-700)` (#374151)
- **Indentation**: 20px per level
- **Max nesting**: 5 levels (then flatten)
- **Corner radius**: 1px for subtle softness

### Reply Context Design
- **Font size**: 13px
- **Color**: `var(--gray-500)` for text, `var(--blue-400)` for usernames
- **Icon size**: 14px
- **Spacing**: 8px below context, 4px between elements

### Quoted Post Enhancement
- **Border**: 1px solid `var(--gray-700)`
- **Background**: `var(--gray-900)` with 0.5 opacity
- **Corner radius**: 12px
- **Hover state**: Border lightens to `var(--gray-600)`
- **Padding**: 12px uniform

### Color System Updates
```css
:root {
  /* Thread indicators */
  --thread-line: #374151;
  --thread-line-hover: #4b5563;
  
  /* Context indicators */
  --reply-context: #6b7280;
  --reply-context-link: #60a5fa;
  
  /* Quoted posts */
  --quote-border: #374151;
  --quote-bg: rgba(17, 24, 39, 0.5);
  --quote-hover: #4b5563;
}
```

### Animation Specifications
- **Thread line appearance**: fade-in 200ms ease-out
- **Indentation**: instant (no animation)
- **Context bar**: slide-down 300ms ease-out
- **Hover states**: 200ms transitions

## 5. Component Architecture

### New Components Needed
1. **ReplyContext.tsx**
   - Displays reply-to information
   - Props: `parentAuthor`, `parentUri`

2. **ThreadLine.tsx**
   - Renders connecting lines
   - Props: `depth`, `isLast`

3. **FloatingContextBar.tsx**
   - Sticky parent post preview
   - Props: `parentPost`, `containerRef`

4. **ThreadNavigator.tsx**
   - Jump-to menu
   - Props: `threadStructure`, `onNavigate`

5. **CompactPostCard.tsx**
   - Condensed post variant
   - Extends PostCard with compact styling

### Modifications to Existing Components

**PostCard.tsx**:
- Add `depth` prop for indentation
- Add `showReplyContext` prop
- Add `viewMode` prop for compact/normal
- Extract reply parent data

**Feed.tsx**:
- Calculate thread depth for each post
- Pass depth to PostCard
- Add thread structure analysis

**ParentPost.tsx**:
- Add ref for intersection observer
- Include in floating context system

### Data Flow Considerations
```typescript
// Thread depth calculation
interface ThreadNode {
  post: PostView;
  depth: number;
  children: ThreadNode[];
}

function buildThreadStructure(posts: PostView[]): ThreadNode[] {
  const postMap = new Map(posts.map(p => [p.uri, p]));
  const rootNodes: ThreadNode[] = [];
  
  // Build tree structure
  posts.forEach(post => {
    if (!post.record.reply?.parent) {
      rootNodes.push({ post, depth: 0, children: [] });
    }
  });
  
  // Calculate depths recursively
  return calculateDepths(rootNodes);
}
```

## 6. Testing Plan

### Test Scenarios for Complex Threads

1. **Deep Nesting Test**
   - Create thread with 10+ levels
   - Verify max depth limiting works
   - Check line rendering at all levels

2. **Multi-Branch Test**
   - Thread with multiple reply branches
   - Verify correct parent-child relationships
   - Test navigation between branches

3. **Deleted Post Handling**
   - Thread with deleted posts
   - Verify lines connect correctly
   - Check context preservation

4. **Mixed Content Test**
   - Thread with text, images, quotes
   - Verify compact mode handles all types
   - Test performance with media

### Edge Cases
- Empty threads (0 replies)
- Single reply threads
- Circular references (if possible)
- Very long post content (1000+ chars)
- Threads with 100+ posts
- Rapid scrolling performance
- Theme switching mid-thread

### Performance Benchmarks
- Thread render time: < 100ms for 50 posts
- Scroll performance: 60fps maintained
- Memory usage: < 50MB for large threads
- Context bar update: < 16ms
- Indentation calculation: < 10ms

### Accessibility Testing
- Screen reader announces reply relationships
- Keyboard navigation through thread branches
- High contrast mode compatibility
- Focus indicators on all interactive elements

## 7. Success Metrics

### Comprehension Metrics
- **Time to understand thread**: Measure via user testing
- **Correct reply targeting**: Track mis-replies
- **Thread completion rate**: % who read entire thread
- **Navigation efficiency**: Actions to reach specific post

### User Engagement Metrics
- **Reply rate increase**: Track before/after
- **Quote interaction rate**: Clicks on quoted posts
- **Thread view duration**: Time spent in threads
- **Return visits to threads**: Re-engagement rate

### Performance Targets
- **Initial render**: < 100ms
- **Scroll performance**: Consistent 60fps
- **Memory usage**: < 10% increase
- **CPU usage**: < 5% increase

### Feature Adoption
- **Compact mode usage**: Target 30% of power users
- **Context bar engagement**: 50% find useful
- **Thread navigation usage**: 40% use jump-to
- **Settings retention**: 90% keep preferences

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Reply context indicator component
- [ ] Basic thread indentation system
- [ ] Thread line rendering
- [ ] Parent post distinction enhancement
- [ ] Update PostCard with depth props

### Phase 2: Enhancements (Week 2)
- [ ] Floating context bar
- [ ] Participant avatar display
- [ ] Quoted post improvements
- [ ] Thread structure analysis
- [ ] Accessibility improvements

### Phase 3: Advanced Features (Week 3)
- [ ] Compact view mode
- [ ] Thread navigation menu
- [ ] User preferences system
- [ ] Performance optimizations
- [ ] Testing and refinement

## Code Integration Points

### CSS File Structure
```
src/styles/
├── thread.css          # Thread-specific styles
├── post-card.css       # Enhanced with thread styles
├── context-bar.css     # Floating context styles
├── compact-mode.css    # Compact view overrides
└── design-system.css   # Updated color variables
```

### Component Import Structure
```typescript
// src/components/Feed.tsx
import { PostCard } from './PostCard';
import { ThreadLine } from './ThreadLine';
import { FloatingContextBar } from './FloatingContextBar';
import { ThreadNavigator } from './ThreadNavigator';
import { buildThreadStructure } from '../utils/thread-utils';
```

### State Management
```typescript
// Thread view state
interface ThreadViewState {
  viewMode: 'normal' | 'compact';
  showFloatingContext: boolean;
  expandedBranches: Set<string>;
  threadStructure: ThreadNode[];
}
```

This implementation plan provides a clear roadmap for enhancing Bluesky's thread and conversation UX. The phased approach allows for incremental improvements while maintaining app stability.