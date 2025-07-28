# Bluesky Notifications App

A dedicated notifications management app for Bluesky, providing advanced analytics, timeline views, and customizable notification settings with comprehensive Google Analytics integration.

## Features

- **Dashboard**: Overview of all notification activity with real-time stats
- **All Notifications**: Filterable feed of all your notifications
- **Timeline View**: Chronological view grouped by day
- **Analytics**: Detailed insights into your notification patterns
- **Settings**: Customize notification preferences and filters
- **Additional Tabs**: Search, Messages, Bookmarks, and Profile (placeholders for future features)

## Getting Started

### Installation

```bash
cd notifications-app
npm install
```

### Development

```bash
npm run dev
```

The app will run on http://localhost:5174 (different port from the main Bluesky client)

### Google Analytics Setup

1. Create a Google Analytics 4 property at https://analytics.google.com
2. Get your Measurement ID (format: G-XXXXXXXXXX)
3. Create a `.env` file in the notifications-app directory:
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
4. Analytics will automatically initialize when the app loads

### Build

```bash
npm run build
```

## Key Features

### 1. Notifications Dashboard
- Real-time notification stats
- Breakdown by notification type
- Recent activity feed
- Visual indicators for different interaction types

### 2. Filterable Notifications Feed
- Filter by type (likes, reposts, follows, mentions, replies)
- Toggle between all notifications and unread only
- Visual distinction for unread notifications

### 3. Timeline View
- Notifications grouped by day
- Chronological ordering within each day
- Sticky date headers for easy navigation

### 4. Analytics
- 7-day activity chart
- Most active users
- Engagement metrics
- Visual breakdown of notification types

### 5. Customizable Settings
- Sound notifications toggle
- Desktop notifications support
- Auto-refresh with customizable intervals
- Filter preferences (hide certain notification types)
- Priority mode (only from people you follow)

## Analytics Tracking

The app includes comprehensive Google Analytics tracking to help understand user behavior and improve the experience:

### User Actions Tracked
- **Authentication**: Login/logout events with PDS type (custom/default)
- **Page Views**: Automatic tracking of all route changes
- **Notification Interactions**:
  - Filter changes (all, likes, reposts, follows, etc.)
  - Notification views with type and count
  - Load performance (API vs cache)
- **Conversation Tracking**:
  - Conversation selections and views
  - Message counts per conversation
  - Search queries (anonymized)
- **Analytics Dashboard**:
  - Time range changes
  - Chart views and interactions
- **Performance Metrics**:
  - Notification load times
  - Cache performance
  - Background sync duration
  - Component render times

### Privacy Considerations
- User IDs are hashed/anonymized
- No personal content is tracked
- Only aggregate metrics are collected
- Users can opt out via browser settings

### Custom Events
The app tracks custom events with the following structure:
```javascript
{
  category: 'feature_name',
  action: 'user_action',
  label: 'optional_context',
  value: numeric_value
}
```

## Tech Stack

- React 18 with TypeScript
- Vite for fast development
- TanStack Query for data fetching
- Tailwind CSS for styling
- Framer Motion for animations
- AT Protocol SDK for Bluesky integration
- React Router for navigation

## Authentication

The app uses the same authentication system as the main Bluesky client, storing session data in localStorage with automatic session refresh.

## Future Enhancements

- Real-time notification streaming
- Advanced filtering and search
- Notification grouping and batching
- Export functionality
- Custom notification rules
- Integration with the main Bluesky client