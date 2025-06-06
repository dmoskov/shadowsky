# AT Protocol Agent Usage Guide

## Overview
This guide documents the correct patterns for using the AT Protocol SDK in our Bluesky client to avoid authentication issues.

## Key Principles

### 1. Always Use Authenticated Agent
- ❌ **WRONG**: Import and use `atClient` directly
- ✅ **CORRECT**: Pass authenticated agent to services

```typescript
// WRONG
import { atClient } from './client'
class MyService {
  constructor() {
    this.agent = atClient // This is NOT authenticated!
  }
}

// CORRECT
class MyService {
  constructor(private agent: AtpAgent) {}
}
```

### 2. Use app.bsky.* Namespaces
The BskyAgent convenience methods are deprecated. Always use the full namespace:

```typescript
// WRONG - Convenience methods (deprecated)
await agent.getProfile({ actor: handle })
await agent.like(uri, cid)
await agent.post({ text: 'Hello' })

// CORRECT - Namespace methods
await agent.app.bsky.actor.getProfile({ actor: handle })
await agent.app.bsky.feed.like.create({ subject: { uri, cid } })
await agent.app.bsky.feed.post.create({}, { text: 'Hello', createdAt: new Date().toISOString() })
```

### 3. Service Pattern
All services should follow this pattern:

```typescript
export class MyService {
  constructor(private agent: AtpAgent) {}
  
  async myMethod() {
    return await this.agent.app.bsky.namespace.method(params)
  }
}

// Singleton with proper agent passing
let instance: MyService | null = null
export function getMyService(agent: AtpAgent): MyService {
  if (!instance) {
    instance = new MyService(agent)
  }
  return instance
}
```

### 4. In React Hooks/Components
```typescript
const { data } = useQuery({
  queryFn: async () => {
    const { atProtoClient } = await import('../services/atproto')
    const agent = atProtoClient.getAgent() // Use getAgent() method!
    if (!agent) throw new Error('Not authenticated')
    const service = getMyService(agent)
    return service.myMethod()
  }
})
```

## Common API Mappings

### Posts
- `agent.post()` → `agent.app.bsky.feed.post.create()`
- `agent.deletePost()` → `agent.com.atproto.repo.deleteRecord()`
- `agent.getPosts()` → `agent.app.bsky.feed.getPosts()`

### Likes
- `agent.like()` → `agent.app.bsky.feed.like.create()`
- `agent.deleteLike()` → `agent.com.atproto.repo.deleteRecord()`

### Reposts
- `agent.repost()` → `agent.app.bsky.feed.repost.create()`
- `agent.deleteRepost()` → `agent.com.atproto.repo.deleteRecord()`

### Follows
- `agent.follow()` → `agent.app.bsky.graph.follow.create()`
- `agent.deleteFollow()` → `agent.com.atproto.repo.deleteRecord()`

### Profile
- `agent.getProfile()` → `agent.app.bsky.actor.getProfile()`
- `agent.searchActors()` → `agent.app.bsky.actor.searchActors()`

### Feed
- `agent.getTimeline()` → Still available as convenience method
- `agent.getAuthorFeed()` → Still available as convenience method
- `agent.getPostThread()` → `agent.app.bsky.feed.getPostThread()`

### Notifications
- `agent.listNotifications()` → `agent.app.bsky.notification.listNotifications()`
- `agent.countUnreadNotifications()` → `agent.app.bsky.notification.getUnreadCount()`
- `agent.updateSeenNotifications()` → `agent.app.bsky.notification.updateSeen()`

## Testing Checklist
When implementing a new service method:
1. ✅ Service accepts AtpAgent in constructor
2. ✅ Uses app.bsky.* namespace for API calls
3. ✅ Hook/component gets agent via `atProtoClient.getAgent()`
4. ✅ Proper error handling with mapATProtoError
5. ✅ No direct imports of atClient