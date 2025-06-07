# Rate Limiting and API Optimization Solution

## Problem Statement
During development, Hot Module Replacement (HMR) was causing cascading component updates, which resulted in multiple API calls to Bluesky's servers. This was potentially hitting rate limits and degrading the development experience.

## Solution Architecture

### 1. **Extended Cache Times** (Query Client)
- **Stale Time**: Increased from 1 minute to 5 minutes
- **Cache Time**: Increased from 5 minutes to 30 minutes
- **Benefits**: Reduces unnecessary refetches, keeps data fresh longer

### 2. **Client-Side Rate Limiting**
Implemented a token bucket algorithm with different limits for different endpoints:
- **General API**: 300 requests per 5 minutes
- **Feed API**: 100 requests per 5 minutes  
- **Interactions**: 500 requests per 5 minutes
- **Search**: 50 requests per minute

### 3. **Request Deduplication**
Prevents duplicate simultaneous requests:
- If an identical request is already in flight, returns the existing promise
- 5-second cache for pending requests
- Especially useful during HMR updates

### 4. **Exponential Backoff**
Added to retry logic:
- Waits 1s, 2s, 4s between retries
- Prevents aggressive retry loops

## Implementation Details

### Rate Limiter (`src/lib/rate-limiter.ts`)
```typescript
// Usage example
await withRateLimit(rateLimiters.feed, 'timeline', async () => {
  // Make API call
});
```

### Request Deduplication (`src/lib/request-deduplication.ts`)
```typescript
// Automatically applied to service methods
this.getTimeline = withDeduplication(
  this.getTimeline.bind(this),
  (cursor) => `timeline:${cursor || 'initial'}`
);
```

## Best Practices

1. **Development**:
   - Make smaller, incremental changes to avoid cascading HMR updates
   - Test API-heavy features with network throttling enabled
   - Monitor the browser's Network tab for duplicate requests

2. **Adding New API Endpoints**:
   - Always wrap with rate limiting
   - Add request deduplication for read operations
   - Choose appropriate rate limits based on endpoint usage

3. **Error Handling**:
   - Rate limit errors show user-friendly messages with wait times
   - Errors are properly propagated through the React Query layer

## Monitoring

To check current rate limit status:
```javascript
// In browser console
rateLimiters.feed.getTimeUntilNextRequest('timeline')
```

## Future Improvements

1. **Server-side caching**: Implement Redis/CDN caching
2. **Batch requests**: Combine multiple requests where possible
3. **WebSocket subscriptions**: For real-time updates without polling
4. **Analytics**: Track API usage patterns to optimize limits

## Testing

To test rate limiting:
```javascript
// Simulate rapid requests
for (let i = 0; i < 200; i++) {
  feedService.getTimeline().catch(console.error);
}
```

This solution makes the app a good citizen of the AT Protocol ecosystem while providing a smooth development and user experience.