# Types Directory (`/src/types`)

## Overview
This directory contains TypeScript type definitions, interfaces, and type utilities for the ShadowSky application. All shared types across the application should be defined here to ensure consistency and type safety.

## Directory Structure

```
types/
├── api.types.ts         # API request/response types
├── auth.types.ts        # Authentication related types
├── bookmark.types.ts    # Bookmark data structures
├── column.types.ts      # SkyDeck column types
├── notification.types.ts # Notification types
├── preferences.types.ts # User preference types
├── storage.types.ts     # Storage backend types
├── ui.types.ts          # UI component prop types
├── utils.types.ts       # Utility type helpers
└── index.ts            # Public exports
```

## Type Categories

### 1. Domain Types
Business domain entities and models
```typescript
// bookmark.types.ts
export interface Bookmark {
  id: string;
  uri: string;
  cid: string;
  author: Author;
  content: string;
  createdAt: string;
  indexedAt: string;
  tags?: string[];
}

export interface Author {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}
```

### 2. API Types
Request and response types for API calls
```typescript
// api.types.ts
export interface ApiResponse<T> {
  data: T;
  cursor?: string;
  error?: ApiError;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}
```

### 3. Configuration Types
Settings and configuration structures
```typescript
// preferences.types.ts
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  storage: StoragePreferences;
}

export interface StoragePreferences {
  bookmarkStorageType: 'local' | 'custom';
  columnStorageType: 'local' | 'atproto';
  draftStorageType: 'local' | 'custom';
}
```

### 4. UI Types
Component prop types and UI-related types
```typescript
// ui.types.ts
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
```

## Type Patterns

### Union Types
```typescript
// Status types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Storage types
export type StorageType = 'local' | 'atproto' | 'custom';

// Column types
export type ColumnType =
  | 'notifications'
  | 'timeline'
  | 'bookmarks'
  | 'messages'
  | 'feed'
  | 'search';
```

### Discriminated Unions
```typescript
// Action types with discriminated unions
export type NotificationAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Notification[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'MARK_READ'; id: string }
  | { type: 'CLEAR_ALL' };

// Result types
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

### Generic Types
```typescript
// Pagination wrapper
export interface Paginated<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

// Async state
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

// Optional fields
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
```

### Utility Types
```typescript
// Make all properties required and non-nullable
export type Complete<T> = {
  [P in keyof Required<T>]: NonNullable<T[P]>;
};

// Deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Extract promise type
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Object value types
export type ValueOf<T> = T[keyof T];
```

## AT Protocol Types

### Record Types
```typescript
// AT Protocol record structure
export interface ATProtoRecord {
  uri: string;
  cid: string;
  value: Record<string, any>;
}

// Collection types
export interface BookmarkRecord {
  $type: 'com.shadowsky.bookmarks';
  items: BookmarkItem[];
  createdAt: string;
  updatedAt: string;
}
```

### Session Types
```typescript
export interface ATProtoSession {
  did: string;
  handle: string;
  email?: string;
  accessJwt: string;
  refreshJwt: string;
}
```

## Type Guards

### Creating Type Guards
```typescript
// Type guard functions
export function isBookmark(item: unknown): item is Bookmark {
  return (
    typeof item === 'object' &&
    item !== null &&
    'uri' in item &&
    'author' in item
  );
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    'message' in error
  );
}
```

### Using Type Guards
```typescript
function processItem(item: unknown) {
  if (isBookmark(item)) {
    // TypeScript knows item is Bookmark here
    console.log(item.author.handle);
  } else if (isApiError(item)) {
    // TypeScript knows item is ApiError here
    console.error(item.message);
  }
}
```

## Type Assertions

### Safe Type Assertions
```typescript
// Assert with validation
export function assertBookmark(item: unknown): asserts item is Bookmark {
  if (!isBookmark(item)) {
    throw new TypeError('Invalid bookmark structure');
  }
}

// Usage
function processBookmark(item: unknown) {
  assertBookmark(item);
  // TypeScript knows item is Bookmark after this point
  console.log(item.uri);
}
```

## Branded Types

### Creating Branded Types
```typescript
// Brand type for type safety
type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type PostId = Brand<string, 'PostId'>;
export type DID = Brand<string, 'DID'>;

// Helper functions
export function toUserId(id: string): UserId {
  return id as UserId;
}

export function toPostId(id: string): PostId {
  return id as PostId;
}
```

## Const Assertions

### Using Const Assertions
```typescript
// Define constants with literal types
export const STORAGE_TYPES = ['local', 'atproto', 'custom'] as const;
export type StorageType = typeof STORAGE_TYPES[number];

export const COLUMN_TYPES = {
  NOTIFICATIONS: 'notifications',
  TIMELINE: 'timeline',
  BOOKMARKS: 'bookmarks',
} as const;
export type ColumnType = ValueOf<typeof COLUMN_TYPES>;
```

## Type Imports/Exports

### Import Types
```typescript
// Import only the type
import type { User } from './user.types';

// Import both value and type
import { type User, createUser } from './user';

// Re-export types
export type { User, UserPreferences } from './user.types';
```

### Module Declarations
```typescript
// Declare module types
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.svg' {
  const content: React.FC<React.SVGProps<SVGSVGElement>>;
  export default content;
}
```

## Type Documentation

### JSDoc Comments
```typescript
/**
 * Represents a bookmarked post
 * @property uri - AT Protocol URI of the post
 * @property author - Author information
 * @property createdAt - ISO timestamp of bookmark creation
 */
export interface Bookmark {
  uri: string;
  author: Author;
  createdAt: string;
}
```

### Type Examples
```typescript
/**
 * Storage backend interface
 *
 * @example
 * ```typescript
 * const backend: StorageBackend = new LocalStorageBackend();
 * await backend.save('key', { data: 'value' });
 * const data = await backend.load('key');
 * ```
 */
export interface StorageBackend {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
}
```

## Best Practices

### 1. Naming Conventions
```typescript
// Interfaces: PascalCase, no I prefix
interface UserProfile { }  // ✅
interface IUserProfile { } // ❌

// Type aliases: PascalCase
type UserId = string;      // ✅

// Enums: PascalCase for name, UPPER_CASE for values
enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```

### 2. Organization
```typescript
// Group related types together
export interface User {
  id: UserId;
  profile: UserProfile;
  settings: UserSettings;
}

export interface UserProfile {
  name: string;
  avatar?: string;
}

export interface UserSettings {
  theme: Theme;
  notifications: boolean;
}
```

### 3. Avoid Type Duplication
```typescript
// ❌ Bad: Duplicated structure
interface ApiUser {
  id: string;
  name: string;
}

interface DbUser {
  id: string;
  name: string;
}

// ✅ Good: Shared base type
interface BaseUser {
  id: string;
  name: string;
}

interface ApiUser extends BaseUser {
  apiKey: string;
}

interface DbUser extends BaseUser {
  createdAt: Date;
}
```

## Type Testing

### Testing Types
```typescript
// Type-level tests
type Assert<T, U> = T extends U ? true : false;

// Test type equality
type TestBookmark = Assert<Bookmark, {
  uri: string;
  author: Author;
  createdAt: string;
}>;
```

## Migration Guide

### Adding New Types
1. Create type definition in appropriate file
2. Add JSDoc documentation
3. Export from index.ts
4. Update dependent code
5. Run type checking

### Refactoring Types
1. Mark old type as deprecated
2. Create new type definition
3. Add migration helper if needed
4. Update usages incrementally
5. Remove deprecated type

## Common Type Definitions

### Error Types
```typescript
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
```

### Event Types
```typescript
export type EventHandler<T = void> = (event: T) => void;
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>;
```

### Form Types
```typescript
export type FormErrors<T> = Partial<Record<keyof T, string>>;
export type FormTouched<T> = Partial<Record<keyof T, boolean>>;
```

## Related Documentation

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**: Official TypeScript documentation
- **[Type Challenges](https://github.com/type-challenges/type-challenges)**: TypeScript type exercises
- **[tsconfig.json](../../tsconfig.json)**: TypeScript configuration

---

*Types are the foundation of TypeScript. Keep them well-organized, documented, and consistent.*