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
├── progress/            # Session logs and progress tracking
│   ├── TEMPLATE-session.md  # Session template
│   ├── screenshots/         # Visual progress
│   └── YYYY-MM-DD-*.md    # Session logs
├── scripts/             # Development automation
│   ├── dev-server.sh       # Server management
│   ├── open-chrome.sh      # Browser launcher
│   └── check-dev-errors.js # Error monitoring
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

## Known Issues & Fixes
1. **Safari localhost connection**: Use `http://127.0.0.1:5173/` instead of `localhost`
2. **Post text location**: Posts use `record.value.text` not `record.text`
3. **HMR warnings**: AuthContext export causes Fast Refresh issues (non-breaking)
4. **Circular dependencies**: Avoided by careful hook design

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
1. Check `SESSION_NOTES.md` for current state and `./progress/` for history
2. Test all changes (Git commits are made autonomously)
3. Update documentation based on the three-tier system:
   - SESSION_NOTES.md during work
   - Create progress log at session end
   - Update CLAUDE.md when features stabilize
   - Record decisions in DECISIONS.md
   - Track patterns in PATTERNS.md
4. Document any new API discoveries
5. Keep the codebase simple and readable
6. Git is managed autonomously - commits happen at natural breakpoints
7. **Keep dev server running**: Use `./scripts/dev-server.sh` for management
8. **Use Chrome for testing**: Run `./scripts/open-chrome.sh` to open in Chrome
9. **Check for errors**: Run `node ./scripts/check-dev-errors.js` to detect issues
10. **Visual documentation**: Take screenshots for UI changes, save to `progress/screenshots/`

## Resources
- [AT Protocol Documentation](https://atproto.com/)
- [Bluesky API Docs](https://docs.bsky.app/)
- [@atproto/api SDK](https://www.npmjs.com/package/@atproto/api)
- [React + Vite Documentation](https://vitejs.dev/guide/)