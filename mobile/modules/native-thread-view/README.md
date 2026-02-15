# native-thread-view

Native SwiftUI module for rendering thread/post detail views with nested replies.

## Overview

This module provides a high-performance native iOS implementation of thread views using SwiftUI. It replaces the React Native ScrollView-based implementation with native lazy loading and optimized rendering for deep reply trees.

## Features

- **Native SwiftUI UI**: Uses SwiftUI List with lazy loading for better performance
- **Nested Reply Tree**: Supports hierarchical reply rendering with indentation
- **Collapse/Expand**: Replies can be collapsed and expanded to manage deep threads
- **Event Bridging**: All interactions (like, repost, reply, etc.) are bridged back to JavaScript
- **Thread Navigation**: Support for jumping to parent posts and root post
- **Real-time Updates**: Integrates with ThreadBridge for optimistic updates

## Architecture

### Components

1. **ThreadViewModule.swift**: Expo module wrapper that bridges props and events
2. **ThreadView.swift**: Main SwiftUI view with scroll and lazy loading
3. **ThreadPostCard.swift**: Individual post card component
4. **ThreadReplyView.swift**: Reply component with nesting and collapse support
5. **ThreadTypes.swift**: Swift types for thread data structures

### Data Flow

```
JS (ThreadScreen)
  ↓
ThreadBridge (serialization)
  ↓
NotificationCenter
  ↓
ThreadView (SwiftUI)
  ↓
User Interactions
  ↓
Events back to JS
```

## Usage

```tsx
import { NativeThreadView } from '../../../modules/native-thread-view';
import { ThreadBridge } from '../../../modules/thread-bridge';

// Sync thread data to native
useEffect(() => {
  if (thread) {
    ThreadBridge.setThreadData(thread);
  }
}, [thread]);

// Render native view
<NativeThreadView
  style={styles.threadView}
  isLoading={isLoading}
  isRefreshing={isRefreshing}
  error={error}
  threadUri={postUri}
  onRefresh={handleRefresh}
  onPostPress={handlePostPress}
  onProfilePress={handleProfilePress}
  onLike={handleLike}
  onRepost={handleRepost}
  onReply={handleReply}
  // ... other event handlers
/>
```

## Dependencies

- **ExpoModulesCore**: For Expo module integration
- **FeedBridge**: Reuses serialization types for posts
- **ThreadBridge**: Companion module for data serialization

## Performance Benefits

Compared to the React Native implementation:

- **Lazy Loading**: Only visible posts are rendered
- **Native Scrolling**: Uses UIKit/SwiftUI native scroll performance
- **Efficient Re-renders**: SwiftUI's diffing algorithm minimizes updates
- **Memory Efficiency**: Better memory management for deep threads

## Future Enhancements

- [ ] Image embed support
- [ ] Video embed support
- [ ] Quote post rendering
- [ ] Thread summary integration
- [ ] Accessibility improvements
- [ ] Dark mode theming
