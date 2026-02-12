# Services Directory (`/src/services`)

## Overview
The services directory contains all business logic, API integrations, and data management code for Asphodel. Services abstract complex operations and provide clean interfaces for React components to consume.

## Directory Structure

```
services/
├── atproto/              # AT Protocol/Bluesky API integration
├── bookmark-backends/    # Bookmark storage implementations
├── storage/             # Generic storage backend interfaces
├── bookmark-service-wrapper.ts    # Bookmark service with storage switching
├── bookmark-service-v2.ts        # Core bookmark business logic
├── column-service.ts             # SkyDeck column management
├── draft-service.ts              # Post draft management
├── notification-service.ts       # Notification handling
├── analytics-service.ts          # Analytics and metrics
├── preference-service.ts         # User preferences
├── jetstream-service.ts         # WebSocket real-time updates
└── [feature]-service.ts         # Other feature services
```

## Service Architecture

### Three-Layer Pattern
```
┌─────────────────────────────────┐
│     Service Wrapper             │ ← Handles initialization
├─────────────────────────────────┤
│     Core Service                │ ← Business logic
├─────────────────────────────────┤
│     Storage Backend             │ ← Data persistence
└─────────────────────────────────┘
```

### Service Wrapper
Manages service lifecycle and storage switching:
```typescript
export class BookmarkServiceWrapper {
  private service?: BookmarkService;

  async initialize(storageType: StorageType) {
    const backend = this.createBackend(storageType);
    this.service = new BookmarkService(backend);
    await this.service.initialize();
  }

  async switchStorage(newType: StorageType) {
    const oldData = await this.service.exportAll();
    await this.initialize(newType);
    await this.service.importAll(oldData);
  }
}
```

### Core Service
Implements business logic:
```typescript
export class BookmarkService {
  constructor(private backend: StorageBackend) {}

  async addBookmark(post: Post): Promise<void> {
    // Business logic validation
    if (!post.uri) throw new Error('Invalid post');

    // Transform data
    const bookmark = this.transformToBookmark(post);

    // Persist via backend
    await this.backend.save(bookmark);

    // Update cache
    this.invalidateCache();
  }
}
```

### Storage Backend
Handles data persistence:
```typescript
export interface StorageBackend {
  save(data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

## Service Categories

### 1. Core Services
**Purpose**: Main business features
**Examples**:
- `bookmark-service-v2`: Bookmark management
- `column-service`: Column configuration
- `draft-service`: Draft posts
- `notification-service`: Notifications

### 2. API Services
**Purpose**: External API integration
**Examples**:
- `atproto/*`: Bluesky/AT Protocol APIs
- `giphy-service`: GIF search
- `anthropic-service`: AI services

### 3. Storage Services
**Purpose**: Data persistence abstraction
**Examples**:
- `storage/LocalStorageBackend`: Browser storage
- `storage/SingletonBackend`: AT Protocol storage
- `storage/IndexedDBBackend`: Large data storage

### 4. Utility Services
**Purpose**: Support and infrastructure
**Examples**:
- `analytics-service`: Metrics tracking
- `logger-service`: Logging infrastructure
- `error-service`: Error handling

## Service Patterns

### Singleton Pattern
Services are typically singletons:
```typescript
class NotificationService {
  private static instance?: NotificationService;

  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }
}
```

### Async Initialization
Services may require async setup:
```typescript
class Service {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadConfiguration();
    await this.connectToBackend();

    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Service not initialized');
    }
  }
}
```

### Event Emitter Pattern
For real-time updates:
```typescript
class RealtimeService extends EventEmitter {
  connect() {
    this.websocket = new WebSocket(url);

    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit('update', data);
    };
  }
}
```

## AT Protocol Integration (`/atproto`)

### Agent Management
```typescript
// Central agent instance
export class ATProtoAgent {
  private agent: BskyAgent;

  async login(identifier: string, password: string) {
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
    await this.agent.login({ identifier, password });
    return this.agent.session;
  }

  getAgent(): BskyAgent {
    if (!this.agent) throw new Error('Not authenticated');
    return this.agent;
  }
}
```

### Record Operations
```typescript
// CRUD operations for AT Protocol records
export class RecordService {
  async create(collection: string, record: any) {
    return await agent.api.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection,
      record
    });
  }

  async update(uri: string, record: any) {
    // Parse URI and update
  }

  async delete(uri: string) {
    // Parse URI and delete
  }
}
```

### Collections
AT Protocol collections used:
- `com.shadowsky.bookmarks`: Bookmarked posts
- `com.shadowsky.columns`: Column configuration
- `com.shadowsky.drafts`: Draft posts
- `com.shadowsky.preferences`: User preferences

## Storage Backend Implementations

### LocalStorageBackend
```typescript
export class LocalStorageBackend implements StorageBackend {
  constructor(private prefix: string) {}

  async save(key: string, data: any) {
    const storageKey = `${this.prefix}-${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  async load(key: string) {
    const storageKey = `${this.prefix}-${key}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  }
}
```

### SingletonBackend (AT Protocol)
```typescript
export class SingletonBackend implements StorageBackend {
  constructor(
    private agent: BskyAgent,
    private collection: string
  ) {}

  async save(data: any) {
    // Save as singleton record with rkey "self"
    await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session.did,
      collection: this.collection,
      rkey: 'self',
      record: data
    });
  }
}
```

### IndexedDBBackend
```typescript
export class IndexedDBBackend implements StorageBackend {
  private db: IDBDatabase;

  async initialize() {
    this.db = await openDB('shadowsky', 1, {
      upgrade(db) {
        db.createObjectStore('data');
      }
    });
  }

  async save(key: string, data: any) {
    const tx = this.db.transaction('data', 'readwrite');
    await tx.objectStore('data').put(data, key);
  }
}
```

## Service Usage in Components

### Using Services with Hooks
```typescript
// Custom hook wrapping service
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    bookmarkService.getAll().then(setBookmarks);

    const handleUpdate = (updated) => setBookmarks(updated);
    bookmarkService.on('update', handleUpdate);

    return () => bookmarkService.off('update', handleUpdate);
  }, []);

  return bookmarks;
}
```

### Direct Service Usage
```typescript
// In event handlers
async function handleAddBookmark(post: Post) {
  try {
    await bookmarkService.add(post);
    toast.success('Bookmarked!');
  } catch (error) {
    toast.error('Failed to bookmark');
  }
}
```

## Error Handling

### Service Errors
```typescript
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Usage
throw new ServiceError(
  'Failed to save bookmark',
  'STORAGE_ERROR',
  { originalError: error }
);
```

### Error Recovery
```typescript
class ResilientService {
  async operation() {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.attemptOperation();
      } catch (error) {
        if (attempt === 2) throw error;
        await this.delay(1000 * Math.pow(2, attempt));
      }
    }
  }
}
```

## Testing Services

### Mocking Services
```typescript
// Mock implementation
export class MockBookmarkService implements BookmarkService {
  private bookmarks = [];

  async add(bookmark) {
    this.bookmarks.push(bookmark);
  }

  async getAll() {
    return this.bookmarks;
  }
}
```

### Testing Service Logic
```typescript
describe('BookmarkService', () => {
  let service: BookmarkService;
  let backend: MockStorageBackend;

  beforeEach(() => {
    backend = new MockStorageBackend();
    service = new BookmarkService(backend);
  });

  it('should add bookmark', async () => {
    const post = createMockPost();
    await service.add(post);

    expect(backend.saved).toHaveLength(1);
    expect(backend.saved[0]).toMatchObject({
      uri: post.uri
    });
  });
});
```

## Performance Considerations

### Caching Strategy
```typescript
class CachedService {
  private cache = new Map();
  private cacheTime = 5 * 60 * 1000; // 5 minutes

  async getData(key: string) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.time < this.cacheTime) {
      return cached.data;
    }

    const data = await this.fetchData(key);
    this.cache.set(key, { data, time: Date.now() });
    return data;
  }
}
```

### Batch Operations
```typescript
class BatchService {
  private queue = [];
  private timer;

  async add(item) {
    this.queue.push(item);
    this.scheduleBatch();
  }

  private scheduleBatch() {
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.processBatch();
      this.timer = null;
    }, 100);
  }

  private async processBatch() {
    const items = this.queue.splice(0);
    await this.backend.batchSave(items);
  }
}
```

## Service Checklist

When creating a new service:

- [ ] Define clear service interface
- [ ] Implement error handling
- [ ] Add initialization logic if needed
- [ ] Create storage backend if required
- [ ] Add caching where appropriate
- [ ] Write unit tests
- [ ] Document public methods
- [ ] Add TypeScript types
- [ ] Consider performance impact
- [ ] Handle cleanup/disposal

## Related Documentation

- **[atproto/README.md](atproto/README.md)**: AT Protocol integration
- **[storage/README.md](storage/README.md)**: Storage backend details
- **[bookmark-backends/README.md](bookmark-backends/README.md)**: Bookmark storage

---

*Services are the backbone of business logic. Keep them focused, testable, and independent of UI concerns.*