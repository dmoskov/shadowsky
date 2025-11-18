# WebSocket Infrastructure for Real-Time Notifications

## Overview

This document describes the WebSocket infrastructure implementation for real-time notification delivery in the Bluesky Notifications App.

## Frontend Implementation

### Files Created

1. `/src/types/websocket.ts` - TypeScript types and interfaces for WebSocket events
2. `/src/services/websocket-service.ts` - Core WebSocket service with connection management
3. `/src/contexts/WebSocketContext.tsx` - React context provider for WebSocket state
4. `/src/components/WebSocketStatus.tsx` - UI component showing connection status
5. `/src/components/NotificationPermissionPrompt.tsx` - Browser notification permission handler

### Features Implemented

#### 1. WebSocket Service (`websocket-service.ts`)

The core service provides:

- **Connection Management**: Automatic connection/disconnection based on authentication state
- **Reconnection Logic**: Exponential backoff with configurable max attempts (default: 10)
- **Heartbeat/Ping-Pong**: Keep-alive mechanism every 30 seconds
- **Event System**: Type-safe event handlers for different message types
- **Stats Tracking**: Connection state, message counts, errors, etc.
- **Debug Logging**: Comprehensive logging when debug mode is enabled

Configuration options:

```typescript
{
  url: string; // WebSocket URL
  reconnectDelay: 5000; // Initial delay (exponential backoff)
  maxReconnectAttempts: 10; // Max reconnection attempts
  heartbeatInterval: 30000; // Heartbeat interval in ms
  debug: true; // Enable debug logging
}
```

#### 2. WebSocket Context (`WebSocketContext.tsx`)

React context that:

- Initializes WebSocket connection on authentication
- Handles incoming notification events
- Updates React Query cache in real-time
- Triggers browser notifications when enabled
- Provides connection state to components
- Cleans up connections on logout

Event handlers:

- `NEW_NOTIFICATION`: Adds notification to cache and shows browser notification
- `NOTIFICATION_COUNT`: Updates unread count in real-time
- `CONNECT/DISCONNECT/RECONNECT/ERROR`: Updates connection state

#### 3. WebSocket Status Component (`WebSocketStatus.tsx`)

Visual indicator showing:

- Current connection state (connected, connecting, reconnecting, error, disconnected)
- Connection statistics (messages sent/received, reconnect attempts)
- Manual reconnect button when disconnected
- Expandable details panel

#### 4. Browser Notification Support

- Permission request prompt (appears 5 seconds after login)
- Native browser notifications for new events
- Dismissible with localStorage persistence
- Respects user's notification permission settings

### Integration Points

#### App.tsx

The WebSocket infrastructure is integrated into the app hierarchy:

```tsx
<AuthProvider>
  <WebSocketProvider>
    {" "}
    {/* Initializes after auth */}
    <AppContent />
  </WebSocketProvider>
</AuthProvider>
```

Components added:

- `<WebSocketStatus />` - Shows connection indicator
- `<NotificationPermissionPrompt />` - Requests browser notification permission

#### Notification System Integration

The WebSocket context automatically updates:

- React Query cache for `["notifications"]` query
- React Query cache for `["notificationCount"]` query
- Browser notifications (when permission granted)

No changes needed to existing notification components - they automatically receive real-time updates through React Query.

### Configuration

Add to `.env` file:

```bash
# WebSocket Configuration
# Format: ws://localhost:3001 (local) or wss://your-domain.com (production)
# Leave empty to disable WebSocket functionality
VITE_WS_URL=
```

When `VITE_WS_URL` is not set, WebSocket is disabled and the app falls back to polling.

## Backend Requirements

### WebSocket Server Implementation

A WebSocket server is required to enable real-time notifications. The server should:

#### 1. Authentication

- Accept authentication token via query parameter: `?token=<jwt_token>`
- Validate JWT token from AT Protocol session
- Store mapping of user DID to WebSocket connection
- Reject invalid/expired tokens

Example:

```javascript
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "ws://localhost");
  const token = url.searchParams.get("token");

  // Validate token and extract user DID
  const userDid = validateToken(token);
  if (!userDid) {
    ws.close(1008, "Invalid token");
    return;
  }

  // Store connection
  userConnections.set(userDid, ws);
});
```

#### 2. Message Protocol

The server should send messages in this format:

```typescript
// New notification event
{
  type: "notification:new",
  timestamp: "2025-01-17T10:30:00Z",
  notification: {
    // Full AT Protocol notification object
    uri: "at://...",
    cid: "...",
    author: { did: "...", handle: "...", displayName: "..." },
    reason: "like" | "repost" | "follow" | "mention" | "reply" | "quote",
    reasonSubject: "at://...",
    record: { ... },
    isRead: false,
    indexedAt: "2025-01-17T10:30:00Z",
    labels: []
  }
}

// Notification count update
{
  type: "notification:count",
  timestamp: "2025-01-17T10:30:00Z",
  count: 5
}

// Heartbeat ping
{
  type: "ping",
  timestamp: "2025-01-17T10:30:00Z"
}
```

The client will respond to `ping` with:

```typescript
{
  type: "pong",
  timestamp: "2025-01-17T10:30:00Z"
}
```

#### 3. AT Protocol Integration

The backend should:

1. **Subscribe to AT Protocol Firehose** (optional, for instant delivery):
   - Connect to `wss://bsky.network`
   - Filter for notification-related events for connected users
   - Parse and forward relevant notifications to connected clients

2. **Polling Fallback** (simpler alternative):
   - Periodically check AT Protocol API for new notifications
   - Compare with last known state
   - Push new notifications to connected clients
   - Less instant but easier to implement

3. **Event Sources**:
   - Likes: `app.bsky.feed.like` records
   - Reposts: `app.bsky.feed.repost` records
   - Follows: `app.bsky.graph.follow` records
   - Replies/Mentions: `app.bsky.feed.post` records with mentions or reply-to

#### 4. Connection Management

- Handle client disconnections gracefully
- Clean up user connection mappings on disconnect
- Support multiple connections per user (multiple devices/tabs)
- Implement connection timeouts for inactive clients

#### 5. Error Handling

- Send error events to clients:

```typescript
{
  type: "error",
  timestamp: "2025-01-17T10:30:00Z",
  error: "Error message",
  code: "ERROR_CODE"
}
```

- Handle rate limiting from AT Protocol API
- Implement backoff strategies for API failures

### Technology Recommendations

#### Option 1: Node.js with ws library

Simple WebSocket server:

```javascript
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3001 });

wss.on("connection", handleConnection);
```

**Pros**: Simple, lightweight, direct control
**Cons**: Need to implement all protocol logic

#### Option 2: Socket.io

Feature-rich WebSocket framework:

```javascript
const io = require("socket.io")(3001, {
  cors: { origin: "*" },
});

io.use(authMiddleware);
io.on("connection", handleConnection);
```

**Pros**: Built-in reconnection, rooms, namespaces, fallbacks
**Cons**: Larger bundle, custom protocol

#### Option 3: AWS AppSync / Firebase Realtime Database

Managed real-time services:

**Pros**: Fully managed, scalable, no server maintenance
**Cons**: Vendor lock-in, additional costs, complexity

### Deployment Considerations

1. **SSL/TLS Required**: Use `wss://` in production (not `ws://`)
2. **Load Balancing**: Use sticky sessions or Redis pub/sub for multi-server setups
3. **Scaling**: Consider connection limits per server instance
4. **Monitoring**: Track connection counts, message rates, errors
5. **CORS**: Configure appropriate CORS headers for WebSocket handshake

### Minimal Implementation Example

A minimal Node.js server using the `ws` library:

```javascript
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const wss = new WebSocket.Server({ port: 3001 });
const userConnections = new Map();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "ws://localhost");
  const token = url.searchParams.get("token");

  // Validate token (simplified - implement proper validation)
  let userDid;
  try {
    const decoded = jwt.decode(token);
    userDid = decoded.sub;
  } catch (err) {
    ws.close(1008, "Invalid token");
    return;
  }

  // Store connection
  if (!userConnections.has(userDid)) {
    userConnections.set(userDid, new Set());
  }
  userConnections.get(userDid).add(ws);

  // Handle messages
  ws.on("message", (data) => {
    const message = JSON.parse(data);
    if (message.type === "pong") {
      console.log("Received pong from", userDid);
    }
  });

  // Handle disconnect
  ws.on("close", () => {
    const connections = userConnections.get(userDid);
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(userDid);
    }
  });

  // Send heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "ping",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }, 30000);

  ws.on("close", () => clearInterval(heartbeat));
});

// Function to broadcast notification to user
function sendNotificationToUser(userDid, notification) {
  const connections = userConnections.get(userDid);
  if (connections) {
    const message = JSON.stringify({
      type: "notification:new",
      timestamp: new Date().toISOString(),
      notification,
    });

    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Function to update notification count
function updateNotificationCount(userDid, count) {
  const connections = userConnections.get(userDid);
  if (connections) {
    const message = JSON.stringify({
      type: "notification:count",
      timestamp: new Date().toISOString(),
      count,
    });

    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// TODO: Implement AT Protocol integration
// - Subscribe to firehose OR poll for notifications
// - Call sendNotificationToUser() when new notifications arrive
// - Call updateNotificationCount() when count changes

console.log("WebSocket server running on ws://localhost:3001");
```

### Testing WebSocket Implementation

Without a backend, you can test the WebSocket infrastructure:

1. **Check Connection State**: WebSocket will show "disconnected" or "error" state
2. **Manual Testing**: Use browser console to test connection logic
3. **Mock Server**: Create a simple mock server for testing:

```javascript
// test-ws-server.js
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3001 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Send test notification after 5 seconds
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: "notification:new",
        timestamp: new Date().toISOString(),
        notification: {
          uri: "at://test/app.bsky.feed.post/test",
          cid: "test",
          author: {
            did: "did:plc:test",
            handle: "test.bsky.social",
            displayName: "Test User",
          },
          reason: "like",
          isRead: false,
          indexedAt: new Date().toISOString(),
        },
      }),
    );
  }, 5000);

  ws.on("message", (data) => {
    console.log("Received:", data.toString());
  });
});
```

Run with: `node test-ws-server.js`
Then set `VITE_WS_URL=ws://localhost:3001` in `.env`

## Frontend Behavior Without Backend

When `VITE_WS_URL` is not configured or the WebSocket server is unavailable:

- WebSocket connection will not be established
- App continues to function normally with polling
- WebSocketStatus component shows "disconnected" state
- No real-time updates (falls back to 30-second polling)
- No browser notifications from WebSocket events

The app gracefully degrades to polling-based updates.

## Future Enhancements

1. **Message Queuing**: Buffer messages when connection is temporarily lost
2. **Optimistic Updates**: Update UI immediately before server confirmation
3. **Read Receipts**: Send read status updates via WebSocket
4. **Typing Indicators**: For DM functionality
5. **Presence**: Show online/offline status
6. **Custom Notifications**: User-configurable notification preferences
7. **Sound Alerts**: Audio notifications for important events
8. **Notification Grouping**: Batch similar notifications

## Security Considerations

1. **Token Validation**: Always validate JWT tokens on connection
2. **Rate Limiting**: Limit connections per user and message frequency
3. **Input Validation**: Validate all incoming messages
4. **DDoS Protection**: Implement connection limits and backoff
5. **Encryption**: Always use WSS (TLS) in production
6. **Token Refresh**: Handle token expiration and refresh
7. **CORS**: Configure appropriate origin restrictions

## Monitoring & Debugging

Enable debug mode to see detailed WebSocket logs:

```javascript
// In browser console
window.enableDebug();
```

This will show:

- Connection attempts and state changes
- All incoming/outgoing messages
- Reconnection attempts
- Error details

The WebSocketStatus component provides real-time statistics:

- Connection state
- Connected timestamp
- Messages sent/received
- Reconnection attempts
- Error messages

## Summary

The frontend WebSocket infrastructure is complete and ready for integration. Once a WebSocket backend is deployed:

1. Set `VITE_WS_URL` in `.env` to the WebSocket server URL
2. Restart the development server
3. The app will automatically connect and receive real-time notifications

The implementation is production-ready with:

- Robust error handling and reconnection logic
- Type-safe event system
- React Query integration
- Browser notification support
- Visual connection status indicator
- Comprehensive debugging capabilities

No further frontend changes are required once the backend is deployed.
