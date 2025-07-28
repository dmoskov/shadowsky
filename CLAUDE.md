# Bluesky Client Project

## Project Overview
A custom Bluesky client built with React, TypeScript, and Vite that provides a clean, extensible interface for interacting with the AT Protocol. The client runs locally and is designed to be simple to understand, extend, and customize.

## Project Goals
1. **Create a functional Bluesky client** with core features (login, view feed, etc.)
2. **Respect AT Protocol conventions** and follow best practices
3. **Keep it simple and extensible** - easy to understand and modify
4. **Add custom "bells and whistles"** - unique features beyond the standard client
5. **Local-first approach** - runs on your machine with no external dependencies
6. **Version control with Git** - Manage all changes through Git for easy rollback and history tracking

## Technical Stack
- **Frontend**: React + TypeScript
- **Build Tool**: Vite (for fast development)
- **AT Protocol SDK**: @atproto/api, @atproto/lexicon, @atproto/xrpc
- **Data Fetching**: TanStack Query (React Query) for caching and synchronization
- **Validation**: Zod for runtime type validation
- **Styling**: Inline styles (for now, easy to migrate to CSS-in-JS later)
- **State Management**: React Context for auth, React Query for server state
- **Version Control**: Git (managed autonomously by Claude)
- **Error Handling**: Custom error classes with AT Protocol mapping

## Current Features
- ✅ Authentication with Bluesky credentials
- ✅ Session persistence with automatic refresh
- ✅ Timeline feed with infinite scrolling
- ✅ Proper error handling (rate limits, auth errors, etc.)
- ✅ Type-safe AT Protocol integration
- ✅ Optimistic UI updates ready
- ✅ Dark theme UI with modern design system
- ✅ Post display with:
  - Text content
  - Author information and avatars
  - Timestamps (relative time)
  - Engagement metrics (replies, reposts, likes)
  - Support for embeds (images, links, quotes)
  - Thread context and reply chains
  - Repost indicators
  - Animated engagement buttons
- ✅ Development tooling:
  - Automated server management
  - Chrome testing integration
  - Error detection and monitoring
  - Git hooks for stability

## Architecture Documentation

**IMPORTANT**: See `ARCHITECTURE.md` for detailed technical architecture documentation. This file provides comprehensive information about:
- System architecture and data flow
- Component structure and patterns
- Security considerations
- Performance optimization strategies
- Development guidelines
- Known issues and future plans

All developers (human and AI) should reference `ARCHITECTURE.md` for technical details.

## CRITICAL: Two Applications in This Repository

**⚠️ IMPORTANT**: See `APP_DISTINCTION_GUIDE.md` for understanding the two separate applications:
1. **Main Bluesky Client** (root directory) - Port 5173
2. **Notifications Analytics App** (`/notifications-app/`) - Port 5174

These are COMPLETELY SEPARATE applications. Always verify which one you're working on before making changes.

## Project Structure
```
BSKY/
├── src/
│   ├── components/       # React components
│   │   ├── Feed.tsx     # Timeline feed display
│   │   ├── Login.tsx    # Authentication form
│   │   ├── PostCard.tsx # Individual post display
│   │   ├── ParentPost.tsx # Thread parent display
│   │   └── ...
│   ├── contexts/        # React contexts
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── services/        # API services
│   │   └── atproto/     # AT Protocol service layer
│   │       ├── client.ts    # Main AT Proto client
│   │       ├── feed.ts      # Feed-related operations
│   │       └── index.ts     # Service exports
│   ├── hooks/           # Custom React hooks
│   │   ├── useErrorHandler.ts  # Centralized error handling
│   │   └── useTimeline.ts      # Timeline data fetching
│   ├── lib/             # Utility libraries
│   │   ├── errors.ts         # Error classes and mapping
│   │   └── query-client.ts   # React Query configuration
│   ├── types/           # TypeScript type definitions
│   │   ├── atproto.ts       # AT Protocol types
│   │   └── app.ts          # Application types
│   ├── styles/          # CSS modules and design system
│   │   ├── design-system.css # CSS variables and tokens
│   │   ├── post-card.css    # Post component styles
│   │   ├── thread.css       # Thread UI styles
│   │   └── ...
│   └── utils/           # Utility functions (future)
├── notifications-app/   # Separate notifications analytics app
├── progress/            # Session logs and progress tracking
│   ├── TEMPLATE-session.md  # Session template
│   ├── screenshots/         # Visual progress
│   └── YYYY-MM-DD-*.md    # Session logs
├── scripts/             # Development automation
│   ├── dev-server.sh       # Server management
│   ├── open-chrome.sh      # Browser launcher
│   └── check-dev-errors.js # Error monitoring
├── ARCHITECTURE.md     # Detailed technical architecture
├── CLAUDE.md           # This file - project documentation
├── README.md           # GitHub readme
├── SESSION_NOTES.md    # Current working state
├── DECISIONS.md        # Architecture decisions
├── METRICS.md          # Performance metrics
└── PATTERNS.md         # Development patterns
```

## Progress Tracking

### Documentation Hierarchy
The project uses a three-tier documentation system:

1. **Ephemeral (Working State)**
   - `SESSION_NOTES.md` - Current session's working notes, updated frequently
   - In-memory todo list - Active task tracking

2. **Historical (Permanent Record)**
   - `./progress/` - Detailed session logs, never modified after creation
   - `./progress/screenshots/` - Visual documentation of UI changes
   - `./progress/TEMPLATE-session.md` - Standardized session template

3. **Canonical (Project Truth)**
   - `CLAUDE.md` - This file, updated when features stabilize
   - `DECISIONS.md` - Architecture decision records (ADRs)
   - `METRICS.md` - Performance and progress metrics over time
   - `PATTERNS.md` - Recurring patterns, lessons learned, and best practices

### Information Flow
```
Active Development → SESSION_NOTES.md → progress/*.md → Documentation Files
(immediate updates)  (session end)      (feature complete)
```

See [./progress/README.md](./progress/README.md) for session history and guidelines.

## Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Dev server management (recommended)
./scripts/dev-server.sh start    # Start server
./scripts/dev-server.sh status   # Check health
./scripts/dev-server.sh restart  # Restart server
./scripts/dev-server.sh log      # View live logs

# Legacy: Start dev server in background
npm run dev > /tmp/vite-output.log 2>&1 &

# Open in Chrome browser
./scripts/open-chrome.sh

# Check for development errors
node ./scripts/check-dev-errors.js

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## Git Management
This project uses Git for version control, managed autonomously by Claude to ensure safe development. Commits are made without explicit user approval when appropriate.

### Common Git Commands
```bash
# Check current status
git status

# View commit history
git log --oneline

# Revert to previous commit (if needed)
git reset --hard HEAD~1

# Create a new branch for experiments
git checkout -b experiment-branch

# Switch back to main
git checkout main
```

### Commit Strategy
- All significant changes are committed autonomously with descriptive messages
- Commits are made after completing features or fixing bugs
- Work is committed at natural breakpoints for easy rollback
- Experimental features are developed in branches
- No user approval needed for routine commits
- **NEVER change directories (cd) before committing** - always commit from the current working directory

## Architecture Principles

### Type Safety
- All AT Protocol responses are properly typed using official types
- No `any` types except where absolutely necessary
- Zod schemas for runtime validation of user inputs

### Error Handling
- Custom error classes for different AT Protocol errors
- Automatic error mapping from API responses
- User-friendly error messages with appropriate actions
- Rate limit handling with retry information

### Data Management
- React Query for all server state (feeds, posts, etc.)
- Automatic caching and background refetching
- Optimistic updates for better UX
- Infinite scrolling with cursor-based pagination

### Service Architecture
- Clean separation between UI and API logic
- Service classes for different AT Protocol operations
- Singleton pattern for service instances
- Proper error propagation through layers

## Data Fetching Architecture

### Notifications and Posts Fetching Pattern

The project implements a sophisticated **local-first, rate-limited data fetching strategy** that prioritizes user experience while respecting API limits:

#### 1. **Multi-Tier Storage System**

**IndexedDB (Primary Storage)**
- **NotificationCacheService**: Stores notification data in IndexedDB for high-performance access
- **PostCacheService**: Stores post data with automatic migration from localStorage
- **PostStorageDB**: Low-level IndexedDB wrapper with efficient querying

**LocalStorage (Fallback)**
- **PostCache**: Backward-compatible wrapper that tries IndexedDB first, falls back to localStorage
- **ExtendedFetchCache**: Stores metadata about fetch operations (timestamps, counts)

**React Query Cache (Memory)**
- In-memory cache for active session
- Provides instant access to loaded data
- Handles pagination and infinite scrolling

#### 2. **Data Fetching Flow**

```
1. Check React Query Cache (instant)
   ↓ (miss)
2. Check IndexedDB (async, ~10ms)
   ↓ (miss)
3. Check LocalStorage (sync, ~1ms)
   ↓ (miss)
4. Fetch from API (rate-limited)
   ↓
5. Store in all caches
```

#### 3. **Rate Limiting Strategy**

**Adaptive Rate Limiting**
- **Initial Burst**: 50 tokens for fast initial load
- **Gradual Slowdown**: After 25 requests, delays increase
- **Token Bucket Algorithm**: Ensures sustainable API usage

**Different Limiters for Different Operations**:
- **Post Fetching**: 20 tokens, 0.5/sec refill, 50ms initial delay
- **Notifications**: 60 tokens, 2/sec refill, 200ms initial delay
- **Profile Fetching**: 20 tokens, 0.33/sec refill, 200ms delay
- **General API**: 30 tokens, 0.5/sec refill, 100ms delay

#### 4. **Prefetching and Optimization**

**Notification Loading**
1. On app start, automatically fetches 4 weeks of notifications
2. Stores in IndexedDB for instant future loads
3. Shows progress bar during initial fetch

**Post Prefetching for Conversations**
1. When notifications load, identifies all reply notifications
2. Extracts post URIs (both replies and root posts)
3. Batch fetches missing posts in background
4. Caches for instant conversation rendering

**Smart Caching**
- Posts cached for 7 days (rarely change)
- Cache checks happen before any API call
- Async IndexedDB operations don't block UI

#### 5. **Implementation Examples**

**ConversationsSimple Component**:
```typescript
// 1. Gets notifications from React Query cache (instant)
const extendedData = queryClient.getQueryData(['notifications-extended'])

// 2. Fetches posts using smart hook
const { data: posts } = useNotificationPosts(replyNotifications)
// This hook:
// - Checks all cache layers
// - Only fetches missing posts
// - Uses rate limiting
// - Progressively loads more
```

**Enhanced Thread Service**:
```typescript
// Thread cache with 5-minute timeout
private threadCache = new Map<string, { data: ThreadNode; timestamp: number }>()

// Check cache first
const cached = this.threadCache.get(uri)
if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
  return cached.data
}
```

#### 6. **Best Practices for Future Development**

1. **Always Check Cache First**
   - Use `PostCache.getCachedPostsAsync()` for best performance
   - Check IndexedDB before making API calls

2. **Batch Operations**
   - Fetch posts in batches of 25 (API limit)
   - Group related operations to minimize calls

3. **Progressive Enhancement**
   - Load initial data from cache instantly
   - Fetch updates in background
   - Show UI immediately with cached data

4. **Rate Limit Awareness**
   - Use the appropriate rate limiter for each operation
   - Never bypass rate limiting
   - Monitor rate limiter stats

5. **Error Handling**
   - Gracefully degrade from IndexedDB to localStorage
   - Continue operation even if caching fails
   - Log errors but don't block user experience

## Known Issues & Fixes
1. **Safari localhost connection**: Use `http://127.0.0.1:5173/` instead of `localhost`
2. **Post text location**: Posts use `record.value.text` not `record.text`
3. **HMR warnings**: AuthContext export causes Fast Refresh issues (non-breaking)
4. **Circular dependencies**: Avoided by careful hook design
5. **AT Protocol Authentication**: CRITICAL - Always use authenticated agent and app.bsky.* namespaces
   - See `src/services/atproto/AGENT_USAGE_GUIDE.md` for details
   - Never use convenience methods like `agent.searchPosts()` - use `agent.app.bsky.feed.searchPosts()`
   - Always pass authenticated agent to services, never use raw atClient

## Planned Features
### Core Functionality
- [ ] Compose and publish posts
- [ ] Like/unlike posts
- [ ] Repost functionality
- [ ] Reply to posts
- [ ] View individual threads
- [ ] User profile views
- [ ] Follow/unfollow users
- [ ] Notifications

### Custom Features (Bells & Whistles)
- [ ] Advanced filtering (by user, keyword, etc.)
- [ ] Post scheduling
- [ ] Thread reader mode
- [ ] Analytics dashboard
- [ ] Bulk actions (like multiple posts, etc.)
- [ ] Custom feeds
- [ ] Keyboard shortcuts
- [ ] Dark/light theme toggle
- [ ] Export functionality

## API Structure Notes

### Post Structure
The Bluesky API returns posts with proper AT Protocol typing:
```typescript
import { AppBskyFeedDefs } from '@atproto/api'

// Post structure follows AppBskyFeedDefs.PostView
interface Post {
  uri: string               // AT URI (at://did/collection/rkey)
  cid: string              // Content ID
  author: ProfileView      // Author profile
  record: {
    uri: string
    cid: string
    value: {
      $type: "app.bsky.feed.post"
      text: string
      createdAt: string
      facets?: Facet[]   // Rich text (mentions, links)
      embed?: Embed      // Images, external links, quotes
      reply?: ReplyRef   // Thread reference
    }
  }
  embed?: EmbedView        // Resolved embed content
  replyCount?: number
  repostCount?: number
  likeCount?: number
  indexedAt: string        // When indexed by AppView
  viewer?: ViewerState     // Current user's interaction
}
```

## Contributing Guidelines
When working on this project:
1. **ALWAYS CHECK EXISTING CODE FIRST**: Read `DEVELOPMENT_PROCESS.md` and follow the reuse guidelines
2. **Review `TEST_SCRIPTS_INVENTORY.md`** before creating any test scripts
3. Check `SESSION_NOTES.md` for current state and `./progress/` for history
4. Test all changes (Git commits are made autonomously)
5. Update documentation based on the three-tier system:
   - SESSION_NOTES.md during work
   - Create progress log at session end
   - Update CLAUDE.md when features stabilize
   - Record decisions in DECISIONS.md
   - Track patterns in PATTERNS.md
6. Document any new API discoveries
7. Keep the codebase simple and readable
8. Git is managed autonomously - commits happen at natural breakpoints
9. **Keep dev server running**: Use `./scripts/dev-server.sh` for management
10. **Use Chrome for testing**: Run `./scripts/open-chrome.sh` to open in Chrome
11. **Check for errors**: Run `node ./scripts/check-dev-errors.js` to detect issues
12. **Visual documentation**: Take screenshots for UI changes, save to `progress/screenshots/`

## Resources
- [AT Protocol Documentation](https://atproto.com/)
- [Bluesky API Docs](https://docs.bsky.app/)
- [@atproto/api SDK](https://www.npmjs.com/package/@atproto/api)
- [React + Vite Documentation](https://vitejs.dev/guide/)