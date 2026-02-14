# Feed Bridge Module

React-to-Swift data serialization layer for AT Protocol feed posts.

## Overview

The Feed Bridge Module provides a complete solution for passing AT Protocol feed data from React (JavaScript/TypeScript) to Swift. It handles:

- Full serialization of `FeedViewPost` data from `@atproto/api`
- All embed types (images, external links, videos, records, recordWithMedia)
- Rich text facets (mentions, hashtags, links)
- Incremental updates for likes, reposts, and bookmarks
- Thread-safe data access in Swift
- Efficient JSON serialization

## Architecture

```
React Query (useTimeline/useCustomFeed)
         ↓
    useFeedSerializer hook
         ↓
  JSON serialization
         ↓
  Expo Native Module
         ↓
   Swift Codable decode
         ↓
  SwiftUI Views (via NotificationCenter)
```

## React/TypeScript Usage

### Basic Feed Serialization

```typescript
import {useTimeline} from '../hooks/api/useFeed';
import {useCompleteFeedSerializer} from '../services/feed-bridge';
import FeedBridge from '../modules/feed-bridge';

function FeedScreen() {
  const timeline = useTimeline();

  // Serialize feed data
  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
    isFromCache: false,
  });

  // Pass to Swift
  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return <SwiftFeedView />;
}
```

### With Bookmark State

```typescript
import {useBookmarks} from '../hooks/useBookmarks';

function FeedScreen() {
  const timeline = useTimeline();
  const {bookmarkedPostUris} = useBookmarks();

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
    bookmarkedPostUris: new Set(bookmarkedPostUris),
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return <SwiftFeedView />;
}
```

### Incremental Updates

```typescript
import {useCompleteFeedSerializer} from '../services/feed-bridge';
import FeedBridge from '../modules/feed-bridge';

function FeedScreen() {
  const timeline = useTimeline();

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
    onIncrementalUpdate: (update) => {
      // Send incremental update to Swift
      const json = JSON.stringify(update);
      FeedBridge.updateFeedIncremental(json);
    },
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return <SwiftFeedView />;
}
```

### Offline Support

```typescript
import {useNetworkStatus} from '../hooks/useNetworkStatus';
import {useOfflineFeedEnhancer} from '../hooks/useOfflineFeed';

function FeedScreen() {
  const {isConnected} = useNetworkStatus();
  const timeline = useTimeline();

  // Enhance with offline support
  const enhancedQuery = useOfflineFeedEnhancer(timeline, 'timeline');

  const {serializedJSON} = useCompleteFeedSerializer(enhancedQuery, {
    isOnline: isConnected,
    isFromCache: enhancedQuery.isServingCached,
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return <SwiftFeedView />;
}
```

## Swift Usage

### SwiftUI View with Feed Data

```swift
import SwiftUI
import ExpoModulesCore

struct FeedView: View {
    @State private var feedData: SerializedFeedData?

    var body: some View {
        ScrollView {
            if let feedData = feedData {
                LazyVStack(spacing: 0) {
                    ForEach(feedData.posts, id: \.post.uri) { feedPost in
                        PostView(feedPost: feedPost)
                    }
                }
            } else {
                ProgressView()
            }
        }
        .onAppear {
            setupFeedObserver()
        }
    }

    private func setupFeedObserver() {
        NotificationCenter.default.addObserver(
            forName: FeedBridgeModule.feedDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { notification in
            if let feedData = notification.userInfo?["feedData"] as? SerializedFeedData {
                self.feedData = feedData
            }
        }
    }
}
```

### Post View

```swift
struct PostView: View {
    let feedPost: SerializedFeedViewPost

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Author
            HStack {
                if let avatar = feedPost.post.author.avatar {
                    AsyncImage(url: URL(string: avatar)) { image in
                        image.resizable()
                    } placeholder: {
                        Circle().fill(Color.gray)
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
                }

                VStack(alignment: .leading) {
                    Text(feedPost.post.author.displayName ?? feedPost.post.author.handle)
                        .font(.headline)
                    Text("@\(feedPost.post.author.handle)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Post text with facets
            RichTextView(
                text: feedPost.post.record.text,
                facets: feedPost.post.record.facets
            )

            // Embed
            if let embed = feedPost.post.embed {
                EmbedView(embed: embed)
            }

            // Engagement
            HStack(spacing: 16) {
                Label("\(feedPost.post.replyCount ?? 0)", systemImage: "bubble.left")
                Label("\(feedPost.post.repostCount ?? 0)", systemImage: "arrow.2.squarepath")
                Label("\(feedPost.post.likeCount ?? 0)", systemImage: "heart")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
    }
}
```

### Embed View

```swift
struct EmbedView: View {
    let embed: SerializedEmbed

    var body: some View {
        switch embed {
        case .images(let embedImages):
            ImagesEmbedView(images: embedImages.images)

        case .external(let embedExternal):
            ExternalLinkView(external: embedExternal.external)

        case .video(let embedVideo):
            VideoEmbedView(video: embedVideo.video)

        case .record(let embedRecord):
            QuotedPostView(record: embedRecord.record)

        case .recordWithMedia(let embedRecordWithMedia):
            VStack {
                QuotedPostView(record: embedRecordWithMedia.record.record)
                EmbedView(embed: embedRecordWithMedia.media)
            }
        }
    }
}
```

### Rich Text with Facets

```swift
struct RichTextView: View {
    let text: String
    let facets: [Facet]?

    var body: some View {
        if let facets = facets, !facets.isEmpty {
            // Render with styled facets
            RichTextWithFacets(text: text, facets: facets)
        } else {
            Text(text)
        }
    }
}

struct RichTextWithFacets: View {
    let text: String
    let facets: [Facet]

    var body: some View {
        // Convert byte indices to string indices and apply styling
        let attributedString = createAttributedString()
        Text(attributedString)
    }

    private func createAttributedString() -> AttributedString {
        var attributed = AttributedString(text)

        for facet in facets {
            // Convert byte indices to string indices
            let utf8 = text.utf8
            guard let startIndex = utf8.index(
                utf8.startIndex,
                offsetBy: facet.index.byteStart,
                limitedBy: utf8.endIndex
            ),
            let endIndex = utf8.index(
                utf8.startIndex,
                offsetBy: facet.index.byteEnd,
                limitedBy: utf8.endIndex
            ) else {
                continue
            }

            let range = startIndex..<endIndex

            // Apply styling based on feature type
            for feature in facet.features {
                switch feature {
                case .mention:
                    if let attrRange = Range(range, in: attributed) {
                        attributed[attrRange].foregroundColor = .blue
                        attributed[attrRange].underlineStyle = .single
                    }
                case .link:
                    if let attrRange = Range(range, in: attributed) {
                        attributed[attrRange].foregroundColor = .blue
                        attributed[attrRange].underlineStyle = .single
                    }
                case .tag:
                    if let attrRange = Range(range, in: attributed) {
                        attributed[attrRange].foregroundColor = .blue
                    }
                }
            }
        }

        return attributed
    }
}
```

### Incremental Updates

```swift
struct FeedView: View {
    @State private var feedData: SerializedFeedData?
    @State private var postStates: [String: PostState] = [:]

    var body: some View {
        ScrollView {
            if let feedData = feedData {
                LazyVStack(spacing: 0) {
                    ForEach(feedData.posts, id: \.post.uri) { feedPost in
                        PostView(
                            feedPost: feedPost,
                            state: postStates[feedPost.post.uri]
                        )
                    }
                }
            }
        }
        .onAppear {
            setupObservers()
        }
    }

    private func setupObservers() {
        // Full update
        NotificationCenter.default.addObserver(
            forName: FeedBridgeModule.feedDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { notification in
            if let feedData = notification.userInfo?["feedData"] as? SerializedFeedData {
                self.feedData = feedData
            }
        }

        // Incremental update
        NotificationCenter.default.addObserver(
            forName: FeedBridgeModule.feedIncrementalUpdateNotification,
            object: nil,
            queue: .main
        ) { notification in
            if let update = notification.userInfo?["batchUpdate"] as? FeedBatchUpdate {
                applyIncrementalUpdate(update)
            }
        }
    }

    private func applyIncrementalUpdate(_ update: FeedBatchUpdate) {
        for postUpdate in update.updates {
            var state = postStates[postUpdate.uri] ?? PostState()

            if let likeCount = postUpdate.likeCount {
                state.likeCount = likeCount
            }
            if let repostCount = postUpdate.repostCount {
                state.repostCount = repostCount
            }
            if let viewer = postUpdate.viewer {
                state.isLiked = viewer.like != nil
                state.isReposted = viewer.repost != nil
            }

            postStates[postUpdate.uri] = state
        }
    }
}

struct PostState {
    var likeCount: Int = 0
    var repostCount: Int = 0
    var isLiked: Bool = false
    var isReposted: Bool = false
}
```

## Data Types

All data types are fully documented in:
- TypeScript: `src/services/feed-bridge/types.ts`
- Swift: `modules/feed-bridge/ios/FeedBridgeTypes.swift`

### Key Types

- `SerializedFeedData`: Complete feed data package
- `SerializedFeedViewPost`: Individual feed item
- `SerializedPost`: Post data with all metadata
- `SerializedEmbed`: Union of all embed types
- `Facet`: Rich text facet for styling
- `PostUpdate`: Incremental update for a post
- `FeedBatchUpdate`: Batch of incremental updates

## Performance Considerations

1. **Incremental Updates**: Use `updateFeedIncremental` for like/repost changes to avoid re-serializing the entire feed
2. **Lazy Loading**: SwiftUI's `LazyVStack` only renders visible posts
3. **Thread Safety**: All Swift data access is protected by locks
4. **JSON Efficiency**: Only changed data is sent in incremental updates

## Error Handling

Both TypeScript and Swift include error handling:

```typescript
try {
  FeedBridge.updateFeedData(serializedJSON);
} catch (error) {
  console.error('Failed to update feed:', error);
}
```

```swift
do {
    let feedData = try SerializedFeedData.decode(from: jsonString)
    // Use feedData
} catch {
    print("Failed to decode feed data: \(error)")
}
```

## Testing

See `examples/` directory for complete working examples:
- Basic feed display
- Incremental updates
- Offline support
- Bookmark integration
