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
- **AT Protocol SDK**: @atproto/api (official TypeScript SDK)
- **Styling**: Inline styles (for now, easy to migrate to CSS-in-JS later)
- **State Management**: React Context (simple, built-in solution)
- **Version Control**: Git (managed by Claude for easy rollback)

## Current Features
- ✅ Authentication with Bluesky credentials
- ✅ Session persistence (localStorage)
- ✅ Timeline feed viewing
- ✅ Post display with:
  - Text content
  - Author information and avatars
  - Timestamps (relative time)
  - Engagement metrics (replies, reposts, likes)
  - Support for embeds (images, links, quotes)

## Project Structure
```
BSKY/
├── src/
│   ├── components/       # React components
│   │   ├── Feed.tsx     # Timeline feed display
│   │   └── Login.tsx    # Authentication form
│   ├── contexts/        # React contexts
│   │   └── AuthContext.tsx  # Authentication state
│   ├── services/        # API services
│   │   └── atproto.ts   # AT Protocol wrapper
│   ├── hooks/          # Custom React hooks (future)
│   ├── types/          # TypeScript types (future)
│   └── utils/          # Utility functions (future)
├── progress/           # Session logs and progress tracking
└── CLAUDE.md          # This file
```

## Progress Tracking
All development progress is tracked in the `./progress/` directory. Each session creates a new log file with:
- Date and summary of work completed
- Problems encountered and solutions
- Next steps and TODOs
- Code snippets for reference

See [./progress/README.md](./progress/README.md) for session history.

## Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## Git Management
This project uses Git for version control, managed by Claude to ensure safe development:

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
- All significant changes are committed with descriptive messages
- Commits are made after completing features or fixing bugs
- Each session's work is committed for easy rollback
- Experimental features are developed in branches

## Known Issues & Fixes
1. **Safari localhost connection**: Use `http://127.0.0.1:5173/` instead of `localhost`
2. **Post text not showing**: Posts use `record.value.text` not `record.text`
3. **HMR warnings**: AuthContext export causes Fast Refresh issues (non-breaking)

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
Based on our debugging, the Bluesky API returns posts with this structure:
```typescript
{
  uri: string,
  cid: string,
  author: {
    did: string,
    handle: string,
    displayName?: string,
    avatar?: string
  },
  record: {
    uri: string,
    cid: string,
    value: {
      $type: "app.bsky.feed.post",
      text: string,
      createdAt: string,
      // ... other fields
    }
  },
  indexedAt: string,
  replyCount?: number,
  repostCount?: number,
  likeCount?: number,
  // ... other fields
}
```

## Contributing Guidelines
When working on this project:
1. Check `./progress/` for recent work and context
2. Test all changes before committing
3. Update this file when adding major features
4. Document any new API discoveries
5. Keep the codebase simple and readable

## Resources
- [AT Protocol Documentation](https://atproto.com/)
- [Bluesky API Docs](https://docs.bsky.app/)
- [@atproto/api SDK](https://www.npmjs.com/package/@atproto/api)
- [React + Vite Documentation](https://vitejs.dev/guide/)