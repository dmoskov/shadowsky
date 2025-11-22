# Error Boundaries Implementation

## Overview

Error boundaries have been implemented across all major components to prevent cascading failures and provide graceful error handling. When a component throws an error, the error boundary catches it, displays a user-friendly error message, and allows recovery without requiring a full page reload.

## Components Protected

The following major components are wrapped with error boundaries:

### In SkyColumn (Column-based views)

- **NotificationsFeed** - Notifications column
- **VisualTimeline** - Visual timeline view
- **Conversations** - Conversations/DM list
- **DirectMessagesColumn** - Direct messages interface
- **BookmarksColumn** - Bookmarks view
- **Home** - Feed/home timeline

### In App Router (Route-based views)

- **Lists** - Lists management page (`/lists`)
- **ListTimeline** - Individual list timeline view (`/lists/:listId`)

## Implementation Details

### ErrorBoundary Component

Located at: `src/components/ErrorBoundary.tsx`

Features:

- Catches JavaScript errors in child component tree
- Logs error details to console and localStorage (last 50 errors)
- Displays user-friendly error UI with:
  - Clear error message
  - Component name context
  - Technical details (collapsible)
  - "Try Again" button for recovery
- Supports custom fallback UI
- Integrates with error tracking via `onError` callback

### Error Tracking Hook

Located at: `src/hooks/useErrorTracking.ts`

Features:

- Logs errors with full context (stack trace, component stack, timestamp, URL, user agent)
- Stores errors in localStorage for debugging
- Ready for integration with external error tracking services (Sentry, etc.)

## Usage Examples

### Basic Usage

```tsx
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary componentName="My Feature">
      <MyFeatureComponent />
    </ErrorBoundary>
  );
}
```

### With Custom Fallback

```tsx
<ErrorBoundary componentName="Payment Form" fallback={<CustomErrorMessage />}>
  <PaymentForm />
</ErrorBoundary>
```

### With Error Tracking

```tsx
import { useErrorTracking } from "../hooks/useErrorTracking";

function MyComponent() {
  const { logError } = useErrorTracking();

  return (
    <ErrorBoundary
      componentName="Dashboard"
      onError={(error, errorInfo) => logError(error, errorInfo, "Dashboard")}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
```

## Benefits

1. **Isolation**: Errors in one component don't crash the entire application
2. **User Experience**: Users see helpful error messages instead of blank screens
3. **Recovery**: "Try Again" button allows users to retry without page refresh
4. **Debugging**: Detailed error information stored for developers
5. **Production Safety**: Other features continue working when one component fails

## Future Enhancements

### Sentry Integration (Recommended)

To integrate with Sentry:

1. Install Sentry SDK:

```bash
npm install @sentry/react
```

2. Initialize Sentry in `src/main.tsx`:

```tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

3. Update `useErrorTracking` hook to send errors to Sentry:

```tsx
import * as Sentry from "@sentry/react";

export const useErrorTracking = () => {
  const logError = (error: Error, errorInfo: ErrorInfo, context?: string) => {
    // Log to Sentry
    Sentry.withScope((scope) => {
      scope.setContext("errorBoundary", {
        componentStack: errorInfo.componentStack,
        context,
      });
      Sentry.captureException(error);
    });

    // Also log locally for development
    console.error("Error tracked:", { error, errorInfo, context });
  };

  return { logError };
};
```

## Testing

Tests are located at: `src/components/__tests__/ErrorBoundary.test.tsx`

Run tests with:

```bash
npm run test:unit ErrorBoundary
```

## Error Recovery

When users click "Try Again", the error boundary resets its state and re-renders the child component. This allows recovery from transient errors without requiring a full page reload.

## Monitoring

Errors are stored in localStorage under the key `app_errors` (last 50 errors). Access them via browser console:

```javascript
JSON.parse(localStorage.getItem("app_errors"));
```

## Performance Impact

Error boundaries have minimal performance impact:

- Only active when errors occur
- No overhead during normal operation
- Lightweight fallback UI rendering
