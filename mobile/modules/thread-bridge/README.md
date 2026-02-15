# thread-bridge

Data serialization bridge for thread data between JavaScript and native Swift.

## Overview

This module handles serialization and transmission of thread data (posts with nested replies) from JavaScript to native Swift code. It works in conjunction with the `native-thread-view` module.

## Features

- **Thread Serialization**: Converts AT Protocol thread structures to Swift-compatible JSON
- **Real-time Updates**: Supports incremental updates for like/repost changes
- **NotificationCenter Integration**: Uses iOS NotificationCenter for efficient data broadcasting

## Usage

### Setting Thread Data

```typescript
import { ThreadBridge } from 'thread-bridge';

// Serialize and send thread to native
ThreadBridge.setThreadData(threadViewPost);
```

### Incremental Updates

```typescript
// Update a single post's engagement counts
ThreadBridge.updatePost(postUri, {
  likeCount: newLikeCount,
  viewer: { like: likeUri }
});
```

### Clear Data

```typescript
// Clear thread data when unmounting
ThreadBridge.clearThreadData();
```

## Data Structure

### SerializedThreadNode

```typescript
interface SerializedThreadNode {
  post: SerializedThreadPost;
  parent?: {
    uri: string;
    cid: string;
  };
  replies: SerializedThreadNode[];
}
```

### SerializedThreadPost

```typescript
interface SerializedThreadPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    facets?: any[];
  };
  indexedAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewer?: {
    like?: string;
    repost?: string;
  };
}
```

## Notifications

The module broadcasts three types of notifications:

1. **ThreadBridgeDataUpdated**: Full thread data update
2. **ThreadBridgeIncrementalUpdate**: Single post update
3. **ThreadBridgeDataCleared**: Clear all thread data

Native Swift components can observe these notifications to update their UI.

## Dependencies

- **@atproto/api**: For AT Protocol types
- **expo-modules-core**: For Expo module integration
