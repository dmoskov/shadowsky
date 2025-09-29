# AI Agent Context Guide for ShadowSky

## Quick Start for AI Agents

**You are working on ShadowSky**: An advanced Bluesky client with TweetDeck-style multi-column interface. Think of it as "TweetDeck for Bluesky" with enhanced analytics, dual storage options, and privacy-focused features.

**Your primary directive**: Follow the patterns already established in the codebase. This is a production application with real users - maintain stability and consistency.

## Critical Context

### What This Project Is

- **Production Bluesky Client**: Live application used by real users daily
- **Privacy-Focused**: Users control where data is stored (local or AT Protocol)
- **Multi-Column Dashboard**: SkyDeck feature provides TweetDeck-like experience
- **Progressive Web App**: Works offline with cached data, enhances with network

### What This Project Is NOT

- Not a prototype or experiment
- Not a Bluesky/AT Protocol implementation (it's a client)
- Not a general social media aggregator (Bluesky-specific)

## Business Domain Knowledge

### Core Concepts

**AT Protocol**: The decentralized protocol Bluesky runs on

- Records: Data stored in user repositories
- DIDs: Decentralized identifiers for users
- PDS: Personal Data Server where user data lives
- Collections: Named groups of records (e.g., `com.shadowsky.bookmarks`)

**Bluesky Specifics**:

- Posts: Called "skeets" colloquially but "posts" in code
- Reposts: Equivalent to retweets
- Feeds: Custom algorithmic or chronological timelines
- App Passwords: Scoped authentication tokens

**ShadowSky Features**:

- SkyDeck: Multi-column dashboard (main differentiator)
- Dual Storage: Local (device) or AT Protocol (synced)
- Analytics: Engagement tracking and insights
- Enhanced Notifications: Real-time with Jetstream WebSocket

## Common Tasks and Workflows

### 1. Adding a New Feature

```
1. Check existing patterns in similar features
2. Create service wrapper if needed (handles initialization)
3. Create core service (business logic)
4. Add storage backend if data persistence needed
5. Create React component with proper hooks
6. Add to router if new page
7. Update types and run type checking
8. Test with both storage types
9. Clear debug logging before completing
```

### 2. Modifying Storage Behavior

```
CRITICAL: Always test with BOTH storage types (local and AT Protocol)
1. Check preference loading in PreferencesContext
2. Update service wrapper to handle storage switch
3. Implement migration logic if needed
4. Test migration in both directions
5. Handle 400 errors gracefully (record might not exist)
```

### 3. Working with AT Protocol

```
1. Use singleton records with "self" as rkey for user data
2. Follow `com.shadowsky.*` naming convention
3. Always handle missing records (400 errors are normal)
4. Update lexicons if changing record structure
5. Test with custom PDS if possible
```

### 4. UI/Component Changes

```
1. Follow existing Tailwind patterns
2. NO headers in feed views (user preference)
3. Keep mobile-first responsive design
4. Use lucide-react for icons
5. Test swipe gestures on mobile views
```

### 5. Performance Optimization

```
1. Use React Query for data fetching
2. Implement proper caching strategies
3. Use IndexedDB for large datasets
4. Lazy load components and routes
5. Profile with React DevTools
```

## Gotchas and Non-Obvious Behaviors

### Storage Gotchas

1. **"custom" vs "atproto"**: Both mean AT Protocol storage (backward compatibility)
2. **400 errors are normal**: When fetching AT Protocol records for new users
3. **Preference loading loops**: Be careful with useEffect dependencies
4. **Migration timing**: Must complete before UI updates

### Authentication Gotchas

1. **Session refresh**: Happens automatically on 401 errors
2. **Cross-subdomain auth**: Session shared via localStorage
3. **App passwords**: Required for DM access, different scopes
4. **PDS discovery**: Handle custom PDS URLs during login

### UI/UX Gotchas

1. **No headers in feeds**: Intentional design choice, don't add
2. **Column overflow**: Mobile shows single column, desktop shows multiple
3. **Keyboard navigation**: Arrow keys and vim bindings in SkyDeck
4. **Swipe gestures**: Enabled on mobile for column switching

### Performance Gotchas

1. **IndexedDB quotas**: Can fill up with notifications
2. **React Query stale time**: 5 minutes by default
3. **WebSocket reconnection**: Jetstream connection drops need handling
4. **Image loading**: Use proxy server for CORS issues

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80% coverage for utilities and services
- **Integration Tests**: Critical user flows
- **E2E Tests**: Login, posting, core features
- **Visual Regression**: Screenshot testing for UI changes

### Test Commands

```bash
npm run test:unit        # Run unit tests
npm run test:unit:watch  # Watch mode for development
npm run test             # Run all tests and checks
npm run test:format      # Check formatting
npm run test:lint        # Check linting
npm run test:types       # TypeScript checking
```

### Testing Checklist

- [ ] Works with local storage
- [ ] Works with AT Protocol storage
- [ ] Handles network failures gracefully
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] No console errors or warnings
- [ ] Performance acceptable (no janky scrolling)

## Deployment Process

### Development → Production Flow

```
1. Feature branch development
2. Format and lint checks (automatic via scripts/push.sh)
3. Build verification (`npm run build`)
4. PR to main branch
5. Automated deployment to staging
6. Manual promotion to production
```

### Pre-deployment Checklist

- [ ] Remove debug console.log statements
- [ ] Run `npm run fix:format`
- [ ] Run `npm run build` successfully
- [ ] Test auth flow
- [ ] Test both storage types
- [ ] Verify no API key leaks

### Deployment Environments

- **Local**: http://localhost:5174
- **Staging**: https://staging.shadowsky.app
- **Production**: https://shadowsky.app

## Recent Changes and Ongoing Work

### Recently Completed

- Dual storage system implementation
- SkyDeck multi-column interface
- Real-time notifications via Jetstream
- Analytics dashboard
- Enhanced composer with threading

### In Progress

- Performance optimizations for large datasets
- Enhanced mobile experience
- Plugin system architecture
- Federation support planning

### Known Issues and Technical Debt

1. **IndexedDB Growth**: Notifications can consume significant space
   - Workaround: 4-week retention policy
   - TODO: Implement better cleanup strategy

2. **WebSocket Stability**: Jetstream connections drop occasionally
   - Workaround: Automatic reconnection with backoff
   - TODO: Implement more robust reconnection

3. **Memory Leaks**: Some event listeners not cleaned up properly
   - Workaround: Page refresh clears memory
   - TODO: Audit and fix event listener cleanup

4. **Type Safety**: Some `any` types in older code
   - TODO: Progressive type improvement

5. **Bundle Size**: Growing with new features
   - TODO: Implement code splitting for routes

## Decision Log

### Why Dual Storage?

**Date**: 2024-08
**Decision**: Implement both local and AT Protocol storage
**Rationale**: Users want privacy (local) AND sync (AT Protocol)
**Result**: More complex but highly appreciated feature

### Why React Query over Redux?

**Date**: 2024-07
**Decision**: Use React Query for server state
**Rationale**: Better caching, less boilerplate, built-in optimistic updates
**Result**: Simpler code, better performance

### Why Tailwind CSS?

**Date**: 2024-07
**Decision**: Migrate from CSS modules to Tailwind
**Rationale**: Faster development, consistent styling, smaller bundle
**Result**: Some migration debt but overall improvement

### Why Vite over Webpack?

**Date**: 2024-06
**Decision**: Use Vite for building
**Rationale**: Faster builds, better DX, native ESM
**Result**: 10x faster dev server startup

## Code Patterns to Follow

### Service Pattern

```typescript
// Always wrapper → service → backend
export class BookmarkServiceWrapper {
  private service?: BookmarkService;

  async initialize(storageType: StorageType) {
    const backend =
      storageType === "local"
        ? new LocalStorageBackend()
        : new SingletonBackend();
    this.service = new BookmarkService(backend);
  }
}
```

### Hook Pattern

```typescript
// Prefer custom hooks for complex logic
export function useBookmarks() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: fetchBookmarks,
    staleTime: 5 * 60 * 1000,
  });
  return { bookmarks: data, isLoading, error };
}
```

### Error Handling Pattern

```typescript
// Always preserve error context
try {
  await operation();
} catch (error) {
  logger.error("Operation failed", {
    error,
    context: { userId, operation: "bookmark-add" },
  });
  throw new BookmarkError("Failed to add bookmark", { cause: error });
}
```

## Quick Reference

### Key Files and Their Purpose

- `src/App.tsx`: Main app component and routing
- `src/contexts/AuthContext.tsx`: Authentication state management
- `src/services/bookmark-service-wrapper.ts`: Bookmark storage handling
- `src/components/SkyDeck/SkyDeck.tsx`: Multi-column dashboard
- `src/hooks/useNotifications.ts`: Notification fetching and caching

### Environment Variables

```bash
VITE_GA_MEASUREMENT_ID      # Google Analytics
VITE_GIPHY_API_KEY         # GIF search
VITE_ANTHROPIC_API_KEY     # AI alt text
VITE_PROXY_SERVER_URL      # CORS proxy
```

### Debug Commands

```javascript
// In browser console
window.enableDebug(); // Enable verbose logging
localStorage.clear(); // Clear all local data
indexedDB.deleteDatabase("shadowsky"); // Clear IndexedDB
```

### Common npm Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run all tests
npm run fix:format   # Fix formatting issues
npm run fix:lint     # Fix linting issues
./scripts/push.sh    # Safe git push with checks
```

## AI Agent Best Practices

### DO's

- ✅ Read existing code before implementing
- ✅ Follow established patterns
- ✅ Test with both storage types
- ✅ Handle errors gracefully
- ✅ Clean up debug logging
- ✅ Run build before marking complete
- ✅ Consider mobile experience
- ✅ Preserve user preferences

### DON'Ts

- ❌ Create new files when editing existing ones works
- ❌ Add console.log without cleanup
- ❌ Ignore TypeScript errors
- ❌ Skip error handling
- ❌ Add headers to feed views
- ❌ Commit without formatting
- ❌ Assume network is always available
- ❌ Break existing functionality

## Getting Help

### Where to Look

1. **Similar Features**: Find patterns in existing code
2. **Type Definitions**: `src/types/` for interfaces
3. **Service Implementations**: `src/services/` for business logic
4. **Component Examples**: `src/components/` for UI patterns
5. **Test Files**: `*.test.ts` for usage examples

### Understanding the Flow

1. **User Action** → Component → Hook → Service → Backend → API
2. **API Response** → Backend → Service → Cache → Hook → Component → **UI Update**

### Common Debugging Steps

1. Enable debug mode: `window.enableDebug()`
2. Check network tab for API calls
3. Inspect localStorage and IndexedDB
4. Look for React Query cache in DevTools
5. Check browser console for errors

## Summary for New AI Agents

You're working on a production Bluesky client that prioritizes user privacy and control. The codebase follows consistent patterns: wrapper services handle initialization, core services contain business logic, and storage backends abstract persistence. Always test with both storage types, handle errors gracefully, and maintain the existing UI/UX patterns. When in doubt, look for similar existing features and follow their patterns. Remember: this is a real application with real users - stability and consistency are paramount.

---

_This context guide is specifically designed for AI agents. For human developer documentation, see README.md and ARCHITECTURE.md_
