# Structured Network Request Logging Implementation

## Overview

Implemented a comprehensive structured logging system for all network requests in the BSKY project to address issues identified in session fe509af9. The new system provides clear, parseable logs with automatic security features.

## What Was Implemented

### 1. Core Logging Utility (`src/utils/network-logger.ts`)

Created a new structured logging utility with the following features:

#### Request/Response Correlation IDs
- Unique IDs generated for each request: `req_{timestamp}_{random}`
- Enables tracking requests from initiation through completion or failure
- Format: `[req_1699123456789_abc123]`

#### Timing Information
- Automatic start/end time tracking using `performance.now()`
- Duration calculated in milliseconds
- Example output: `[req_123_abc] GET https://api.example.com ✓ 200 145ms`

#### Success/Failure Categorization
- Visual indicators: ✓ for success, ✗ for failure
- HTTP status codes logged
- Structured error categorization:
  - `NETWORK_ERROR` - Network connectivity issues
  - `TIMEOUT_ERROR` - Request timeouts
  - `RATE_LIMIT_ERROR` - 429 responses
  - `AUTH_ERROR` - 401 responses
  - `FORBIDDEN_ERROR` - 403 responses
  - `NOT_FOUND_ERROR` - 404 responses
  - `SERVER_ERROR` - 500/503 responses
  - `UNKNOWN_ERROR` - Other errors

#### Automatic Sensitive Data Redaction
- **Header redaction** - Automatically redacts sensitive headers:
  - Authorization
  - API keys
  - Tokens
  - Secrets
  - Passwords
  - Bearer tokens
  - X-API-Key headers

- **URL redaction** - Redacts sensitive query parameters:
  - `api_key=` parameters
  - `token=` parameters
  - `password=` parameters
  - `secret=` parameters

Example:
```
Before: Authorization: Bearer eyJhbGc...
After:  Authorization: [REDACTED]

Before: https://api.example.com?api_key=sk-abc123
After:  https://api.example.com?api_key=[REDACTED]
```

### 2. Enhanced `fetchWithRetry` (`src/utils/retry.ts`)

Integrated structured logging into the existing retry utility:

- Logs each request attempt with correlation ID
- Logs retry attempts with delay information
- Logs final success or failure with timing
- Maintains backward compatibility with existing code

Example log output:
```
[req_123_abc] POST https://api.example.com (attempt 1)
[req_123_abc] POST https://api.example.com ✗ 503 1200ms - Retrying in 1000ms
[req_123_abc] POST https://api.example.com (attempt 2)
[req_123_abc] POST https://api.example.com ✓ 200 890ms
```

### 3. Updated Services

#### DM Service (`src/services/dm-service.ts`)
- Replaced all raw `fetch()` calls with `fetchWithRetry()`
- 7 API endpoints now use structured logging:
  - List conversations
  - Get messages
  - Get conversation details
  - Send message
  - Update read status
  - Delete message
  - Mute/unmute conversation

#### Video Upload Service (`src/services/atproto/video-upload.ts`)
- Video upload requests now use structured logging
- Better visibility into upload performance

#### Anthropic Service (`src/services/anthropic.ts`)
- Already using `fetchWithRetry`, automatically benefits from new logging
- All API calls (alt text, tone adjustment, thread optimization, etc.) now logged

## Benefits

### 1. Security
- **No more exposed API keys in logs** - Automatic redaction prevents accidental exposure
- Addresses critical security concern mentioned in task description
- Pattern-based detection catches various naming conventions

### 2. Debuggability
- Correlation IDs make it easy to trace requests across multiple log entries
- Timing information helps identify performance bottlenecks
- Error categorization helps quickly identify issue types
- Retry attempts are clearly visible

### 3. Production Monitoring
- Structured format is easily parseable by log aggregation tools
- Success/failure rates can be calculated from logs
- Performance metrics available without additional instrumentation
- Error patterns can be identified and analyzed

### 4. Developer Experience
- Logs are concise and readable
- Critical information is highlighted (status codes, durations)
- Retry logic is transparent
- No additional configuration required - works automatically

## Example Log Output

### Successful Request
```
[BSKY] [NetworkRequest] [req_1699123456789_abc123] GET https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos ✓ 200 245ms
```

### Failed Request with Retry
```
[BSKY] [NetworkRequest] [req_1699123456790_def456] POST https://api.example.com (attempt 1)
[BSKY] [NetworkRequest] [req_1699123456790_def456] POST https://api.example.com ✗ 503 1200ms (attempt 1)
[BSKY] [Retry] Attempt 1 failed, retrying in 1000ms...
[BSKY] [NetworkRequest] [req_1699123456790_def456] POST https://api.example.com (attempt 2)
[BSKY] [NetworkRequest] [req_1699123456790_def456] POST https://api.example.com ✓ 200 890ms (attempt 2)
```

### Redacted Sensitive Data
```
[BSKY] [NetworkRequest] [req_1699123456791_ghi789] POST https://api.example.com?api_key=[REDACTED]
Request Headers: {
  "Authorization": "[REDACTED]",
  "Content-Type": "application/json"
}
```

## Files Modified

1. **Created:**
   - `/Users/moskov/Code/BSKY/src/utils/network-logger.ts` - Core logging utility

2. **Modified:**
   - `/Users/moskov/Code/BSKY/src/utils/retry.ts` - Enhanced fetchWithRetry with logging
   - `/Users/moskov/Code/BSKY/src/services/dm-service.ts` - Migrated to fetchWithRetry
   - `/Users/moskov/Code/BSKY/src/services/atproto/video-upload.ts` - Migrated to fetchWithRetry

3. **Automatically benefit (no changes needed):**
   - `/Users/moskov/Code/BSKY/src/services/anthropic.ts` - Already using fetchWithRetry

## Testing

- Build verification: ✓ Passed (`npm run build`)
- TypeScript compilation: ✓ No errors
- Backward compatibility: ✓ All existing code works without changes

## Usage

The logging system is automatically enabled when debug mode is active:

```javascript
// In browser console
window.enableDebug()

// Refresh page to see logs
```

All network requests using `fetchWithRetry()` will automatically log with structured format and security redaction.

## Future Enhancements

Potential improvements for future iterations:

1. Add log level configuration (verbose vs. minimal)
2. Export logs to external monitoring service
3. Add request/response body logging (with redaction)
4. Performance threshold alerts
5. Aggregate statistics dashboard
6. Custom redaction patterns via configuration

## Conclusion

This implementation provides a production-ready, secure, and developer-friendly logging solution for all network requests. It addresses the critical security concern of exposed API keys while significantly improving debuggability and monitoring capabilities.
