# Cross-Reference Map for ShadowSky

## Overview

This document provides a comprehensive map of component dependencies, data flows, and relationships between different parts of the ShadowSky codebase. Use this as a quick reference to understand how components interact and where to find related code.

## Component Dependency Graph

```
App.tsx
├── AuthContext (provides authentication)
│   ├── LoginPage (consumes auth)
│   ├── AuthGuard (protects routes)
│   └── All authenticated components
├── QueryClient (provides data fetching)
│   ├── useBookmarks (data hook)
│   ├── useNotifications (data hook)
│   ├── useFeed (data hook)
│   └── All data-fetching components
├── ThemeContext (provides theme)
│   ├── All UI components
│   └── Settings page
└── Router
    ├── SkyDeck (main dashboard)
    ├── Settings (configuration)
    ├── Analytics (metrics)
    ├── Bookmarks (saved posts)
    └── Messages (DMs)
```

## Major Feature Dependencies

### SkyDeck (Multi-Column Dashboard)

**Location**: `src/components/SkyDeck/`
**Dependencies**:

- → `column-service.ts` (column configuration)
- → `notification-service.ts` (notification column)
- → `useAuth` (authentication)
- → `useFeed` (timeline data)
- → `useBookmarks` (bookmark column)
- → `useMessages` (DM column)
- → `StorageContext` (persistence)

**Used By**:

- ← `App.tsx` (main route)
- ← `Navigation` (quick access)

### Bookmarks System

**Location**: `src/components/Bookmarks/`, `src/services/bookmark-*`
**Dependencies**:

- → `bookmark-service-wrapper.ts` (initialization)
- → `bookmark-service-v2.ts` (business logic)
- → `LocalStorageBackend` or `SingletonBackend` (storage)
- → `useAuth` (user context)
- → `IndexedDB` (local storage)
- → `AT Protocol API` (remote storage)

**Used By**:

- ← `SkyDeck` (bookmark column)
- ← `PostActions` (bookmark button)
- ← `BookmarksPage` (dedicated view)

### Notifications System

**Location**: `src/components/Notifications/`, `src/services/notification-service.ts`
**Dependencies**:

- → `jetstream-service.ts` (real-time updates)
- → `IndexedDB` (caching)
- → `useAuth` (user context)
- → `AT Protocol API` (fetching)

**Used By**:

- ← `SkyDeck` (notification column)
- ← `Header` (notification badge)
- ← `NotificationsPage` (full view)

### Analytics Dashboard

**Location**: `src/components/Analytics/`
**Dependencies**:

- → `analytics-service.ts` (data collection)
- → `IndexedDB` (metrics storage)
- → `useAuth` (user context)
- → Chart libraries (visualization)

**Used By**:

- ← `Navigation` (menu item)
- ← `Settings` (storage metrics)

### Direct Messages

**Location**: `src/components/Messages/`
**Dependencies**:

- → `AT Protocol DM API` (message operations)
- → `useAuth` (app password required)
- → `ChatService` (conversation management)

**Used By**:

- ← `SkyDeck` (messages column)
- ← `MessagesPage` (full view)

## Service Layer Dependencies

### Authentication Service Chain

```
AuthContext
├── ATProtoAgent (manages Bluesky agent)
├── SessionManager (handles tokens)
├── All authenticated services
│   ├── BookmarkService
│   ├── NotificationService
│   ├── ColumnService
│   └── PreferenceService
└── All protected routes
```

### Storage Service Chain

```
StorageContext
├── PreferenceService (determines storage type)
├── Service Wrappers (handle switching)
│   ├── BookmarkServiceWrapper
│   ├── ColumnServiceWrapper
│   └── DraftServiceWrapper
└── Storage Backends
    ├── LocalStorageBackend (device storage)
    └── SingletonBackend (AT Protocol storage)
```

### Real-time Update Chain

```
JetstreamService (WebSocket)
├── NotificationService (notification updates)
├── FeedService (timeline updates)
└── React Query (cache invalidation)
    └── UI Components (re-render)
```

## Data Flow Patterns

### User Action → UI Update

```
1. User clicks bookmark button
   └→ PostActions component
      └→ bookmarkService.add(post)
         └→ Storage backend save
            └→ React Query invalidation
               └→ useBookmarks refetch
                  └→ UI re-render
```

### API Response → Storage → UI

```
1. API Response (notifications)
   └→ NotificationService process
      └→ IndexedDB cache
         └→ React Query update
            └→ useNotifications hook
               └→ NotificationList render
```

### Storage Migration Flow

```
1. User changes storage preference
   └→ Settings component
      └→ PreferenceService update
         └→ ServiceWrapper detect change
            └→ Export from old backend
               └→ Import to new backend
                  └→ Clear old storage
                     └→ UI notification
```

## File Relationships

### Core Application Files

| File         | Depends On           | Used By       |
| ------------ | -------------------- | ------------- |
| `main.tsx`   | React, App.tsx       | Browser entry |
| `App.tsx`    | All contexts, Router | main.tsx      |
| `Router.tsx` | All pages            | App.tsx       |

### Context Files

| Context              | Provides             | Used By                  |
| -------------------- | -------------------- | ------------------------ |
| `AuthContext`        | Authentication state | All protected components |
| `ThemeContext`       | Theme settings       | All UI components        |
| `PreferencesContext` | User preferences     | Settings, Services       |
| `ModerationContext`  | Content filtering    | Feed components          |

### Service Files

| Service                | Purpose        | Dependencies     |
| ---------------------- | -------------- | ---------------- |
| `bookmark-service-v2`  | Bookmark logic | Storage backends |
| `column-service`       | Column config  | Storage backends |
| `notification-service` | Notifications  | IndexedDB, API   |
| `jetstream-service`    | WebSocket      | AT Protocol      |
| `preference-service`   | Settings       | AT Protocol      |

### Hook Files

| Hook               | Purpose           | Uses                              |
| ------------------ | ----------------- | --------------------------------- |
| `useAuth`          | Auth state        | AuthContext                       |
| `useBookmarks`     | Bookmark data     | bookmark-service, React Query     |
| `useNotifications` | Notification data | notification-service, React Query |
| `useFeed`          | Timeline data     | AT Protocol API, React Query      |
| `usePreferences`   | User settings     | PreferencesContext                |

## Import Paths Quick Reference

### Common Imports

```typescript
// Contexts
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

// Hooks
import { useBookmarks } from "@/hooks/useBookmarks";
import { useNotifications } from "@/hooks/useNotifications";

// Services
import { bookmarkService } from "@/services/bookmark-service-wrapper";
import { columnService } from "@/services/column-service";

// Components
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Utils
import { formatDate } from "@/utils/date";
import { logger } from "@/utils/logger";

// Types
import type { Bookmark } from "@/types/bookmark.types";
```

## Component Communication Patterns

### Parent-Child Communication

```typescript
// Parent passes data down via props
<BookmarkList bookmarks={bookmarks} onDelete={handleDelete} />

// Child calls parent function
onClick={() => onDelete(bookmark.id)}
```

### Cross-Component Communication

```typescript
// Via Context
const { user } = useAuth();

// Via React Query cache
queryClient.setQueryData(["bookmarks"], newBookmarks);

// Via Event emitter (services)
bookmarkService.on("update", handleUpdate);
```

### Service Communication

```typescript
// Direct service calls
await bookmarkService.add(post);

// Service wrapper coordination
bookmarkServiceWrapper.switchStorage("atproto");

// Service events
notificationService.emit("new", notification);
```

## Testing Dependencies

### Test File Locations

```
src/
├── components/
│   └── Component.test.tsx    # Component tests
├── hooks/
│   └── __tests__/            # Hook tests
├── services/
│   └── service.test.ts       # Service tests
└── utils/
    └── util.test.ts          # Utility tests
```

### Test Utilities

| Utility               | Purpose            | Location                     |
| --------------------- | ------------------ | ---------------------------- |
| `renderWithProviders` | Wrap with contexts | `tests/utils/test-utils.tsx` |
| `mockAgent`           | Mock AT Protocol   | `tests/mocks/agent.ts`       |
| `createMockPost`      | Generate test data | `tests/mocks/data.ts`        |

## Performance Critical Paths

### High-Impact Components

1. **NotificationList** - Renders many items
   - Uses virtualization
   - Memoizes list items
   - Batches updates

2. **SkyDeck** - Multiple data streams
   - Lazy loads columns
   - Prefetches adjacent columns
   - Caches column data

3. **Feed** - Infinite scroll
   - Virtual scrolling
   - Incremental loading
   - Image lazy loading

### Optimization Points

| Component   | Optimization     | Impact               |
| ----------- | ---------------- | -------------------- |
| `PostList`  | Virtual scroll   | Reduces DOM nodes    |
| `Images`    | Lazy loading     | Reduces bandwidth    |
| `Analytics` | Data aggregation | Reduces calculations |
| `Search`    | Debouncing       | Reduces API calls    |

## Debugging Entry Points

### Key Debug Functions

```javascript
// Browser console
window.enableDebug(); // Enable verbose logging
window.clearAllStorage(); // Clear all data
window.inspectStorage(); // View storage contents
window.forceRefresh(); // Refresh all queries
```

### Log Points

| Location     | Purpose              | Level |
| ------------ | -------------------- | ----- |
| Service init | Track initialization | INFO  |
| API calls    | Request/response     | DEBUG |
| Storage ops  | Data persistence     | DEBUG |
| Errors       | Error tracking       | ERROR |

## Migration and Refactoring Guide

### When Modifying Components

1. Check this file for dependencies
2. Update affected services
3. Test data flows
4. Update type definitions
5. Run integration tests

### When Adding Features

1. Identify integration points
2. Follow existing patterns
3. Update this document
4. Add to appropriate section
5. Document new dependencies

### When Removing Features

1. Check for dependencies here
2. Remove from all sections
3. Clean up unused imports
4. Update tests
5. Verify no breaking changes

## Quick Navigation Index

### By Feature

- **Authentication**: AuthContext, useAuth, SessionManager
- **Bookmarks**: bookmark-service-v2, BookmarkList, useBookmarks
- **Columns**: column-service, SkyDeck, ColumnManager
- **Messages**: ChatService, MessageList, useMessages
- **Notifications**: notification-service, NotificationList, jetstream
- **Preferences**: PreferencesContext, preference-service, Settings
- **Storage**: StorageBackend, LocalStorage, SingletonBackend
- **Themes**: ThemeContext, ThemeProvider, useTheme

### By Technology

- **React Query**: useQuery hooks, queryClient, cache management
- **IndexedDB**: notification storage, post cache, analytics
- **WebSocket**: jetstream-service, real-time updates
- **AT Protocol**: agent, records, collections

---

_This cross-reference map is a living document. Update it when adding new features or modifying existing relationships._
