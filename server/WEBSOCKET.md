# WebSocket Server for Real-Time Notifications

This document describes the WebSocket server implementation for delivering real-time notifications to connected clients.

## Overview

The WebSocket server provides instant notification delivery without polling, significantly improving the user experience by:
- Delivering notifications in real-time (typically within 15 seconds)
- Reducing unnecessary API calls to AT Protocol
- Supporting multiple simultaneous connections per user
- Providing connection resilience with automatic reconnection

## Architecture

### Components

1. **WebSocket Server** (`websocket-server.js`)
   - Handles WebSocket connections and authentication
   - Manages user sessions and connection lifecycle
   - Polls AT Protocol for new notifications
   - Broadcasts notifications to connected clients

2. **API Server Integration** (`api-server.js`)
   - Runs WebSocket server on separate port (3001)
   - Provides graceful shutdown handling
   - Coordinates with existing REST API

### How It Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Client    │◄───WS──►│  WebSocket       │◄───API──►│ AT Protocol │
│  (Browser)  │         │    Server        │         │   (Bsky)    │
└─────────────┘         └──────────────────┘         └─────────────┘
      │                         │
      │  1. Connect w/ JWT      │
      ├────────────────────────►│
      │                         │
      │  2. Auth & Store        │  3. Poll for notifications
      │     Connection          ├──────────────────────►
      │                         │
      │                         │  4. New notification
      │  5. Push notification   │◄─────────────────────
      │◄────────────────────────┤
      │                         │
      │  6. Heartbeat (ping)    │
      │◄───────────────────────►│
```

## Configuration

### Environment Variables

```bash
# WebSocket server port (default: 3001)
WS_PORT=3001

# API server port (default: 3002)
PORT=3002
```

### Server Options

The WebSocket server accepts these configuration options:

```javascript
{
  heartbeatInterval: 30000,  // Ping interval in ms (default: 30s)
  pollInterval: 15000,       // Notification polling interval (default: 15s)
  debug: true                // Enable debug logging (default: true)
}
```

## Authentication

Clients connect with a JWT token via query parameter:

```
ws://localhost:3001?token=<jwt_access_token>
```

The server:
1. Decodes the JWT token to extract user DID
2. Creates an AT Protocol agent for the user
3. Resumes the user's session
4. Starts polling for notifications

Invalid or missing tokens result in connection rejection with appropriate close codes.

## Message Protocol

### Client → Server

**Pong (heartbeat response)**
```json
{
  "type": "pong",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Server → Client

**Connection Established**
```json
{
  "type": "connect",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

**New Notification**
```json
{
  "type": "notification:new",
  "timestamp": "2025-01-17T10:30:00Z",
  "notification": {
    "uri": "at://...",
    "cid": "...",
    "author": {
      "did": "did:plc:...",
      "handle": "user.bsky.social",
      "displayName": "User Name",
      "avatar": "https://..."
    },
    "reason": "like",
    "reasonSubject": "at://...",
    "record": { ... },
    "isRead": false,
    "indexedAt": "2025-01-17T10:30:00Z",
    "labels": []
  }
}
```

**Notification Count Update**
```json
{
  "type": "notification:count",
  "timestamp": "2025-01-17T10:30:00Z",
  "count": 5
}
```

**Heartbeat Ping**
```json
{
  "type": "ping",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

**Error Event**
```json
{
  "type": "error",
  "timestamp": "2025-01-17T10:30:00Z",
  "error": "Error message",
  "code": "429"
}
```

## Features

### Connection Management

- **Multiple Connections**: Supports multiple simultaneous connections per user (e.g., multiple tabs/devices)
- **Connection Tracking**: Maintains a map of user DIDs to WebSocket connections
- **Automatic Cleanup**: Removes connections and stops polling when all connections for a user close

### Heartbeat Mechanism

- Server sends `ping` every 30 seconds
- Expects `pong` response from client
- Terminates stale connections that don't respond
- Client-side handles pings automatically via `WebSocketService`

### Notification Polling

- Polls AT Protocol API every 15 seconds for each connected user
- Uses cursor-based pagination to track last seen notification
- Only broadcasts new notifications (not previously seen)
- On first connection, sends only 5 most recent notifications to avoid overwhelming the client

### Error Handling

- **Rate Limiting**: Gracefully handles 429 responses, logs and retries
- **Auth Failures**: Sends error events to clients for auth issues
- **Connection Errors**: Logs errors and cleans up resources
- **Graceful Shutdown**: Handles SIGTERM/SIGINT with proper cleanup

## Running the Server

### Development

```bash
cd server
npm install
npm run dev
```

This starts:
- API server on `http://localhost:3002`
- WebSocket server on `ws://localhost:3001`

### Production

```bash
cd server
npm install
npm start
```

For production deployment:
1. Use `wss://` (secure WebSocket) with SSL/TLS
2. Configure reverse proxy (nginx) for WebSocket support
3. Set appropriate `WS_PORT` in environment
4. Enable logging and monitoring

## Frontend Integration

The frontend automatically connects when `VITE_WS_URL` is set:

```bash
# .env
VITE_WS_URL=ws://localhost:3001
```

The `WebSocketContext` provider:
1. Initializes connection on authentication
2. Passes JWT token via query parameter
3. Handles incoming messages
4. Updates React Query cache in real-time
5. Triggers browser notifications

## Monitoring & Stats

The server provides stats via `getStats()`:

```javascript
{
  connectedUsers: 5,        // Number of unique users connected
  totalConnections: 8,      // Total WebSocket connections
  activePolling: 5          // Number of users being polled
}
```

## Security Considerations

1. **Token Validation**: JWT tokens are decoded and validated
2. **Connection Isolation**: Each user only receives their own notifications
3. **Rate Limiting**: Respects AT Protocol rate limits
4. **Secure Transport**: Use WSS in production for encryption
5. **Resource Limits**: Automatic cleanup prevents resource leaks

## Scaling Considerations

For high-traffic deployments:

1. **Horizontal Scaling**: Use Redis pub/sub for multi-server coordination
2. **Load Balancing**: Configure sticky sessions for WebSocket connections
3. **Connection Limits**: Monitor and limit connections per server instance
4. **Polling Optimization**: Adjust polling interval based on load
5. **Firehose Integration**: Consider AT Protocol firehose for real-time events (advanced)

## Troubleshooting

### Connection Issues

**Problem**: Client can't connect
- Check `VITE_WS_URL` is set correctly
- Verify WebSocket server is running on correct port
- Check firewall/proxy settings for WebSocket support

**Problem**: Connection drops frequently
- Check network stability
- Verify heartbeat interval isn't too aggressive
- Review server logs for errors

### Performance Issues

**Problem**: High CPU usage
- Reduce polling frequency if many users connected
- Consider implementing firehose integration
- Check for connection leaks (use `getStats()`)

**Problem**: Delayed notifications
- Check polling interval (default: 15s)
- Verify AT Protocol API response times
- Review rate limiting status

## Future Enhancements

1. **Firehose Integration**: Real-time event streaming from AT Protocol
2. **Redis Pub/Sub**: Multi-server coordination for scaling
3. **Metrics Dashboard**: Real-time monitoring and analytics
4. **Selective Notifications**: User preferences for notification types
5. **Message Queuing**: Buffer messages during reconnection
6. **Compression**: Enable per-message deflate for bandwidth savings

## Resources

- [AT Protocol Documentation](https://atproto.com/)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [ws Library Documentation](https://github.com/websockets/ws)
