# Retry Logic with Exponential Backoff and Circuit Breaker

This document describes the retry mechanism implemented for API calls in the BSKY application.

## Overview

The retry logic provides automatic retry with exponential backoff and circuit breaker protection for all API operations. This ensures resilience against transient failures and rate limits while preventing cascading failures.

## Features

### 1. Exponential Backoff

- **Initial Delay**: 1 second
- **Max Delay**: 8 seconds
- **Pattern**: 1s → 2s → 4s → 8s
- **Max Retries**: 3 attempts
- **Jitter**: ±10% random variance to prevent thundering herd

### 2. Retry-After Header Support

- Automatically honors `Retry-After` headers from API responses
- Supports both absolute timestamps and relative delays
- Overrides exponential backoff when header is present

### 3. Circuit Breaker

- **Failure Threshold**: 5 consecutive failures
- **Reset Timeout**: 60 seconds
- **Half-Open State**: Requires 2 successful requests to close circuit
- **States**:
  - **CLOSED**: Normal operation, all requests pass through
  - **OPEN**: Circuit is open, requests fail immediately
  - **HALF_OPEN**: Testing if service has recovered

### 4. Retry Status Display

- Logs retry attempts with delay duration
- Displays circuit breaker state changes
- User-visible retry status (can be extended to UI notifications)

## Implementation

### Core Component: RetryClient

Located in `src/utils/retry-client.ts`, the `RetryClient` class provides:

```typescript
const retryClient = new RetryClient(
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    exponentialBase: 2,
    onRetry: (error, attempt, delayMs) => {
      // Log or display retry status
    },
  },
  {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 2,
  },
);
```

### Usage Example

#### Wrapping Individual API Calls

```typescript
import { RetryClient } from "../utils/retry-client";

const retryClient = new RetryClient();

async function fetchData() {
  return retryClient.execute(async () => {
    const response = await agent.api.someEndpoint();
    return response.data;
  });
}
```

#### Wrapping Entire Service

See `src/services/bluesky-list-service-with-retry.ts` for a complete example of integrating retry logic into a service.

```typescript
async getMyLists(): Promise<BlueskyList[]> {
  return retryClient.execute(async () => {
    const response = await this.agent!.app.bsky.graph.getLists({
      actor: did,
      limit: 100,
    });
    return response.data.lists;
  });
}
```

## Retry Conditions

The RetryClient automatically retries on:

1. **Network Errors**: Connection failures, timeouts, DNS errors
2. **HTTP 429**: Rate limit exceeded
3. **HTTP 5xx**: Server errors (500-599)
4. **Transient Failures**: ECONNREFUSED, ETIMEDOUT, etc.

Non-retryable errors (4xx except 429) fail immediately without retry.

## Circuit Breaker Behavior

### Opening the Circuit

After 5 consecutive failures, the circuit opens and all subsequent requests fail immediately with:

```
Circuit breaker is OPEN. Too many consecutive failures. Retry in Xs
```

### Half-Open State

After the reset timeout (60s), the circuit transitions to HALF_OPEN:

- Allows test requests through
- Requires 2 consecutive successes to close the circuit
- A single failure reopens the circuit

### Closing the Circuit

After 2 successful requests in HALF_OPEN state, the circuit closes and normal operation resumes.

## Monitoring

### Check Circuit Breaker State

```typescript
const state = retryClient.getCircuitBreakerState();
console.log(state);
// {
//   state: "CLOSED" | "OPEN" | "HALF_OPEN",
//   failureCount: number,
//   lastFailureTime: number
// }
```

### Reset Circuit Breaker

```typescript
retryClient.resetCircuitBreaker();
```

## Integration Status

### Completed

- ✅ RetryClient utility with exponential backoff
- ✅ Retry-After header handling
- ✅ Circuit breaker pattern
- ✅ Example integration (bluesky-list-service-with-retry.ts)
- ✅ Comprehensive logging

### Next Steps

To integrate retry logic into existing services:

1. Import `RetryClient` from `src/utils/retry-client.ts`
2. Create a service-level instance with desired configuration
3. Wrap API calls with `retryClient.execute()`
4. Add circuit breaker monitoring to service health checks
5. Display retry status in UI (optional)

### Services to Integrate

- `src/services/bluesky-list-service.ts` (example provided)
- `src/services/analytics.ts`
- `src/services/dm-service.ts`
- `src/services/notification-cache-service.ts`
- `src/services/post-cache-service.ts`
- `src/services/profile-cache-service.ts`
- Other services making external API calls

## Configuration

### Customizing Retry Behavior

```typescript
const customRetryClient = new RetryClient(
  {
    maxRetries: 5, // More retries
    initialDelayMs: 500, // Faster initial retry
    maxDelayMs: 16000, // Longer max delay
    exponentialBase: 3, // More aggressive backoff
    shouldRetry: (error, attempt) => {
      // Custom retry logic
      return error.status >= 500;
    },
    onRetry: (error, attempt, delayMs) => {
      // Custom retry notification
      showToast(`Retrying... (${attempt})`);
    },
  },
  {
    failureThreshold: 10, // More tolerant
    resetTimeoutMs: 30000, // Faster recovery
    halfOpenMaxAttempts: 3, // More test requests
  },
);
```

### Cancellation Support

```typescript
const controller = new AbortController();

retryClient.execute(
  async () => {
    const response = await fetch(url, { signal: controller.signal });
    return response.json();
  },
  { signal: controller.signal },
);

// Cancel the request and stop retrying
controller.abort();
```

## Best Practices

1. **Use Service-Level Instances**: Create one RetryClient per service for better monitoring
2. **Configure Appropriately**: Adjust retry settings based on API characteristics
3. **Monitor Circuit State**: Check circuit breaker state in health checks
4. **Log Retry Attempts**: Use `onRetry` callback for observability
5. **Respect Rate Limits**: Ensure retry delays are sufficient for rate-limited APIs
6. **Handle Circuit Open**: Provide user feedback when circuit is open
7. **Test Failure Scenarios**: Verify retry behavior under various failure modes

## Testing

### Simulating Failures

```typescript
// Test exponential backoff
let attempts = 0;
await retryClient.execute(async () => {
  attempts++;
  if (attempts < 3) throw new Error("Transient failure");
  return "success";
});

// Test circuit breaker
for (let i = 0; i < 6; i++) {
  try {
    await retryClient.execute(async () => {
      throw new Error("Service down");
    });
  } catch (e) {
    // Circuit should open after 5 failures
  }
}
```

### Manual Testing

1. Disconnect from internet
2. Make API calls through RetryClient
3. Observe retry attempts and exponential delays
4. Reconnect and verify recovery

## Troubleshooting

### Requests Failing Immediately

- Check if circuit breaker is OPEN
- Verify network connectivity
- Check error type is retryable

### Too Many Retries

- Reduce `maxRetries`
- Increase `failureThreshold`
- Adjust `shouldRetry` logic

### Circuit Always Open

- Increase `failureThreshold`
- Decrease `resetTimeoutMs`
- Check for persistent service issues

## References

- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [HTTP Retry-After Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
