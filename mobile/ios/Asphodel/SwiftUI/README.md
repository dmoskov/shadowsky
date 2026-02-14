# SwiftUI Feed Implementation

This directory contains the native SwiftUI implementation of the feed list, replacing the React Native FlatList with a performant native iOS solution.

## Overview

The SwiftUI feed implementation provides a native iOS experience with efficient virtualization, smooth scrolling, and native iOS patterns like pull-to-refresh.

## Architecture

```
SwiftUI/
├── Models/
│   └── ATProtocolModels.swift    # Swift models for AT Protocol data types
├── Utils/
│   └── ContentFilter.swift       # Muted word filtering logic
└── Views/
    ├── FeedList.swift             # Main feed list view
    └── PostCard.swift             # Individual post card (placeholder)
```

## Components

### FeedList.swift

The main feed list component that replaces the React Native FlatList implementation.

**Features:**
- ✅ Efficient virtualization using `LazyVStack` for smooth scrolling with 100+ posts
- ✅ Pull-to-refresh with `.refreshable` modifier
- ✅ Infinite scroll with pagination trigger at 0.5 threshold
- ✅ Loading state with skeleton cards
- ✅ Error state with retry functionality
- ✅ Empty state
- ✅ Muted word filtering
- ✅ Haptic feedback on refresh
- ✅ Dark background (#0a0a0f)

**Performance Optimizations:**
- Uses `LazyVStack` for lazy loading (only renders visible items)
- Posts keyed by `post.uri` for efficient diffing
- Pagination trigger calculated based on scroll position
- Optimized for smooth scrolling even with large datasets

**Usage:**
```swift
let props = FeedListProps(
    posts: posts,
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    error: nil,
    emptyMessage: "No posts yet",
    feedType: "home",
    mutedWords: mutedWords,
    isOnline: true,
    onRefresh: { refreshFeed() },
    onLoadMore: { loadMorePosts() },
    onPostPress: { post in openPost(post) },
    onProfilePress: { handle in openProfile(handle) },
    onLike: { post in likePost(post) },
    onRepost: { post in repostPost(post) },
    onReply: { post in replyToPost(post) },
    onBookmark: { post in bookmarkPost(post) },
    isBookmarked: { uri in isPostBookmarked(uri) },
    onMentionPress: { handle, did in openMention(handle, did) },
    onHashtagPress: { tag in openHashtag(tag) }
)

FeedList(props: props)
```

### PostCard.swift

**Status:** Placeholder implementation - depends on Task 2

The PostCard view is a simplified placeholder that will be replaced by the full implementation from Task 2 (PostCard SwiftUI view). The current implementation includes:
- Basic post header with avatar and author info
- Post text content
- Action buttons (reply, repost, like, bookmark)
- Timestamp formatting

**TODO (Task 2):**
- Full rich text rendering with facets (mentions, links, hashtags)
- Embedded content rendering (depends on Task 3)
- Avatar image loading
- Proper interaction handling
- Content warnings and labels
- Quote post rendering

### ATProtocolModels.swift

Swift models representing AT Protocol data types:
- `FeedViewPost` - A post in the feed
- `Post` - Post metadata and content
- `PostRecord` - Post text and formatting
- `ProfileViewBasic` - Author information
- `ViewerState` - User's interaction state
- `Facet` - Rich text features (mentions, links, hashtags)
- `PostEmbed` - Embedded content (images, videos, external links, quotes)
- And more...

### ContentFilter.swift

Content filtering utility for muted words, ported from the TypeScript implementation.

**Features:**
- Muted word expiration handling
- Hashtag matching with word boundaries
- Phrase matching (multi-word)
- Single word matching with word boundaries
- Feed type filtering (home vs. other)
- Case-insensitive matching
- Text extraction from posts including embeds

**Usage:**
```swift
// Filter posts
let filtered = ContentFilter.filterMutedPosts(
    posts: posts,
    mutedWords: mutedWords,
    feedType: "home"
)

// Check if a single post is muted
let isMuted = ContentFilter.isPostMuted(
    post: post,
    mutedWords: mutedWords,
    feedType: "home"
)
```

## React Native Equivalence

This SwiftUI implementation matches the React Native FlatList behavior:

| React Native | SwiftUI | Status |
|--------------|---------|--------|
| `FlatList` | `LazyVStack` in `ScrollView` | ✅ |
| `removeClippedSubviews={true}` | Native lazy loading | ✅ |
| `maxToRenderPerBatch={10}` | Native virtualization | ✅ |
| `windowSize={7}` | Native memory management | ✅ |
| `initialNumToRender={10}` | Native initial render | ✅ |
| `updateCellsBatchingPeriod={50}` | Native batching | ✅ |
| `RefreshControl` | `.refreshable` modifier | ✅ |
| `onEndReached` (threshold 0.5) | Scroll position trigger | ✅ |
| `ListEmptyComponent` | Empty state view | ✅ |
| `ListFooterComponent` | Loading more indicator | ✅ |
| `keyExtractor` | `.id()` modifier | ✅ |
| Filter muted posts | `ContentFilter.filterMutedPosts()` | ✅ |

## Dependencies

This implementation depends on:
- **Task 2:** Full PostCard SwiftUI view implementation
- **Task 3:** Embed views (images, videos, external links, quotes)

Until these dependencies are completed, the FeedList uses placeholder implementations.

## Integration

To integrate this SwiftUI view into a React Native app, you'll need:
1. A React Native bridge/module to expose the SwiftUI view
2. Props marshalling between React Native and Swift
3. Callback handling from SwiftUI back to React Native

Alternatively, this can be used in a pure SwiftUI iOS app by providing the necessary data and callbacks.

## Performance

The implementation is optimized for performance:
- **Virtualization:** Only visible posts are rendered
- **Efficient Diffing:** Posts are keyed by URI for stable identity
- **Lazy Loading:** Posts load as you scroll
- **Memory Management:** Native SwiftUI memory management
- **Smooth Scrolling:** 60fps target with native rendering

Expected to handle 100+ posts smoothly, matching or exceeding React Native FlatList performance.

## Testing

The implementation includes SwiftUI Previews for development:
```bash
# Open in Xcode
open mobile/ios/Asphodel.xcworkspace

# Select FeedList.swift
# Open the preview canvas (⌥⌘↩)
```

## Future Enhancements

Once Tasks 2 and 3 are complete:
- [ ] Replace placeholder PostCard with full implementation
- [ ] Add embed rendering (images, videos, external links)
- [ ] Add rich text rendering with facets
- [ ] Add image viewer modal
- [ ] Add video player
- [ ] Add accessibility labels and hints
- [ ] Add unit tests
- [ ] Add UI tests
- [ ] Performance profiling with Instruments

## Notes

- The background color `#0a0a0f` matches the app's dark theme
- Haptic feedback is triggered on pull-to-refresh
- The loading indicator respects online/offline state
- All SwiftUI views use the `.preferredColorScheme(.dark)` for dark mode
