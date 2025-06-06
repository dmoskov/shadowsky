# Architecture Critique & Improvement Plan
**Date**: June 6, 2025
**Perspective**: Principal Engineer with AT Protocol expertise

## Executive Summary
While the current implementation demonstrates a functional MVP, it lacks several architectural considerations critical for a robust AT Protocol client. The codebase needs significant restructuring to properly handle the decentralized nature of ATProto, improve type safety, and prepare for advanced features.

## Critical Issues

### 1. Insufficient AT Protocol Understanding
**Current State**: The app treats Bluesky as a centralized service, hardcoding `https://bsky.social`.

**Issues**:
- No support for self-hosted PDS (Personal Data Server)
- No understanding of DIDs (Decentralized Identifiers)
- Ignores the federated nature of AT Protocol
- No handle resolution through DNS

**Impact**: Users can't connect to alternative PDSes, limiting the client to Bluesky.social only.

### 2. Poor Type Safety
**Current State**: Liberal use of `any` types throughout the codebase.

**Issues**:
```typescript
// Current - too permissive
record: PostRecord | any
embed?: any
labels?: any[]

// Should be using proper AT Protocol types
import { AppBskyFeedPost, AppBskyFeedDefs } from '@atproto/api'
```

**Impact**: Runtime errors, poor IntelliSense, difficult debugging.

### 3. No Error Handling Strategy
**Current State**: Basic try-catch with console.error.

**Issues**:
- No distinction between network errors, auth errors, rate limits
- No retry logic for failed requests
- No user feedback for different error types
- No handling of AT Protocol specific errors (invalid DIDs, missing records)

### 4. Authentication Architecture
**Current State**: Simple username/password with localStorage.

**Issues**:
- No OAuth support
- No app passwords consideration
- Session stored as plain JSON
- No token refresh logic
- No support for 2FA

### 5. Data Fetching Anti-patterns
**Current State**: Direct API calls in components.

**Issues**:
- No caching strategy
- No pagination handling
- Re-fetches entire timeline on refresh
- No optimistic updates
- No real-time updates via FireHose

### 6. Missing AT Protocol Features
**Not Implemented**:
- Lexicon validation
- XRPC error handling  
- CID verification
- Record versioning
- Repo operations
- MST (Merkle Search Tree) understanding

## Improvement Plan

### Phase 1: Foundation (Week 1-2)

#### 1.1 Proper Type System
```typescript
// src/types/atproto.ts
export type {
  AppBskyFeedPost,
  AppBskyFeedDefs,
  AppBskyActorDefs,
  AppBskyGraphDefs,
  ComAtprotoSyncSubscribeRepos
} from '@atproto/api'

// src/types/app.ts
export interface Post extends AppBskyFeedDefs.PostView {
  // App-specific extensions only
}
```

#### 1.2 Service Architecture
```typescript
// src/services/atproto/client.ts
export class ATProtoClient {
  private agent: BskyAgent
  private pdsUrl: string
  private didResolver: DIDResolver
  
  constructor(config: ATProtoConfig) {
    // Support custom PDS URLs
  }
  
  async resolveHandle(handle: string): Promise<DID> {
    // Implement proper handle resolution
  }
}

// src/services/atproto/session.ts
export class SessionManager {
  private refreshTimer?: NodeJS.Timer
  
  async refreshSession() {
    // Implement token refresh
  }
  
  async validateSession() {
    // Check session validity
  }
}
```

#### 1.3 Error Handling
```typescript
// src/lib/errors.ts
export class ATProtoError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  ) {
    super(message)
  }
}

export class RateLimitError extends ATProtoError {
  constructor(public resetAt: Date) {
    super('RateLimit', 'Rate limit exceeded')
  }
}

// src/hooks/useErrorHandler.ts
export const useErrorHandler = () => {
  return useCallback((error: Error) => {
    if (error instanceof RateLimitError) {
      // Show specific UI for rate limits
    } else if (error instanceof ATProtoError) {
      // Handle AT Protocol errors
    }
    // ...
  }, [])
}
```

### Phase 2: Data Layer (Week 3-4)

#### 2.1 Implement Proper Data Fetching
```typescript
// src/lib/api/feed.ts
export class FeedAPI {
  async getTimeline(cursor?: string) {
    // Implement pagination
  }
  
  async subscribeToFirehose() {
    // Real-time updates
  }
}

// src/hooks/useTimeline.ts
export const useTimeline = () => {
  const { data, error, isLoading, fetchNextPage } = useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({ pageParam }) => feedAPI.getTimeline(pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
  })
  
  return { posts, error, isLoading, loadMore: fetchNextPage }
}
```

#### 2.2 Caching Strategy
```typescript
// src/lib/cache/postCache.ts
export class PostCache {
  private cache = new Map<string, Post>()
  private cidIndex = new Map<string, string>()
  
  set(uri: string, post: Post) {
    this.cache.set(uri, post)
    this.cidIndex.set(post.cid, uri)
  }
  
  getByCID(cid: string): Post | undefined {
    const uri = this.cidIndex.get(cid)
    return uri ? this.cache.get(uri) : undefined
  }
}
```

### Phase 3: Advanced Features (Week 5-6)

#### 3.1 Lexicon Support
```typescript
// src/lib/lexicon/validator.ts
export class LexiconValidator {
  validate(lexicon: string, data: unknown): boolean {
    // Implement lexicon validation
  }
}
```

#### 3.2 FireHose Integration
```typescript
// src/services/firehose/subscriber.ts
export class FirehoseSubscriber {
  private ws?: WebSocket
  
  async subscribe(opts: SubscribeOptions) {
    const ws = new WebSocket('wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos')
    // Handle real-time updates
  }
}
```

#### 3.3 Repository Operations
```typescript
// src/lib/repo/operations.ts
export class RepoOperations {
  async createRecord(params: CreateRecordParams) {
    // Handle CID generation
    // Validate against lexicon
    // Submit to PDS
  }
  
  async verifyRecord(uri: string, cid: string) {
    // Verify record integrity
  }
}
```

### Phase 4: UI/UX Improvements (Week 7-8)

#### 4.1 Optimistic Updates
```typescript
// src/hooks/useOptimisticPost.ts
export const useOptimisticPost = () => {
  const queryClient = useQueryClient()
  
  const createPost = useMutation({
    mutationFn: (text: string) => atproto.createPost(text),
    onMutate: async (text) => {
      // Optimistically update UI
      const tempPost = createOptimisticPost(text)
      queryClient.setQueryData(['timeline'], (old) => [tempPost, ...old])
      return { tempPost }
    },
    onError: (err, text, context) => {
      // Rollback on error
      queryClient.setQueryData(['timeline'], (old) => 
        old.filter(p => p.uri !== context.tempPost.uri)
      )
    }
  })
}
```

#### 4.2 Proper Loading States
```typescript
// src/components/Feed/FeedSkeleton.tsx
export const FeedSkeleton = () => {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </>
  )
}
```

### Phase 5: Production Readiness (Week 9-10)

#### 5.1 Performance
- Implement virtual scrolling for large feeds
- Add service worker for offline support
- Implement proper image lazy loading
- Add request deduplication

#### 5.2 Security
- Implement CSP headers
- Add input sanitization
- Validate all AT Protocol responses
- Implement proper CORS handling

#### 5.3 Monitoring
- Add error boundary components
- Implement telemetry
- Add performance monitoring
- Track AT Protocol specific metrics

## Migration Strategy

### Step 1: Type Safety (Immediate)
Replace all `any` types with proper AT Protocol types.

### Step 2: Service Layer (Week 1)
Extract all API calls into proper service classes.

### Step 3: Error Handling (Week 1)
Implement comprehensive error handling.

### Step 4: Data Management (Week 2)
Add React Query for caching and data synchronization.

### Step 5: Testing (Ongoing)
Add tests for all AT Protocol interactions.

## Success Metrics
- Support for multiple PDS endpoints
- Proper error handling for all edge cases
- Type-safe throughout
- Real-time updates via FireHose
- Offline support
- <100ms interaction feedback

## Recommended Dependencies
```json
{
  "@atproto/api": "latest",
  "@atproto/lexicon": "latest",
  "@atproto/xrpc": "latest",
  "@tanstack/react-query": "^5.x",
  "zod": "^3.x",
  "comlink": "^4.x"
}
```

## Conclusion
The current implementation is a good start but needs significant architectural improvements to be a proper AT Protocol client. The suggested improvements will make it more robust, type-safe, and ready for the decentralized nature of AT Protocol.