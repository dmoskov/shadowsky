# Utils Directory (`/src/utils`)

## Overview
This directory contains utility functions, helpers, and common tools used throughout the Asphodel application. These are pure functions and utilities that don't depend on React or application-specific business logic.

## Directory Structure

```
utils/
├── date.ts              # Date formatting and manipulation
├── string.ts            # String utilities and formatting
├── storage.ts           # Storage helpers and migrations
├── api.ts              # API request utilities
├── media.ts            # Image/video processing
├── validation.ts       # Input validation functions
├── formatting.ts       # Text and number formatting
├── crypto.ts           # Cryptographic utilities
├── performance.ts      # Performance monitoring
├── logger.ts           # Logging utilities
├── errors.ts           # Error handling utilities
├── constants.ts        # Application constants
└── index.ts            # Public exports
```

## Utility Categories

### 1. Date Utilities (`date.ts`)

```typescript
/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // Less than 1 minute
  if (diff < 60000) return 'just now';

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Default to full date
  return d.toLocaleDateString();
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = date.getTime() - Date.now();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (Math.abs(days) > 0) return rtf.format(days, 'day');
  if (Math.abs(hours) > 0) return rtf.format(hours, 'hour');
  if (Math.abs(minutes) > 0) return rtf.format(minutes, 'minute');
  return rtf.format(seconds, 'second');
}

/**
 * Parse ISO string safely
 */
export function parseISOString(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
```

### 2. String Utilities (`string.ts`)

```typescript
/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Convert to slug format
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate random ID
 */
export function generateId(prefix?: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@[\w.-]+/g;
  return text.match(mentionRegex) || [];
}
```

### 3. Storage Utilities (`storage.ts`)

```typescript
/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Storage with expiration
 */
export class ExpiringStorage {
  constructor(private storage: Storage = localStorage) {}

  set(key: string, value: any, ttlMs: number) {
    const item = {
      value,
      expiry: Date.now() + ttlMs,
    };
    this.storage.setItem(key, JSON.stringify(item));
  }

  get<T>(key: string): T | null {
    const itemStr = this.storage.getItem(key);
    if (!itemStr) return null;

    const item = safeJsonParse(itemStr, null);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.storage.removeItem(key);
      return null;
    }

    return item.value as T;
  }
}

/**
 * Migrate storage data
 */
export async function migrateStorage(
  fromKey: string,
  toKey: string,
  transform?: (data: any) => any
): Promise<void> {
  const data = localStorage.getItem(fromKey);
  if (!data) return;

  const parsed = safeJsonParse(data, null);
  if (!parsed) return;

  const transformed = transform ? transform(parsed) : parsed;
  localStorage.setItem(toKey, JSON.stringify(transformed));
  localStorage.removeItem(fromKey);
}
```

### 4. API Utilities (`api.ts`)

```typescript
/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Create query string from params
 */
export function createQueryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Parse AT Protocol URI
 */
export function parseAtUri(uri: string): {
  repo: string;
  collection: string;
  rkey: string;
} | null {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  return {
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  };
}
```

### 5. Media Utilities (`media.ts`)

```typescript
/**
 * Compress image before upload
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get video thumbnail
 */
export async function getVideoThumbnail(
  videoFile: File,
  timestamp = 0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    video.onloadedmetadata = () => {
      video.currentTime = timestamp;
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Thumbnail generation failed'));
      });
    };

    video.onerror = reject;
    video.src = URL.createObjectURL(videoFile);
  });
}
```

### 6. Validation Utilities (`validation.ts`)

```typescript
/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Bluesky handle
 */
export function isValidHandle(handle: string): boolean {
  const handleRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+$/i;
  return handleRegex.test(handle);
}

/**
 * Sanitize HTML
 */
export function sanitizeHtml(html: string): string {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}
```

### 7. Performance Utilities (`performance.ts`)

```typescript
/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Measure function performance
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    console.debug(`${name} took ${duration.toFixed(2)}ms`);

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${name} failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
}
```

### 8. Logger Utilities (`logger.ts`)

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private debugMode = false;

  enableDebug() {
    this.debugMode = true;
    this.level = LogLevel.DEBUG;
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  }
}

export const logger = new Logger();

// Global debug toggle
(window as any).enableDebug = () => logger.enableDebug();
```

### 9. Error Utilities (`errors.ts`)

```typescript
/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR', statusCode);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Error serialization
 */
export function serializeError(error: unknown): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
```

### 10. Constants (`constants.ts`)

```typescript
// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://bsky.social';

// Storage keys
export const STORAGE_KEYS = {
  AUTH_SESSION: 'shadowsky_auth_session',
  PREFERENCES: 'shadowsky_preferences',
  BOOKMARKS: 'shadowsky_bookmarks',
  COLUMNS: 'shadowsky_columns',
  DRAFTS: 'shadowsky_drafts',
} as const;

// Time constants
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Limits
export const LIMITS = {
  MAX_POST_LENGTH: 300,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_BOOKMARKS: 10000,
} as const;
```

## Testing Utilities

### Unit Tests
```typescript
// date.test.ts
import { formatDate, parseISOString } from './date';

describe('formatDate', () => {
  it('should format recent dates as relative', () => {
    const now = new Date();
    expect(formatDate(now)).toBe('just now');
  });

  it('should format old dates as absolute', () => {
    const oldDate = new Date('2020-01-01');
    expect(formatDate(oldDate)).toMatch(/1\/1\/2020/);
  });
});
```

## Best Practices

### Pure Functions
```typescript
// ✅ Good: Pure function
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ❌ Bad: Mutates input
export function addDaysMutating(date: Date, days: number): Date {
  date.setDate(date.getDate() + days);
  return date;
}
```

### Error Handling
```typescript
// ✅ Good: Explicit error handling
export function parseNumber(str: string): number | null {
  const num = Number(str);
  return isNaN(num) ? null : num;
}

// ❌ Bad: Throws on invalid input
export function parseNumberUnsafe(str: string): number {
  return Number(str); // Returns NaN on invalid input
}
```

### Type Safety
```typescript
// ✅ Good: Type-safe with generics
export function pick<T, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    result[key] = obj[key];
  });
  return result;
}
```

## Performance Considerations

### Memoization
```typescript
// Memoize expensive computations
const memoize = <T extends (...args: any[]) => any>(fn: T) => {
  const cache = new Map();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

export const expensiveOperation = memoize((data: any[]) => {
  // Expensive computation
  return data.reduce((acc, item) => acc + item.value, 0);
});
```

## Utility Checklist

When creating a new utility:

- [ ] Pure function (no side effects)
- [ ] Properly typed with TypeScript
- [ ] Error cases handled
- [ ] Edge cases considered
- [ ] Unit tests written
- [ ] JSDoc documentation added
- [ ] Performance optimized
- [ ] Exported from index.ts

## Related Documentation

- **[MDN Web Docs](https://developer.mozilla.org/)**: JavaScript standard library
- **[date-fns](https://date-fns.org/)**: Date utility library
- **[lodash](https://lodash.com/)**: Utility library reference

---

*Utilities should be pure, reusable, and well-tested. Keep them focused on a single responsibility.*