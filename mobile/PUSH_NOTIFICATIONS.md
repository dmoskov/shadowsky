# Push Notifications Setup

This document describes the push notification implementation for the Asphodel mobile app.

## Architecture

The push notification system uses **Expo Push Notification Service** as an intermediary between the app and Apple Push Notification Service (APNs) / Firebase Cloud Messaging (FCM).

### Components

1. **Mobile App** (`mobile/`)
   - Registers for push notifications and obtains Expo Push Token
   - Stores push token in AT Protocol record for the user
   - Handles incoming notifications and deep links to content
   - Falls back to polling if push registration fails

2. **Backend Worker** (`server/push-worker.js`)
   - Polls Bluesky API for new notifications (30-second intervals)
   - Sends push notifications via Expo Push Service
   - Tracks notification state to avoid duplicate notifications

3. **API Server** (`server/routes/push-notifications.js`)
   - Provides endpoints for push token registration
   - Manages push token storage (in-memory, should be Redis/DB in production)

## Mobile App Implementation

### Push Token Registration

The mobile app registers for push notifications in `NotificationSetup.tsx`:

1. Requests notification permissions from the OS
2. Obtains Expo Push Token using `expo-notifications`
3. Saves token to AT Protocol as a singleton record
4. Falls back to polling if registration fails

Key files:
- `mobile/src/services/push-notification-service.ts` - Core push notification logic
- `mobile/src/components/NotificationSetup.tsx` - Initialization component
- `mobile/src/hooks/useNotificationHandler.ts` - Notification tap handling
- `mobile/src/hooks/useNotificationPermissions.ts` - Permission management

### AT Protocol Storage

Push tokens are stored as AT Protocol records:
- **Collection**: `com.shadowsky.pushToken`
- **RKey**: `self` (singleton record)
- **Record Schema**:
  ```typescript
  {
    token: string;        // Expo Push Token
    platform: 'ios' | 'android';
    deviceId: string;     // Device identifier
    updatedAt: string;    // ISO timestamp
  }
  ```

### Deep Linking

When users tap a notification, the app navigates to the appropriate screen based on the notification data:

- `type: 'post'` or `type: 'thread'` - Navigate to post thread
- `type: 'profile'` - Navigate to user profile
- `type: 'dm'` or `type: 'message'` - Navigate to messages
- `type: 'notification'` - Navigate to notifications tab (default)

### Fallback Mechanism

If push registration fails (e.g., on simulator, permission denied, network issues), the app automatically falls back to the existing polling mechanism (`notification-poller.ts`).

## Backend Implementation

### Push Worker

The push worker (`server/push-worker.js`) runs continuously and:

1. Maintains a cache of user notification states
2. Polls Bluesky API every 30 seconds (configurable)
3. Detects new notifications by comparing unread counts
4. Sends push notifications via Expo Push Service
5. Batches notifications for efficiency (up to 100 per request)

### API Endpoints

The server provides these endpoints:

- `POST /api/push-subscription` - Register a push token
- `DELETE /api/push-subscription/:did` - Unregister a push token
- `GET /api/push-subscriptions` - List all registered tokens (admin)
- `POST /api/push-notification/send` - Send a test notification
- `GET /api/push-notification/stats` - Get service statistics

## Configuration

### App Configuration

Update `mobile/app.config.ts`:

```typescript
ios: {
  infoPlist: {
    UIBackgroundModes: ["remote-notification"]
  }
}

android: {
  permissions: ["RECEIVE_BOOT_COMPLETED"]
}

plugins: [
  ["expo-notifications", {
    icon: "./assets/notification-icon.png",
    color: "#c9a84c"
  }]
]
```

### EAS Configuration

Ensure `mobile/eas.json` has a valid project ID:

```json
{
  "extra": {
    "eas": {
      "projectId": "your-actual-project-id"
    }
  }
}
```

Get your project ID from: https://expo.dev/accounts/[account]/projects/[project]/settings

### APNs Certificates

For iOS push notifications:

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles
3. Create an APNs certificate for `io.shadowsky.app`
4. Upload certificate to Expo: `eas credentials`
5. Select iOS → Push Notifications certificate

## Deployment

### Running the Push Worker

```bash
cd server
node push-worker.js
```

For production, use a process manager like PM2:

```bash
pm2 start push-worker.js --name "push-notifications"
pm2 save
```

### Environment Variables

No additional environment variables required. The worker uses the Expo Push Service public API.

### Production Considerations

1. **Token Storage**: Replace in-memory storage with Redis or PostgreSQL
2. **User Management**: Implement a proper user database with push tokens
3. **Monitoring**: Add logging, metrics, and alerting
4. **Rate Limiting**: Implement rate limiting for Expo Push API
5. **Error Handling**: Handle token expiration and device unregistration
6. **Scalability**: Use a job queue (Bull, BullMQ) for large-scale deployments

## Testing

### Testing on Device

1. Build a development build: `eas build --profile development --platform ios`
2. Install on a physical device (push notifications don't work on simulator)
3. Log in to the app
4. Grant notification permissions when prompted
5. Send a test notification or wait for real notifications

### Testing the Worker

```bash
# Terminal 1: Start the API server
cd server
npm start

# Terminal 2: Start the push worker
cd server
node push-worker.js

# Terminal 3: Register a test token
curl -X POST http://localhost:3000/api/push-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:plc:test123",
    "handle": "testuser.bsky.social",
    "pushToken": "ExponentPushToken[xxxxxxxxxxxxxx]",
    "platform": "ios",
    "deviceId": "test-device"
  }'
```

## Troubleshooting

### Push notifications not arriving

1. **Check permissions**: Ensure notification permissions are granted
2. **Verify token**: Check that push token is registered in AT Protocol
3. **Check worker**: Ensure push-worker.js is running
4. **Verify connectivity**: Check that the device has internet access
5. **Check logs**: Review server logs for errors

### Token registration fails

1. **Project ID**: Verify EAS project ID is configured
2. **Physical device**: Push tokens only work on physical devices
3. **Network**: Check that device can reach expo.dev
4. **Permissions**: Ensure notification permissions are granted

### Notifications arrive late

1. **Worker interval**: Reduce POLL_INTERVAL in push-worker.js (default: 30s)
2. **Network**: Check server network connectivity
3. **Rate limiting**: Verify you're not hitting Bluesky API rate limits

## Future Enhancements

1. **Direct APNs/FCM**: Bypass Expo Push Service for lower latency
2. **Rich Notifications**: Add images, actions, and custom layouts
3. **Notification Categories**: Support different notification types (likes, replies, mentions)
4. **Quiet Hours**: Allow users to configure do-not-disturb times
5. **Priority**: Implement priority levels for different notification types
6. **Webhooks**: Use Bluesky webhooks instead of polling (when available)
7. **Multi-device**: Support multiple devices per user
8. **Notification History**: Track sent notifications for analytics
