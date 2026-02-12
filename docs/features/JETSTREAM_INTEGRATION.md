# Jetstream WebSocket Integration

## Overview

This document describes the integration of Bluesky's Jetstream firehose for real-time updates in the application.

Jetstream provides a WebSocket connection to Bluesky's AT Protocol firehose, delivering real-time events for:
- New posts from followed accounts
- Likes, reposts, and replies on user's posts
- New followers
- Post deletions

## Architecture

### Components

1. **JetstreamService** (`src/services/jetstream-service.ts`)
   - Connects to `wss://jetstream1.us-east.bsky.network/subscribe`
   - Filters events by collection type (posts, likes, reposts, follows)
   - Translates Jetstream events to application WebSocket event types
   - Handles reconnection with exponential backoff
   - Implements background/foreground detection

2. **useRealtimeUpdates Hook** (`src/hooks/useRealtimeUpdates.ts`)
   - React hook for managing Jetstream connection lifecycle
   - Integrates with React Query for cache invalidation
   - Tracks new posts count for UI indicator
   - Provides callbacks for timeline refresh

3. **NewPostsIndicator Component** (`src/components/NewPostsIndicator.tsx`)
   - Floating UI indicator showing new posts available
   - Clicking scrolls to top and refreshes timeline
   - Animated entrance/exit
   - Fully accessible with keyboard support

## Features

### Real-time Post Updates

When a followed account creates a new post, the app:
1. Receives the event via Jetstream
2. Increments the "new posts" counter
3. Shows the NewPostsIndicator component
4. User can click to refresh and see new posts

### Real-time Notifications

When someone interacts with the user's content:
1. Like/repost/follow events are filtered by the user's DID
2. Notifications are added to React Query cache
3. Notification badge updates in real-time
4. Browser notifications shown (if permitted)

### Background/Foreground Detection

The Jetstream connection automatically:
- **Disconnects** when the app goes to background (saves bandwidth/battery)
- **Reconnects** when the app comes to foreground
- **Handles** network online/offline events
- **Recovers** from stale connections automatically

### Graceful Degradation

If Jetstream connection fails:
- App continues to work with polling-based updates
- Auto-reconnect with exponential backoff (up to 10 attempts)
- Error states are logged and can be monitored

## Usage

### Basic Integration

```typescript
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';

function FeedComponent() {
  const { agent } = useAuth();
  const { data: following } = useFollowing();

  const {
    isConnected,
    newPostsCount,
    refreshTimeline,
    stats
  } = useRealtimeUpdates({
    userDid: agent.session.did,
    followedDids: following?.map(f => f.did) || [],
    debug: true,
    autoConnect: true,
  });

  return (
    <>
      <NewPostsIndicator
        count={newPostsCount}
        onRefresh={refreshTimeline}
      />
      {/* Feed content */}
    </>
  );
}
```

### Manual Connection Control

```typescript
const {
  isConnected,
  connect,
  disconnect,
} = useRealtimeUpdates({
  userDid: userDid,
  autoConnect: false, // Don't connect automatically
});

// Connect manually
useEffect(() => {
  if (someCondition) {
    connect();
  }
}, [someCondition, connect]);
```

## Event Flow

### New Post from Followed Account

```
Jetstream Firehose
  ↓
[commit: app.bsky.feed.post, operation: create]
  ↓
JetstreamService.handleCommitEvent()
  ↓ (filter by followedDids)
emit(TIMELINE_NEW_POST)
  ↓
useRealtimeUpdates hook
  ↓
increment newPostsCount
  ↓
NewPostsIndicator renders
```

### Notification (Like on User's Post)

```
Jetstream Firehose
  ↓
[commit: app.bsky.feed.like, operation: create]
  ↓
JetstreamService.handleCommitEvent()
  ↓ (filter by subject URI = user's post)
emit(NEW_NOTIFICATION)
  ↓
WebSocketContext or useRealtimeUpdates
  ↓
queryClient.invalidateQueries(['notifications'])
  ↓
Notification badge updates
```

### Post Deletion

```
Jetstream Firehose
  ↓
[commit: app.bsky.feed.post, operation: delete]
  ↓
JetstreamService.handleCommitEvent()
  ↓
emit(TIMELINE_DELETE_POST)
  ↓
useRealtimeUpdates hook
  ↓
queryClient.setQueriesData() - removes post from cache
  ↓
Feed re-renders without deleted post
```

## Configuration

### Filtering Collections

The Jetstream service filters events by collection type using query parameters:

```typescript
const params = new URLSearchParams();
params.set("wantedCollections", "app.bsky.feed.post");
params.set("wantedCollections", "app.bsky.feed.like");
params.set("wantedCollections", "app.bsky.feed.repost");
params.set("wantedCollections", "app.bsky.graph.follow");
```

This reduces bandwidth by only receiving relevant events.

### Reconnection Behavior

- **Initial delay**: 5 seconds
- **Max delay**: 30 seconds
- **Max attempts**: 10
- **Backoff**: Exponential (2^attempt)
- **Jitter**: None (predictable for debugging)

## Performance Considerations

### Bandwidth

Jetstream is efficient but still sends a continuous stream of events. The service:
- Filters events client-side after receiving
- Only subscribes to relevant collections
- Disconnects when app is in background

Typical bandwidth: ~50-200 KB/minute depending on followed accounts and activity level.

### Battery Impact

Background disconnection is critical for mobile devices:
- Page Visibility API detects when app is hidden
- Automatic disconnection stops network activity
- Reconnection when app becomes visible again

### Memory

Event handlers and state:
- Events are processed and discarded (not stored)
- Only current "new posts count" is kept in state
- React Query handles caching of actual data

## Debugging

Enable debug logging:

```typescript
useRealtimeUpdates({
  userDid: userDid,
  followedDids: followedDids,
  debug: true, // Enables console logging
});
```

Debug logs include:
- Connection/disconnection events
- New posts received
- Notifications received
- Reconnection attempts
- Background/foreground transitions

### Monitoring Stats

```typescript
const { stats } = useRealtimeUpdates({ ... });

console.log(stats);
// {
//   messagesReceived: 1234,
//   postsReceived: 45,
//   notificationsReceived: 12,
//   lastEventTime: Date
// }
```

## Limitations

### Current Limitations

1. **Notification details incomplete**: Jetstream provides minimal notification data (DID, timestamp). Full notification details require a follow-up API call.

2. **No engagement count updates**: Unlike the custom WebSocket server, Jetstream doesn't provide real-time engagement counter updates (like/repost counts). These still require polling or the engagement service.

3. **Filtering is client-side**: All events for subscribed collections are sent to the client, even if not relevant. Filtering happens after receiving events.

4. **No authentication**: Jetstream is a public firehose. Private/protected posts are not included in the stream.

### Future Enhancements

- **Enrich notifications**: Fetch full notification details when Jetstream event received
- **Engagement updates**: Consider integrating with AT Protocol firehose directly for engagement metrics
- **Server-side filtering**: Deploy a filtering proxy to reduce client bandwidth
- **Cursor support**: Track Jetstream cursor for resuming after disconnection without gaps

## Troubleshooting

### Connection Fails

**Symptom**: Jetstream never connects, no error logs

**Causes**:
- Network firewall blocking WebSocket connections
- CORS or security policy blocking wss:// connections
- Browser extension interfering with WebSockets

**Solutions**:
- Check browser console for WebSocket errors
- Disable browser extensions temporarily
- Try different network (mobile hotspot vs WiFi)

### No New Posts Showing

**Symptom**: Connected to Jetstream but new posts indicator never appears

**Causes**:
- `followedDids` array is empty or incorrect
- Followed accounts aren't posting
- Client-side filtering is too restrictive

**Solutions**:
- Enable debug logging and check console
- Verify `followedDids` array contains correct DIDs
- Test with a high-activity followed account

### High Battery Drain on Mobile

**Symptom**: Mobile battery drains quickly when using app

**Causes**:
- Background disconnection not working
- App stays in foreground (screen on)
- Too many followed accounts generating high event volume

**Solutions**:
- Verify visibility change handlers are working
- Check stats: `messagesReceived` should not increase when app is backgrounded
- Consider reducing number of followed accounts (or implement sampling)

## References

- [Jetstream Documentation](https://docs.bsky.app/blog/jetstream)
- [AT Protocol Firehose](https://docs.bsky.app/docs/advanced-guides/firehose)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
