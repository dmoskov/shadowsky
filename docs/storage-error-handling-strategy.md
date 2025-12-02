# Storage Error Handling Strategy

## Decision: Hybrid Approach

**Date**: 2025-12-02
**Decision by**: User (via Asana task clarification)
**Asana Task**: [1212273729650982](https://app.asana.com/0/1211710875848660/1212273729650982)

### Context

Two implementation tasks had conflicting error handling philosophies:
- "Implement fail-loudly error handling" - storage errors should propagate with clear messages
- "Add Dexie error boundary for IndexedDB failures" - app should continue in network-only mode

### Resolution: Hybrid by Error Type

The chosen approach uses different handling strategies based on error severity:

| Error Type | Behavior | UI Feedback |
|------------|----------|-------------|
| **Transient** | Retry with backoff | Toast notification |
| **Permanent** | Graceful degradation | Persistent banner |
| **Critical** | Fail loudly | Modal dialog |

---

## Error Classifications

### 1. Transient Errors

Errors that are temporary and likely to resolve with retry.

**Examples:**
- Lock contention (database busy)
- Quota temporarily exceeded (user clearing space)
- Network timeout during sync
- Browser garbage collection interference
- Temporary file system issues

**Handling:**
- Automatic retry with exponential backoff (3 attempts)
- Show toast notification after first failure
- Update toast with retry progress
- If all retries fail, escalate to permanent error

**Toast Format:**
```
"Storage temporarily unavailable. Retrying... (1/3)"
"Storage temporarily unavailable. Retrying... (2/3)"
"Storage issue persisted. Working in network-only mode."
```

### 2. Permanent Errors

Errors that cannot be automatically resolved but allow partial functionality.

**Examples:**
- IndexedDB not available (private browsing mode)
- Database corruption detected
- Persistent quota exceeded (user at storage limit)
- Browser storage permissions denied
- Unsupported browser version

**Handling:**
- Continue with degraded functionality (network-only mode)
- Show persistent banner at top of screen
- Disable features that require local storage
- Log detailed error for debugging
- Provide user guidance for resolution

**Banner Format:**
```
"Local storage unavailable. Some features may be limited. [Learn more]"
"Storage full. Clear browser data to restore full functionality. [Help]"
"Private browsing detected. Offline features disabled."
```

### 3. Critical Errors

Errors that prevent core functionality and require immediate user attention.

**Examples:**
- Authentication/session storage failure
- Encryption key storage failure
- User preferences corruption (causes loop)
- Security-related storage issues
- Data integrity violations

**Handling:**
- Show modal dialog immediately
- Block further operations until acknowledged
- Provide clear explanation and recovery steps
- Option to retry or logout/refresh
- Track error for support escalation

**Modal Format:**
```
Title: "Storage Error"
Message: "Unable to save authentication data. This may affect your session."
Actions: [Retry] [Log Out]
```

---

## Implementation Guide

### Error Type Detection

```typescript
// src/types/storage-errors.ts

export enum StorageErrorSeverity {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  CRITICAL = 'critical'
}

export enum StorageErrorCode {
  // Transient
  LOCK_CONTENTION = 'LOCK_CONTENTION',
  QUOTA_TEMPORARY = 'QUOTA_TEMPORARY',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  DB_BUSY = 'DB_BUSY',

  // Permanent
  INDEXEDDB_UNAVAILABLE = 'INDEXEDDB_UNAVAILABLE',
  DB_CORRUPTION = 'DB_CORRUPTION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PRIVATE_BROWSING = 'PRIVATE_BROWSING',

  // Critical
  AUTH_STORAGE_FAILURE = 'AUTH_STORAGE_FAILURE',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',
  PREFERENCES_CORRUPTION = 'PREFERENCES_CORRUPTION',
  DATA_INTEGRITY = 'DATA_INTEGRITY'
}

export interface StorageError extends Error {
  code: StorageErrorCode;
  severity: StorageErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: string;
}

export function classifyStorageError(error: Error): StorageError {
  // Detection logic based on error type and message
  // See implementation section below
}
```

### Error Classification Logic

```typescript
export function classifyStorageError(error: unknown): StorageError {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : 'Error';

  // IndexedDB specific errors
  if (name === 'QuotaExceededError' || message.includes('quota')) {
    // Check if user can clear space (transient) vs hard limit (permanent)
    return {
      code: StorageErrorCode.QUOTA_EXCEEDED,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: true,
      userMessage: 'Storage full. Clear browser data to restore functionality.',
    };
  }

  if (message.includes('lock') || message.includes('busy')) {
    return {
      code: StorageErrorCode.LOCK_CONTENTION,
      severity: StorageErrorSeverity.TRANSIENT,
      recoverable: true,
      userMessage: 'Storage temporarily busy.',
    };
  }

  // Private browsing detection
  if (message.includes('InvalidStateError') ||
      message.includes('A mutation operation was attempted on a database')) {
    return {
      code: StorageErrorCode.PRIVATE_BROWSING,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: false,
      userMessage: 'Private browsing mode detected. Offline features disabled.',
    };
  }

  // Database not available
  if (typeof indexedDB === 'undefined' ||
      message.includes('indexedDB is not defined')) {
    return {
      code: StorageErrorCode.INDEXEDDB_UNAVAILABLE,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: false,
      userMessage: 'Local storage not available in this browser.',
    };
  }

  // Auth-related storage
  if (message.includes('auth') || message.includes('session') ||
      message.includes('token')) {
    return {
      code: StorageErrorCode.AUTH_STORAGE_FAILURE,
      severity: StorageErrorSeverity.CRITICAL,
      recoverable: false,
      userMessage: 'Unable to save authentication data.',
    };
  }

  // Default to transient (optimistic)
  return {
    code: StorageErrorCode.DB_BUSY,
    severity: StorageErrorSeverity.TRANSIENT,
    recoverable: true,
    userMessage: 'Storage operation failed. Retrying...',
  };
}
```

### Integration with Existing Error Handler

The existing `useErrorHandler` hook should be extended to handle storage-specific errors:

```typescript
// Extension to useErrorHandler for storage errors
export function useStorageErrorHandler() {
  const { showAlert } = useModal();
  const [degradedMode, setDegradedMode] = useState(false);
  const [storageBanner, setStorageBanner] = useState<string | null>(null);

  const handleStorageError = useCallback((error: Error, action: string) => {
    const classified = classifyStorageError(error);

    trackError(error, `storage:${classified.code}`);

    switch (classified.severity) {
      case StorageErrorSeverity.TRANSIENT:
        // Toast notification, handled by retry logic
        toast.warning(classified.userMessage);
        break;

      case StorageErrorSeverity.PERMANENT:
        // Set degraded mode and show banner
        setDegradedMode(true);
        setStorageBanner(classified.userMessage);
        debug.warn('Entering degraded storage mode:', classified);
        break;

      case StorageErrorSeverity.CRITICAL:
        // Modal dialog, block operations
        showAlert(classified.userMessage, {
          variant: 'error',
          title: 'Storage Error'
        });
        break;
    }

    return classified;
  }, [showAlert]);

  return { handleStorageError, degradedMode, storageBanner };
}
```

---

## UI Components

### Storage Banner Component

For permanent errors, display a persistent banner:

```typescript
// src/components/StorageBanner.tsx
interface StorageBannerProps {
  message: string;
  onDismiss?: () => void;
  learnMoreUrl?: string;
}

export function StorageBanner({ message, onDismiss, learnMoreUrl }: StorageBannerProps) {
  return (
    <div className="storage-banner warning" role="alert">
      <AlertTriangle className="icon" />
      <span>{message}</span>
      {learnMoreUrl && <a href={learnMoreUrl}>Learn more</a>}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss">
          <X />
        </button>
      )}
    </div>
  );
}
```

### Storage Context Provider

Provide storage state throughout the app:

```typescript
// src/contexts/StorageContext.tsx
interface StorageContextValue {
  isStorageAvailable: boolean;
  isDegradedMode: boolean;
  storageError: StorageError | null;
  clearStorageError: () => void;
}

export const StorageContext = createContext<StorageContextValue>({
  isStorageAvailable: true,
  isDegradedMode: false,
  storageError: null,
  clearStorageError: () => {},
});
```

---

## Retry Strategy

For transient errors, implement exponential backoff:

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

async function withStorageRetry<T>(
  operation: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const classified = classifyStorageError(error);

      // Only retry transient errors
      if (classified.severity !== StorageErrorSeverity.TRANSIENT) {
        throw error;
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1),
          RETRY_CONFIG.maxDelay
        );

        onRetry?.(attempt, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

---

## Migration Path

### Phase 1: Error Classification (Current)
- [x] Document hybrid strategy decision
- [ ] Create storage error types
- [ ] Implement classification logic

### Phase 2: UI Components
- [ ] Create StorageBanner component
- [ ] Create StorageContext provider
- [ ] Add toast notifications for transient errors

### Phase 3: Integration
- [ ] Update useStorageErrorManager to use classification
- [ ] Integrate retry logic with storage services
- [ ] Add degraded mode handling to affected components

### Phase 4: Testing & Validation
- [ ] Test transient error scenarios
- [ ] Test permanent error scenarios
- [ ] Test critical error scenarios
- [ ] Verify graceful degradation works

---

## Related Tasks

- **Blocked by this decision:**
  - Implement fail-loudly error handling in storage services
  - Add Dexie error boundary for IndexedDB failures

- **Implementation tasks:**
  - Create StorageError types and classification
  - Implement StorageBanner component
  - Add retry logic with backoff
  - Create StorageContext provider

---

## References

- [Error Boundaries Documentation](./error-boundaries.md)
- [Service README - Error Handling](../src/services/README.md)
- [Retry Logic Documentation](./RETRY_LOGIC.md)
