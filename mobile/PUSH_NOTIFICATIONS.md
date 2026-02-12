# Push Notification Implementation

This document describes the push notification implementation for the ShadowSky mobile app.

## Overview

The implementation uses **local polling-based notifications** as an MVP. The app polls the Bluesky API every 60 seconds when in the background to check for new notifications, and displays local notifications when the unread count increases.

This approach does not require server infrastructure, but is limited to:
- Generic notification messages ("You have X new notifications")
- Battery drain from periodic polling
- No true push delivery (requires app to be running in background)

## Architecture

### Core Components

1. **notification-poller.ts** - Background polling service
   - Polls `getUnreadCount()` every 60 seconds
   - Only polls when app is backgrounded (uses AppState)
   - Compares with last known count stored in AsyncStorage
   - Shows local notification when count increases
   - Updates app badge count

2. **useNotificationPermissions.ts** - Permission management hook
   - Requests notification permissions on first app launch
   - Tracks permission status (granted/denied/undetermined)
   - Configures notification handler for foreground notifications
   - Sets up Android notification channels

3. **useNotificationHandler.ts** - Notification interaction handler
   - Listens for notification taps
   - Navigates to Notifications tab when tapped
   - Clears badge count when user opens notifications

4. **NotificationSetup.tsx** - Initialization component
   - Mounted when user is authenticated
   - Requests permissions after login
   - Starts/stops poller based on auth state

### Integration Points

1. **app/(app)/_layout.tsx** - Mounts NotificationSetup
2. **NotificationsScreen.tsx** - Clears badge when viewing notifications
3. **Settings screen** - Already has notification preference toggles

## Preferences

Notification preferences are managed through the existing preferences system:

```typescript
interface AppPreferences {
  notificationsEnabled: boolean;
  notifyOnLikes: boolean;
  notifyOnReplies: boolean;
  notifyOnFollows: boolean;
  notifyOnMentions: boolean;
  notifyOnQuotes: boolean;
}
```

The poller respects the `notificationsEnabled` master toggle. Individual notification type preferences are stored for future use when implementing richer notifications (Phase 2).

## Configuration

### app.config.ts

```typescript
notification: {
  icon: "./assets/notification-icon.png",
  color: "#1d9bf0",
  androidMode: "default",
  androidCollapsedTitle: "{{unread_count}} new notifications",
},
plugins: [
  "expo-router",
  [
    "expo-notifications",
    {
      icon: "./assets/notification-icon.png",
      color: "#1d9bf0",
      sounds: [],
    },
  ],
],
```

## Usage

### For Users

1. Launch app and sign in
2. After 2 seconds, permission dialog appears
3. Grant notification permission
4. Notifications will appear when app is backgrounded and new activity occurs
5. Tap notification to jump to Notifications tab
6. Badge count shows unread count on app icon

### Settings

Users can control notifications in Settings > Notifications:
- Master toggle: Enable/disable all notifications
- Per-type toggles: Likes, Replies, Follows, Mentions, Quotes (saved for Phase 2)

## Limitations (MVP)

1. **Generic notifications only** - All notifications say "You have X new notifications"
2. **Requires background execution** - Notifications only work if app is running in background
3. **Battery impact** - Polling every 60 seconds drains battery
4. **No true push** - Notifications are not instant; they arrive on next poll cycle
5. **No notification grouping** - Each poll creates one notification

## Future Enhancements

### Phase 2: Richer Notifications

To show specific notification content ("alice liked your post"):
1. Store last seen notification list in AsyncStorage
2. On each poll, fetch notification items (not just count)
3. Compare with previous list to find new notifications
4. Show individual local notifications for each new item

Implementation complexity: Medium
Benefit: Better user experience, specific action context

### Phase 3: True Push Notifications

To implement real push notifications:
1. Build a server that polls Bluesky API per user
2. Create push token registration endpoint
3. Integrate with APNs (iOS) and FCM (Android)
4. Server sends push when new notifications detected

Implementation complexity: High
Requires: Backend infrastructure, APNs/FCM setup, token management
Benefit: Instant delivery, no battery drain, works when app is closed

## Testing

### Manual Testing Checklist

- [ ] Permission request appears after login
- [ ] Notifications appear when app is backgrounded and activity occurs
- [ ] Tapping notification navigates to Notifications tab
- [ ] Badge count updates correctly
- [ ] Badge clears when viewing Notifications tab
- [ ] Master toggle in Settings disables notifications
- [ ] Notifications respect permission denial

### Testing on Real Device

1. Build development app: `npm run build:development`
2. Install on physical device (simulator notifications don't work)
3. Sign in and grant permission
4. Background the app
5. Generate activity on another device/web
6. Wait 60 seconds for poll cycle
7. Verify notification appears

## Dependencies

```json
{
  "expo-notifications": "~0.32.16",
  "expo-device": "~8.0.10",
  "expo-constants": "~18.0.13"
}
```

## Files Modified

- `mobile/package.json` - Added dependencies
- `mobile/app.config.ts` - Added notification configuration
- `mobile/app/(app)/_layout.tsx` - Added NotificationSetup component
- `mobile/src/components/NotificationSetup.tsx` - Created
- `mobile/src/components/index.ts` - Exported NotificationSetup
- `mobile/src/services/notification-poller.ts` - Created
- `mobile/src/hooks/useNotificationPermissions.ts` - Created
- `mobile/src/hooks/useNotificationHandler.ts` - Created
- `mobile/src/screens/notifications/NotificationsScreen.tsx` - Added badge clearing
- `mobile/assets/notification-icon.png` - Created

## Notes

- Notification icon is currently the app icon
- For production, consider creating a simpler monochrome icon for notifications
- The 60-second poll interval is configurable via `POLL_INTERVAL` constant
- Poller automatically stops when app is closed or user signs out
