# Authentication & Agent Usage Fixes TODO

## Critical Issues Fixed ✅
1. **SearchService** - Fixed to use `agent.app.bsky.feed.searchPosts()` ✅
2. **ThreadService** - Fixed to use `agent.app.bsky.feed.getPostThread()` ✅
3. **InteractionsService** - Fixed to accept authenticated agent ✅

## Remaining Issues to Fix

### 1. NotificationService
- [ ] Line 13: `agent.listNotifications()` → `agent.app.bsky.notification.listNotifications()`
- [ ] Line 29: `agent.updateSeenNotifications()` → `agent.app.bsky.notification.updateSeen()`
- [ ] Line 37: `agent.countUnreadNotifications()` → `agent.app.bsky.notification.getUnreadCount()`

### 2. ProfileService
- [ ] Line 11: `agent.getProfile()` → `agent.app.bsky.actor.getProfile()`
- [ ] Line 23: `agent.getAuthorFeed()` → Keep as is (convenience method still valid)
- [ ] Line 40: `agent.follow()` → `agent.app.bsky.graph.follow.create()`
- [ ] Line 49: `agent.deleteFollow()` → `agent.com.atproto.repo.deleteRecord()`
- [ ] Line 60: `agent.getFollowers()` → `agent.app.bsky.graph.getFollowers()`
- [ ] Line 80: `agent.getFollows()` → `agent.app.bsky.graph.getFollows()`

### 3. InteractionsService
- [ ] Line 28: `agent.like()` → `agent.app.bsky.feed.like.create()`
- [ ] Line 40: `agent.deleteLike()` → `agent.com.atproto.repo.deleteRecord()`
- [ ] Line 51: `agent.repost()` → `agent.app.bsky.feed.repost.create()`
- [ ] Line 63: `agent.deleteRepost()` → `agent.com.atproto.repo.deleteRecord()`
- [ ] Line 80: `agent.post()` → `agent.com.atproto.repo.createRecord()`
- [ ] Line 96: `agent.post()` → `agent.com.atproto.repo.createRecord()`
- [ ] Line 111: `agent.deletePost()` → `agent.com.atproto.repo.deleteRecord()`
- [ ] Line 122: `agent.follow()` → `agent.app.bsky.graph.follow.create()`
- [ ] Line 134: `agent.deleteFollow()` → `agent.com.atproto.repo.deleteRecord()`

### 4. Remove Dangerous Export
- [ ] Remove `export const atClient` from client.ts (line 139)

## Testing Plan
After fixes:
1. Test each interaction (like, repost, follow)
2. Test notifications
3. Test profile viewing and following
4. Ensure no authentication errors