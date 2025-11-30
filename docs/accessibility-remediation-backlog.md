# Accessibility Remediation Backlog

**Created:** November 29, 2025
**Based on:** WCAG 2.1 AA Accessibility Audit

This document provides a prioritized backlog of accessibility issues to remediate, with implementation details and acceptance criteria.

---

## Priority Levels

| Level         | Description                                   | SLA                  |
| ------------- | --------------------------------------------- | -------------------- |
| P1 - Critical | Blocks users from completing core tasks       | Immediate (1-3 days) |
| P2 - Serious  | Significant barriers for assistive tech users | 1-2 weeks            |
| P3 - Moderate | Impacts user experience but has workarounds   | 2-4 weeks            |
| P4 - Minor    | Best practice improvements                    | 4-8 weeks            |

---

## Backlog Items

### P1-001: Video Caption Support

**WCAG:** 1.2.2 (Captions - Prerecorded)
**Severity:** Critical
**Component:** `src/components/VideoPlayer.tsx`

**Problem:** Videos in posts have no caption/subtitle support, making video content inaccessible to deaf/hard of hearing users.

**Acceptance Criteria:**

- [ ] Video player supports WebVTT caption files
- [ ] Captions toggle button in controls
- [ ] Caption settings (size, color, background)
- [ ] Auto-detect available caption tracks

**Implementation Notes:**

```tsx
// Add to VideoPlayer state
const [showCaptions, setShowCaptions] = useState(true);
const [captionTrack, setCaptionTrack] = useState<TextTrack | null>(null);

// Add track element to video
<video>
  <track
    kind="captions"
    src={captionUrl}
    srcLang="en"
    label="English"
    default={showCaptions}
  />
</video>;
```

**Effort:** High (8-12 hours)

---

### P1-002: Skip to Main Content Link

**WCAG:** 2.4.1 (Bypass Blocks)
**Severity:** Critical
**Component:** `src/App.tsx`

**Problem:** Keyboard users must tab through the entire navigation to reach main content. CSS for skip link exists but not implemented.

**Acceptance Criteria:**

- [ ] Skip link is first focusable element
- [ ] Skip link becomes visible on focus
- [ ] Skip link navigates to main content area
- [ ] Main content area has proper id and tabIndex

**Implementation Notes:**

```tsx
// In App.tsx, add before sidebar
<a
  href="#main-content"
  className="skip-link"
  aria-label="Skip to main content"
>
  Skip to main content
</a>

// Wrap main content
<main id="main-content" tabIndex={-1} role="main">
  {/* Route content */}
</main>
```

**Effort:** Low (1-2 hours)

---

### P2-001: Search Input Labels

**WCAG:** 1.3.1 (Info and Relationships)
**Severity:** Serious
**Component:** `src/components/Search.tsx`

**Problem:** Search input and filter inputs lack proper label associations.

**Acceptance Criteria:**

- [ ] Main search input has associated label (visible or sr-only)
- [ ] Date filter inputs have labels
- [ ] Media filter selects have labels
- [ ] All labels use htmlFor/id association

**Implementation Notes:**

```tsx
// Line ~783 - Main search input
<label htmlFor="main-search" className="sr-only">
  Search posts and users
</label>
<input
  id="main-search"
  type="text"
  placeholder="Search..."
  aria-describedby="search-instructions"
/>
<span id="search-instructions" className="sr-only">
  Press Enter to search
</span>

// Lines ~1314-1360 - Date filters
<label htmlFor="date-from" className="sr-only">
  From date
</label>
<input
  id="date-from"
  type="date"
  aria-label="Start date for search filter"
/>
```

**Effort:** Medium (3-4 hours)

---

### P2-002: Keyboard Drag and Drop Alternative

**WCAG:** 2.1.1 (Keyboard)
**Severity:** Serious
**Component:** `src/components/Composer.tsx`

**Problem:** Media reordering in composer only works via drag-and-drop, inaccessible to keyboard users.

**Acceptance Criteria:**

- [ ] Keyboard users can reorder media attachments
- [ ] Up/Down arrow keys or button controls available
- [ ] Screen reader announces position changes
- [ ] Focus remains on moved item

**Implementation Notes:**

```tsx
// Add keyboard handlers to media items
const handleKeyDown = (e: KeyboardEvent, index: number) => {
  if (e.key === "ArrowUp" && index > 0) {
    e.preventDefault();
    moveItem(index, index - 1);
    announceMove(`Moved to position ${index}`);
  } else if (e.key === "ArrowDown" && index < items.length - 1) {
    e.preventDefault();
    moveItem(index, index + 1);
    announceMove(`Moved to position ${index + 2}`);
  }
};

// Add move buttons as alternative
<button
  onClick={() => moveItem(index, index - 1)}
  disabled={index === 0}
  aria-label="Move up"
>
  <ChevronUp size={16} />
</button>;
```

**Effort:** High (6-8 hours)

---

### P2-003: Status Announcements for Post Actions

**WCAG:** 4.1.3 (Status Messages)
**Severity:** Serious
**Component:** `src/components/PostRenderer.tsx`

**Problem:** When users like, repost, or bookmark a post, the action result is not announced to screen reader users.

**Acceptance Criteria:**

- [ ] Like/unlike action announces result
- [ ] Repost action announces result
- [ ] Bookmark action announces result
- [ ] Errors are announced immediately

**Implementation Notes:**

```tsx
// Add live region to PostRenderer
const [announcement, setAnnouncement] = useState("");

// In component return
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {announcement}
</div>;

// In handlers
const handleLike = async () => {
  try {
    await onLike?.();
    setAnnouncement(post.viewer?.like ? "Post unliked" : "Post liked");
  } catch {
    setAnnouncement("Failed to update like status");
  }
};
```

**Effort:** Medium (3-4 hours)

---

### P2-004: Dynamic Page Titles

**WCAG:** 2.4.2 (Page Titled)
**Severity:** Serious
**Component:** Router configuration

**Problem:** Page title doesn't change when navigating, making it hard for screen reader users to know current location.

**Acceptance Criteria:**

- [ ] Each route has unique, descriptive title
- [ ] Title updates on route change
- [ ] Title includes app name suffix
- [ ] Dynamic content includes context (e.g., user handle)

**Implementation Notes:**

```tsx
// Create usePageTitle hook
export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = title ? `${title} | ShadowSky` : "ShadowSky";
  }, [title]);
};

// In each page component
const ProfilePage = () => {
  const { handle } = useParams();
  usePageTitle(`@${handle}'s Profile`);
  // ...
};
```

**Effort:** Medium (4-5 hours)

---

### P3-001: Article Role for Posts

**WCAG:** 1.3.1 (Info and Relationships)
**Severity:** Moderate
**Component:** `src/components/PostRenderer.tsx`

**Problem:** Post items in feed don't use article role, reducing screen reader navigation efficiency.

**Acceptance Criteria:**

- [ ] Each post uses `<article>` element or role="article"
- [ ] Article has accessible name (aria-label or aria-labelledby)
- [ ] Feed container uses role="feed"

**Implementation Notes:**

```tsx
// In PostRenderer.tsx ~Line 711
<article
  aria-labelledby={`post-author-${post.cid}`}
  className="..."
>
  <div id={`post-author-${post.cid}`} className="sr-only">
    Post by {post.author.displayName || post.author.handle}
  </div>
  {/* Post content */}
</article>

// In parent feed component
<div role="feed" aria-label="Posts feed" aria-busy={isLoading}>
  {posts.map(post => <PostRenderer key={post.cid} post={post} />)}
</div>
```

**Effort:** Low (2-3 hours)

---

### P3-002: Non-Color Status Indicators

**WCAG:** 1.4.1 (Use of Color)
**Severity:** Moderate
**Component:** `src/components/PostRenderer.tsx`

**Problem:** Like and repost status indicated by color alone (red for liked, green for reposted).

**Acceptance Criteria:**

- [ ] Liked state has icon fill/stroke change in addition to color
- [ ] Reposted state has icon style change in addition to color
- [ ] Color blind users can distinguish states
- [ ] High contrast mode shows clear distinction

**Implementation Notes:**

```tsx
// For like button - use filled heart when liked
{
  post.viewer?.like ? (
    <Heart className="fill-current" /> // Filled
  ) : (
    <Heart className="" /> // Outline only
  );
}

// For repost button - add visual indicator
{
  post.viewer?.repost ? (
    <Repeat2 className="stroke-[2.5px]" /> // Thicker stroke
  ) : (
    <Repeat2 className="stroke-[1.5px]" />
  );
}
```

**Effort:** Low (1-2 hours)

---

### P3-003: Video Controls Timeout Setting

**WCAG:** 2.2.1 (Timing Adjustable)
**Severity:** Moderate
**Component:** `src/components/VideoPlayer.tsx`

**Problem:** Video controls auto-hide after 3 seconds with no user control.

**Acceptance Criteria:**

- [ ] User can disable auto-hide in accessibility settings
- [ ] Timeout duration is configurable
- [ ] Controls stay visible when focus is inside control bar

**Implementation Notes:**

```tsx
// In AccessibilityContext, add setting
videoControlsTimeout: "auto" | "extended" | "never";

// In VideoPlayer.tsx
const { settings } = useAccessibility();
const timeoutDuration =
  settings.videoControlsTimeout === "never"
    ? null
    : settings.videoControlsTimeout === "extended"
      ? 10000
      : 3000;

useEffect(() => {
  if (showControls && isPlaying && timeoutDuration) {
    // ... existing timeout logic
  }
}, [showControls, isPlaying, timeoutDuration]);
```

**Effort:** Medium (2-3 hours)

---

### P3-004: Form Validation Announcements

**WCAG:** 3.3.1 (Error Identification)
**Severity:** Moderate
**Component:** `src/components/Composer.tsx`

**Problem:** Character count validation not announced to screen readers.

**Acceptance Criteria:**

- [ ] Character count announced when approaching limit
- [ ] Error announced when limit exceeded
- [ ] Uses aria-live for dynamic updates
- [ ] Provides clear error message

**Implementation Notes:**

```tsx
// Add aria-live region for character count
<div
  aria-live="polite"
  aria-atomic="true"
  className={characterCount > 280 ? "text-red-500" : "sr-only"}
>
  {characterCount > 250 &&
    characterCount <= 280 &&
    `${280 - characterCount} characters remaining`}
  {characterCount > 280 && `${characterCount - 280} characters over limit`}
</div>
```

**Effort:** Low (1-2 hours)

---

### P3-005: Swipe Action Alternatives

**WCAG:** 2.5.1 (Pointer Gestures)
**Severity:** Moderate
**Component:** `src/components/SwipeIndicator.tsx`

**Problem:** Swipe gestures have no single-point alternative for users who cannot perform complex gestures.

**Acceptance Criteria:**

- [ ] Visible button alternative for swipe actions
- [ ] Button appears on long press or as always-visible option
- [ ] Same functionality as swipe gesture

**Implementation Notes:**

```tsx
// Add button alternative
<div className="swipe-container">
  {/* Existing swipe area */}
  <button
    className="action-button"
    onClick={handleSwipeAction}
    aria-label="Perform action"
  >
    Action
  </button>
</div>
```

**Effort:** Medium (3-4 hours)

---

### P4-001: Improved Avatar Alt Text

**WCAG:** 1.1.1 (Non-text Content)
**Severity:** Minor
**Component:** `src/components/PostRenderer.tsx`

**Problem:** Avatar images use handle as alt text, could be more descriptive.

**Acceptance Criteria:**

- [ ] Alt text includes user's display name if available
- [ ] Alt text is contextually appropriate
- [ ] Decorative avatars (repeated) use empty alt

**Implementation Notes:**

```tsx
// Line ~761
<img
  src={post.author.avatar}
  alt={`${post.author.displayName || post.author.handle}'s avatar`}
/>

// For repeated/decorative avatars
<img src={avatar} alt="" role="presentation" />
```

**Effort:** Low (1 hour)

---

### P4-002: Decorative Icon aria-hidden

**WCAG:** 1.1.1 (Non-text Content)
**Severity:** Minor
**Component:** Various

**Problem:** Some decorative icons not marked with aria-hidden, causing screen reader noise.

**Acceptance Criteria:**

- [ ] All decorative icons have aria-hidden="true"
- [ ] Icons with meaning have accessible text alternative

**Implementation Notes:**

```tsx
// Decorative icon (next to text label)
<Home aria-hidden="true" /> Home

// Meaningful icon (standalone)
<button aria-label="Go to home">
  <Home aria-hidden="true" />
</button>
```

**Effort:** Low (2-3 hours for full audit)

---

### P4-003: Menu Button Aria Labels

**WCAG:** 1.1.1 (Non-text Content)
**Severity:** Minor
**Component:** `src/components/PostRenderer.tsx`

**Problem:** Post menu button lacks descriptive aria-label.

**Acceptance Criteria:**

- [ ] Menu button has aria-label including context
- [ ] Aria-expanded state reflects menu visibility
- [ ] Aria-haspopup indicates menu presence

**Implementation Notes:**

```tsx
// Line ~800-809
<button
  aria-label={`More options for post by ${post.author.displayName || post.author.handle}`}
  aria-expanded={isMenuOpen}
  aria-haspopup="menu"
>
  <MoreHorizontal aria-hidden="true" />
</button>
```

**Effort:** Low (1 hour)

---

## Progress Tracking

### Phase 1 (Week 1)

- [ ] P1-001: Video Caption Support
- [ ] P1-002: Skip to Main Content Link

### Phase 2 (Week 2-3)

- [ ] P2-001: Search Input Labels
- [ ] P2-002: Keyboard Drag and Drop Alternative
- [ ] P2-003: Status Announcements for Post Actions
- [ ] P2-004: Dynamic Page Titles

### Phase 3 (Week 4-6)

- [ ] P3-001: Article Role for Posts
- [ ] P3-002: Non-Color Status Indicators
- [ ] P3-003: Video Controls Timeout Setting
- [ ] P3-004: Form Validation Announcements
- [ ] P3-005: Swipe Action Alternatives

### Phase 4 (Week 7-8)

- [ ] P4-001: Improved Avatar Alt Text
- [ ] P4-002: Decorative Icon aria-hidden
- [ ] P4-003: Menu Button Aria Labels

---

## Definition of Done

For each item to be considered complete:

1. Code changes implemented
2. Manual testing with keyboard navigation passed
3. Screen reader testing (VoiceOver) passed
4. High contrast mode verified
5. Unit/integration tests added where applicable
6. Code reviewed and merged
7. Item checked off in progress tracking

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN ARIA Authoring Practices](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [axe-core Documentation](https://www.deque.com/axe/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
