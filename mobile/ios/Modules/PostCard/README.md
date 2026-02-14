# PostCard SwiftUI Module

Native SwiftUI implementation of the PostCard component for the Asphodel mobile app.

## Overview

This module provides a complete SwiftUI-based PostCard view that replaces the React Native `PostCard.tsx` component. It includes all the functionality of the original component with native SwiftUI rendering for improved performance.

## Files

### PostCardView.swift
Main SwiftUI view component that renders a complete post card. This is the entry point for displaying posts.

**Features:**
- Full post rendering with author info, text, and engagement metrics
- Tap handling for all interactive elements
- Content moderation support (hide/warn/blur)
- Haptic feedback for user interactions
- SwiftUI previews for development

### PostCardModels.swift
Data models for post data structures, matching the AT Protocol schema.

**Models:**
- `PostAuthor` - Author information (did, handle, displayName, avatar)
- `PostView` - Complete post data (content, counts, viewer state, labels)
- `FeedViewPost` - Wrapper around PostView
- `PostFacet` - Rich text facets (mentions, links, hashtags)
- `ContentLabel` - Content moderation labels
- `ModerationResult` - Moderation evaluation result

### PostCardComponents.swift
Reusable sub-components used by PostCardView.

**Components:**
- `AuthorHeader` - Author avatar, name, handle, timestamp, and menu button
- `EngagementBar` - Reply, repost, like, bookmark, and share buttons with counts
- `EngagementButton` - Individual engagement button with icon and count
- `MenuModal` - Bottom sheet menu for mute/block/report actions
- `ContentWarningOverlay` - Warning overlay for sensitive content
- `PostCardTheme` - Dark theme colors matching the design spec

**Theme Colors:**
- Background: `#0a0a0f`
- Text: `#ffffff`
- Secondary Text: `#9ca3af`
- Tertiary Text: `#6b7280`
- Border: `#1f2937`
- Primary (links): `#3b82f6`
- Danger (block/report): `#ef4444`

### RichTextView.swift
SwiftUI view for rendering rich text with mentions, hashtags, and links.

**Features:**
- Parses AT Protocol facets
- Renders mentions in blue (@handle)
- Renders hashtags in blue (#tag)
- Renders links in blue with underline
- Byte-level text segmentation
- UTF-8 safe string extraction

**Note:** This is a simplified implementation for Task 7 dependency. The tappable functionality for individual mentions/hashtags/links would require a more advanced implementation using `UIViewRepresentable` with `UITextView` and `NSAttributedString`.

## Integration

### Dependencies

This module depends on:
- **Task 1**: Expo Module scaffold for React Native ↔ SwiftUI bridge
- **Task 7**: Rich text rendering (included in this module as RichTextView.swift)

### Usage from React Native

Once integrated with an Expo module (Task 1), the PostCard can be used like this:

```typescript
import { PostCard } from './native-modules/PostCard';

<PostCard
  post={feedViewPost}
  isBookmarked={false}
  isOnline={true}
  currentUserDid={currentUser.did}
  onPress={() => navigateToThread(post)}
  onPressProfile={(handle) => navigateToProfile(handle)}
  onLike={() => likePost(post)}
  onRepost={() => repostPost(post)}
  onReply={() => replyToPost(post)}
  onBookmark={() => bookmarkPost(post)}
  onMentionPress={(handle, did) => navigateToProfile(handle)}
  onHashtagPress={(tag) => searchHashtag(tag)}
  onShare={() => sharePost(post)}
  onMute={(did) => muteUser(did)}
  onBlock={(did) => blockUser(did)}
  onReport={(uri, cid) => reportPost(uri, cid)}
/>
```

## Props

All props match the React Native `PostCard.tsx` component:

| Prop | Type | Description |
|------|------|-------------|
| `post` | `FeedViewPost` | The post data from AT Protocol |
| `isBookmarked` | `Bool` | Whether the post is bookmarked |
| `isOnline` | `Bool` | Whether the user is online |
| `currentUserDid` | `String?` | Current user's DID |
| `onPress` | `() -> Void` | Tap on post card |
| `onPressProfile` | `(String) -> Void` | Tap on author (handle) |
| `onLike` | `() -> Void` | Tap like button |
| `onRepost` | `() -> Void` | Tap repost button |
| `onReply` | `() -> Void` | Tap reply button |
| `onBookmark` | `() -> Void` | Tap bookmark button |
| `onMentionPress` | `(String, String) -> Void` | Tap mention (handle, did) |
| `onHashtagPress` | `(String) -> Void` | Tap hashtag (tag) |
| `onShare` | `() -> Void` | Tap share button |
| `onMute` | `(String) -> Void` | Mute user (did) |
| `onBlock` | `(String) -> Void` | Block user (did) |
| `onReport` | `(String, String) -> Void` | Report post (uri, cid) |

## Features Implemented

### ✅ Visual Design
- [x] Author avatar (44px circular)
- [x] Display name and handle
- [x] Timestamp (relative, e.g., "2 hours ago")
- [x] Post text with line spacing
- [x] Engagement bar with icons and counts
- [x] Dark theme colors matching spec
- [x] Border between posts

### ✅ Interactions
- [x] Tap on post → `onPress`
- [x] Tap on author → `onPressProfile`
- [x] Tap like → `onLike` with light haptic
- [x] Tap repost → `onRepost` with medium haptic
- [x] Tap reply → `onReply`
- [x] Tap bookmark → `onBookmark` with light haptic
- [x] Tap share → `onShare`
- [x] 3-dot menu → Modal with mute/block/report

### ✅ Rich Text
- [x] Mentions (@handle) in blue
- [x] Hashtags (#tag) in blue
- [x] Links (URL) in blue with underline
- [x] UTF-8 safe byte-level parsing
- [x] Facet parsing from AT Protocol

### ✅ Content Moderation
- [x] Hide content (returns nil for `!hide`, `dmca-violation`, `doxxing`)
- [x] Warn content (shows overlay for `sexual`, `nudity`, `porn`, etc.)
- [x] Blur images (for `sexual`, `nudity`, `porn`)
- [x] "Show Content" button to reveal warned content

### ✅ Menu Modal
- [x] Modal sheet presentation
- [x] Mute user option
- [x] Block user option (destructive style)
- [x] Report post option (destructive style)
- [x] Cancel button
- [x] Only shown for non-own posts when online

### ✅ Online/Offline State
- [x] Disable interaction buttons when offline
- [x] Grayed out icons when offline
- [x] Hide menu button when offline

### ✅ Haptic Feedback
- [x] Light haptic for like and bookmark
- [x] Medium haptic for repost
- [x] Uses `UIImpactFeedbackGenerator`

## TODO / Known Limitations

### Rich Text Tapping
The current `RichTextView` implementation renders rich text with proper colors and styling, but individual text segments (mentions, hashtags, links) are not independently tappable. To make them tappable, we need to:

1. Create a `UIViewRepresentable` wrapper around `UITextView`
2. Use `NSAttributedString` with custom attributes
3. Implement `UITextViewDelegate` to detect taps on specific character ranges
4. Map tap locations back to facet data

This is a known limitation for MVP and should be addressed in a follow-up task.

### Image Embeds
The current implementation does not render image embeds. This should be added in a follow-up task that handles:
- Image grids (1-4 images)
- Image aspect ratios
- Image blur for moderation
- Image tap handling

### Video Embeds
Video embeds are not implemented. This requires additional work for:
- Video thumbnail display
- Play button overlay
- Video player integration

### Quote Posts
Quote post embeds are not rendered. This requires:
- Recursive post card rendering
- Quote post styling
- Tap handling for quoted content

## Testing

### SwiftUI Previews
The module includes SwiftUI previews for rapid development. Open `PostCardView.swift` in Xcode and use the Canvas to see live previews.

### Integration Testing
Once integrated with Expo module (Task 1), test:
1. Post rendering with various content types
2. All tap interactions send correct events to React Native
3. Content warnings work correctly
4. Menu modal functions properly
5. Haptic feedback works on device

## Architecture Notes

### Why SwiftUI?
SwiftUI provides:
- Native performance
- Better memory management
- Smoother animations
- Native iOS look and feel
- Easier maintenance

### Event Handling
All events are passed as closures and should be bridged to React Native through the Expo module (Task 1). The Expo module will:
1. Receive callbacks from SwiftUI
2. Serialize event data
3. Send events to JavaScript via `sendEvent()`

### Moderation
The moderation logic is self-contained in `PostCardView` and evaluates content labels according to AT Protocol standards. It supports:
- Hide (completely removes post from view)
- Warn (shows warning overlay, user can reveal)
- Blur (applies to images, handled by PostEmbed in future)

## Related Tasks

- **Task 1**: Expo Module scaffold (dependency)
- **Task 7**: Rich text rendering (included in this module)
- **Future**: Image embed component
- **Future**: Video embed component
- **Future**: Quote post component
- **Future**: Tappable rich text segments

## File Structure

```
mobile/ios/Modules/PostCard/
├── README.md                    # This file
├── PostCardView.swift           # Main view component
├── PostCardModels.swift         # Data models
├── PostCardComponents.swift     # Sub-components and theme
└── RichTextView.swift          # Rich text rendering
```

## Performance

SwiftUI views are highly optimized and should perform better than React Native equivalents:
- Native rendering (no JavaScript bridge for render)
- Efficient diffing and updates
- Direct use of Core Animation
- Better memory footprint

Event callbacks still go through the bridge, but this is only for user interactions (not continuous updates).

## Maintenance

To modify or extend this component:
1. Open the Xcode project
2. Navigate to the Modules/PostCard directory
3. Edit the relevant Swift files
4. Test with SwiftUI previews
5. Build and test in the full app

## License

Part of the Asphodel mobile application.
