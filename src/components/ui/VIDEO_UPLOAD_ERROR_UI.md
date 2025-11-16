# Video Upload Error UI Documentation

## Overview

The Video Upload Error UI provides comprehensive, user-friendly error messages for video upload failures with actionable recovery options. It integrates with the standardized error handling system to display clear explanations of what went wrong and how users can resolve the issue.

## Components

### VideoUploadErrorPanel

The main error display component that shows detailed error information with visual hierarchy based on error severity.

**Location**: `/src/components/ui/VideoUploadErrorPanel.tsx`

#### Props

```typescript
interface VideoUploadErrorPanelProps {
  error: StandardErrorResponse | { code?: string; message: string; retryable?: boolean };
  uploadId?: string;
  fileName?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}
```

#### Features

1. **Error Type Classification**
   - Network errors (timeout, connection failures, DNS)
   - Rate limiting (429 errors, quota limits)
   - Validation errors (file size, format, bad requests)
   - Processing errors (transcoding failures, timeouts)
   - Server errors (500, 503, unavailable)
   - Authentication errors (401, 403)

2. **Visual Hierarchy**
   - **Error** (red): Critical failures that cannot be retried (format issues, size exceeded, auth errors)
   - **Warning** (orange): Temporary issues that can be retried (timeouts, server unavailable)
   - **Info** (yellow): User action required (rate limits)

3. **Actionable Recovery Steps**
   - Each error type includes specific steps to resolve the issue
   - Clear guidance on what users can do to fix the problem
   - Technical context when helpful (e.g., "Maximum file size: 50MB")

4. **Accessibility**
   - ARIA live regions with `role="alert"` and `aria-live="assertive"`
   - Keyboard navigable buttons with visible focus indicators
   - Screen reader friendly with proper labels
   - Icons marked `aria-hidden` to avoid duplication

#### Usage

```tsx
import { VideoUploadErrorPanel } from './components/ui/VideoUploadErrorPanel';
import { mapATProtoError } from './services/atproto/error-handler';

// Map error to standard format
const standardError = mapATProtoError(error, 'videoUpload', { uploadId });

// Display error panel
<VideoUploadErrorPanel
  error={standardError}
  uploadId={uploadId}
  fileName="my-video.mp4"
  onRetry={() => retryUpload()}
  onCancel={() => cancelUpload()}
  compact={false}
/>
```

### UploadProgressBar (Enhanced)

The upload progress bar now automatically displays the error panel when an error occurs.

**Location**: `/src/components/ui/UploadProgressBar.tsx`

#### Error Integration

```tsx
// Automatically detects errors from metrics tracker
<UploadProgressBar
  uploadId={uploadId}
  fileName="my-video.mp4"
  onRetry={() => retryUpload()}
  onCancel={() => cancelUpload()}
  compact={false}
/>
```

When an error is detected:
1. Progress bar switches to error state
2. Error details are mapped to StandardErrorResponse
3. VideoUploadErrorPanel is rendered with full context
4. Recovery options are displayed based on error type

## Error Types and Messages

### Network Errors

#### Connection Timeout
- **Code**: `NETWORK_TIMEOUT`
- **User Message**: "The upload took too long to complete. This usually happens with slow connections or large files."
- **Recovery Steps**:
  - Check internet connection speed
  - Try uploading during off-peak hours
  - Consider compressing the video
- **Retryable**: Yes

#### Connection Failed
- **Code**: `NETWORK_CONNECTION` / `NETWORK_DNS`
- **User Message**: "Unable to connect to the server. Please check your internet connection."
- **Recovery Steps**:
  - Check internet connection
  - Disable VPN if using one
  - Restart router
- **Retryable**: Yes

### Rate Limiting

#### Rate Limit Exceeded
- **Code**: `RATE_LIMIT_EXCEEDED` / `RATE_LIMIT_QUOTA`
- **User Message**: "You've uploaded too many videos recently. Please wait a moment before trying again."
- **Recovery Steps**:
  - Wait a few minutes
  - Avoid uploading multiple videos simultaneously
- **Retryable**: Yes (with delay)

### Validation Errors

#### Video Too Large
- **Code**: `VIDEO_SIZE_EXCEEDED`
- **User Message**: "The video file exceeds the maximum size limit of 50MB."
- **Recovery Steps**:
  - Compress the video
  - Reduce resolution or quality
  - Trim video duration
  - Note: Maximum file size is 50MB
- **Retryable**: No (user must fix the file)

#### Invalid Format
- **Code**: `VIDEO_INVALID_FORMAT`
- **User Message**: "The video format is not supported. Please use MP4, MOV, MPEG, or WebM format."
- **Recovery Steps**:
  - Convert to MP4 (recommended)
  - Supported formats listed
  - Use video converter tool
- **Retryable**: No (user must fix the file)

### Processing Errors

#### Processing Failed
- **Code**: `VIDEO_PROCESSING_FAILED`
- **User Message**: "The server couldn't process your video. This may be due to codec issues or video corruption."
- **Recovery Steps**:
  - Re-encode with standard codecs (H.264)
  - Verify video plays correctly
  - Try a different video file
- **Retryable**: No

#### Processing Timeout
- **Code**: `VIDEO_PROCESSING_TIMEOUT`
- **User Message**: "Video processing timed out. Your video may still be processing in the background."
- **Recovery Steps**:
  - Wait and check if video appears in posts
  - Try uploading a shorter video
  - Reduce video quality
- **Retryable**: Yes

### Server Errors

#### Service Unavailable
- **Code**: `SERVER_UNAVAILABLE` / `SERVER_OVERLOADED`
- **User Message**: "The video service is currently experiencing issues. Please try again in a few minutes."
- **Recovery Steps**:
  - Wait 5-10 minutes
  - Check Bluesky status page
- **Retryable**: Yes

#### Internal Error
- **Code**: `SERVER_INTERNAL`
- **User Message**: "An internal server error occurred. This is not your fault."
- **Recovery Steps**:
  - Wait a few minutes and retry
  - Report if issue persists
- **Retryable**: Yes

### Authentication Errors

#### Token Expired
- **Code**: `AUTH_EXPIRED_TOKEN` / `AUTH_INVALID_TOKEN`
- **User Message**: "Your session has expired. Please log in again to continue."
- **Recovery Steps**:
  - Log out and log back in
  - Retry upload after re-authentication
- **Retryable**: No (requires login)

#### Forbidden
- **Code**: `CLIENT_FORBIDDEN`
- **User Message**: "You don't have permission to upload videos to this account."
- **Recovery Steps**:
  - Verify correct account
  - Contact support if error persists
- **Retryable**: No

## Testing

### VideoUploadErrorDemo Component

A comprehensive demo component is available to test all error states.

**Location**: `/src/components/ui/VideoUploadErrorDemo.tsx`

#### Features
- Interactive error type selector
- Layout switcher (full/compact)
- Live preview of error UI
- JSON view of error details
- Accessibility documentation

#### Usage

```tsx
import { VideoUploadErrorDemo } from './components/ui/VideoUploadErrorDemo';

// Render demo component
<VideoUploadErrorDemo />
```

The demo includes all 12 error types with realistic examples:
1. Network Timeout
2. Network Connection Failed
3. Rate Limit Exceeded
4. Video Size Exceeded
5. Invalid Video Format
6. Video Processing Failed
7. Video Processing Timeout
8. Server Unavailable
9. Internal Server Error
10. Authentication Expired
11. Forbidden Access
12. Validation Error

## Integration with Error Handling System

The error UI integrates seamlessly with the standardized error handling system:

### Error Flow

1. **Error Occurs**: Video upload fails in `VideoUploadService`
2. **Error Mapping**: Error is mapped to `StandardErrorResponse` by `mapATProtoError()`
3. **Metrics Tracking**: Error is tracked by `VideoUploadMetricsTracker`
4. **UI Display**: `UploadProgressBar` detects error and renders `VideoUploadErrorPanel`
5. **User Action**: User sees clear explanation and recovery options

### Error Response Format

```typescript
interface StandardErrorResponse {
  code: ATProtoErrorCode;
  message: string;
  context: {
    endpoint?: string;
    uploadId?: string;
    jobId?: string;
    status?: number;
    originalError?: string;
    timestamp: string;
    [key: string]: any;
  };
  retryable: boolean;
}
```

## Design Patterns

### Color Coding
- **Red**: Critical errors (cannot retry, user must fix)
- **Orange**: Warning errors (temporary, can retry)
- **Yellow**: Informational (user action required)

### Layout Modes
- **Full**: Detailed error with all recovery steps (default)
- **Compact**: Minimal error display for inline contexts

### Button Actions
- **Retry**: Shown for retryable errors only
- **Cancel**: Always available (except in some compact contexts)
- **Action Label**: Contextual based on error type

## Best Practices

1. **Always provide context**: Include upload ID, file name, and relevant technical details
2. **Be specific**: Explain exactly what went wrong and why
3. **Offer solutions**: Give users clear steps to resolve the issue
4. **Consider retry logic**: Only show retry button for transient errors
5. **Use appropriate severity**: Match visual styling to error severity
6. **Test accessibility**: Verify with screen readers and keyboard navigation
7. **Log errors properly**: Ensure all errors are logged with full context

## Future Enhancements

Potential improvements for future versions:

1. **Error Analytics**: Track which errors occur most frequently
2. **Automatic Retry**: Implement smart retry logic for certain error types
3. **Progress Resumption**: Allow users to resume failed uploads
4. **Detailed Diagnostics**: Add network diagnostics for connection issues
5. **Error History**: Show history of errors for debugging
6. **Contextual Help**: Link to help articles for specific error types
7. **Localization**: Support multiple languages for error messages

## Accessibility Compliance

The error UI meets WCAG 2.1 AA standards:

- ✅ Perceivable: Clear visual hierarchy and color contrast
- ✅ Operable: Keyboard navigable with visible focus indicators
- ✅ Understandable: Clear language and consistent behavior
- ✅ Robust: Proper ARIA attributes and semantic HTML

## References

- [Error Handler Documentation](/src/services/atproto/error-handler.ts)
- [Video Upload Service](/src/services/atproto/video-upload.ts)
- [Upload Metrics Tracker](/src/utils/video-upload-metrics.ts)
- [Retry Utility](/src/utils/retry.ts)
