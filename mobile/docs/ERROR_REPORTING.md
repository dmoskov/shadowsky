# Error Reporting and Analytics

This document describes the crash reporting and error analytics system implemented using Sentry.

## Overview

The app uses Sentry to automatically capture and report:
- JavaScript exceptions and errors
- Native crashes (iOS and Android)
- Unhandled promise rejections
- Performance metrics (app startup, screen loads, API calls)
- User action breadcrumbs for debugging context

## Configuration

### Environment Variables

Set the following environment variables for Sentry integration:

```bash
# Required: Sentry DSN (Data Source Name)
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/789012

# Required for source maps upload
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=your-auth-token
```

### Development vs Production

- **Development**: Sentry is initialized but events are logged to console only (not sent to Sentry)
- **Preview/Production**: All errors and performance data are sent to Sentry

Source maps are uploaded for preview and production builds to enable readable stack traces.

## Features

### Automatic Error Capture

The following errors are automatically captured:

1. **React component errors** - via ErrorBoundary
2. **API errors** - via useErrorHandler hook
3. **Unhandled exceptions** - via Sentry.wrap()
4. **Promise rejections** - automatically tracked

### User Context

User context is automatically set on authentication:
- User DID is hashed (SHA-256, first 16 chars) for privacy
- No email or handle is sent
- User context is cleared on logout

### Breadcrumbs

User actions are tracked as breadcrumbs for debugging:

- **Authentication**: sign in, sign out, account switching
- **Navigation**: screen transitions
- **Compose**: start, publish, cancel, draft
- **Engagement**: like, unlike, repost, follow
- **Search**: search queries (truncated to 50 chars)
- **Notifications**: view, open, mark read
- **Profile**: view, edit
- **Media**: upload, view, download
- **Settings**: preference changes

### Performance Monitoring

Performance metrics tracked:
- App startup time
- Screen load times
- Native frame tracking
- User interaction tracing
- API call durations (via transaction tracking)

Sample rate: 50% in production

### Error Context

Errors include context:
- **Device info**: model, brand, OS version
- **App version**: from package.json
- **Platform**: iOS or Android
- **API errors**: endpoint, status code, HTTP method
- **Component stack**: for React errors
- **Error ID**: unique ID shown to users for reference

## Usage

### Manual Error Reporting

```typescript
import { captureException, captureMessage } from '../utils/error-reporting';

try {
  // Your code
} catch (error) {
  captureException(error, {
    endpoint: '/api/feed',
    statusCode: 500,
    method: 'GET',
    extra: {
      userId: 'did:plc:123',
      customData: 'value'
    }
  });
}

// Log informational messages
captureMessage('User completed onboarding', 'info');
```

### Activity Tracking

Use the `useActivityTracking` hook to track user actions:

```typescript
import { useActivityTracking } from '../hooks/useActivityTracking';

function MyComponent() {
  const { trackNavigation, trackCompose, trackLike, trackSearch } = useActivityTracking();

  // Track navigation
  useEffect(() => {
    trackNavigation('/profile/123');
  }, []);

  // Track compose
  const handlePublish = () => {
    trackCompose('publish', { hasImages: true, hasLinks: false });
  };

  // Track like
  const handleLike = (uri: string) => {
    trackLike('post', uri);
  };

  // Track search
  const handleSearch = (query: string) => {
    trackSearch('posts', query);
  };
}
```

### Performance Tracking

```typescript
import { startTransaction, startSpan } from '../utils/error-reporting';

// Start a transaction
const transaction = startTransaction('screen.home', 'navigation');

// Add spans for specific operations
const fetchSpan = startSpan(transaction, 'http.client', 'Fetch feed');
await fetchFeed();
fetchSpan?.finish();

const renderSpan = startSpan(transaction, 'ui.render', 'Render posts');
renderPosts();
renderSpan?.finish();

// Finish transaction
transaction?.finish();
```

### Custom Tags and Context

```typescript
import { setTag, setTags, setContext } from '../utils/error-reporting';

// Set a single tag
setTag('feature_flag', 'new_composer_enabled');

// Set multiple tags
setTags({
  user_tier: 'premium',
  experiment_variant: 'control'
});

// Set custom context
setContext('purchase', {
  productId: '123',
  price: 9.99,
  currency: 'USD'
});
```

## Privacy

The error reporting system is designed with privacy in mind:

- **No PII sent by default** (`sendDefaultPii: false`)
- **DIDs are hashed** (SHA-256) before sending
- **No email or handle** included
- **Search queries truncated** to 50 characters
- **AT Protocol URIs excluded** from breadcrumbs (only content type included)
- **Only error context** is sent, not user content

## Error Boundary

The app has a root-level ErrorBoundary that:
- Catches React component errors
- Shows a user-friendly error screen
- Reports errors to Sentry with component stack
- Generates unique error IDs for user reports
- Provides "Try Again" and "Go Home" actions

## Testing

### Test Error Reporting (Development)

```typescript
import { captureException } from '../utils/error-reporting';

// Throw a test error
captureException(new Error('Test error for Sentry'));

// In development, this will log to console only
// In production, this will be sent to Sentry
```

### Verify in Sentry Dashboard

1. Go to your Sentry project dashboard
2. Check **Issues** for captured errors
3. Check **Performance** for transaction data
4. Check **Breadcrumbs** in error details for user action history
5. Verify **User context** shows hashed DID
6. Verify **Device context** shows model, OS, version

## Troubleshooting

### Source maps not uploading

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check `SENTRY_ORG` and `SENTRY_PROJECT` are correct
3. Look for upload logs in EAS build output
4. Ensure sentry-expo plugin is configured in app.config.ts

### Errors not appearing in Sentry

1. Check `SENTRY_DSN` is set correctly
2. Verify you're testing in preview/production build (not dev)
3. Check Sentry project quota hasn't been exceeded
4. Look for initialization errors in console

### Stack traces are unreadable

1. Ensure source maps are uploaded for the build
2. Check the release version matches between app and Sentry
3. Verify `SENTRY_UPLOAD_SOURCE_MAPS=true` for the build profile

## Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Expo + Sentry Integration](https://docs.expo.dev/guides/using-sentry/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/react-native/performance/)
