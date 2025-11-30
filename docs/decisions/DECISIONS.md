# Architecture Decision Records

This document tracks key technical decisions made during the development of the Bluesky client.

## Decision Log Format

```
# Decision: [Title]
Date: YYYY-MM-DD
Status: [Proposed|Accepted|Deprecated|Superseded]
Context: Why this decision was needed
Decision: What we decided to do
Consequences: What happens as a result
```

---

## Decision: Use React Query for State Management

Date: 2025-01-06
Status: Accepted
Context: Need efficient caching and synchronization for AT Protocol data
Decision: React Query (TanStack Query) over Redux/Zustand
Consequences:

- Simpler code with automatic cache management
- Built-in background refetching
- Optimistic updates are easier
- Less boilerplate than Redux

## Decision: CSS Modules Over CSS-in-JS

Date: 2025-01-06
Status: Accepted
Context: Need styling solution that's simple and performant
Decision: Use CSS files with design system variables
Consequences:

- Better performance (no runtime overhead)
- Easier to debug in DevTools
- Can migrate to CSS-in-JS later if needed
- PostCSS warnings about @import (minor issue)

## Decision: Singleton Pattern for AT Protocol Client

Date: 2025-01-06
Status: Accepted
Context: Need consistent API client instance across the app
Decision: Export singleton instance from services/atproto/client.ts
Consequences:

- Shared session state
- Consistent rate limiting
- Simpler dependency injection
- Potential testing challenges (need mocks)

## Decision: Dark Theme First

Date: 2025-01-06
Status: Accepted
Context: Building a modern client with good DX
Decision: Start with dark theme, add light theme later
Consequences:

- Better for long coding sessions
- Modern aesthetic
- Need to ensure sufficient contrast
- Light theme becomes additional work

## Decision: Git Hooks for Dev Server Management

Date: 2025-01-06
Status: Accepted
Context: Dev server needs to stay running during development
Decision: Use git hooks to restart server after commits
Consequences:

- More stable development experience
- Automatic recovery from crashes
- Additional setup complexity
- Platform-specific scripts needed

## Decision: Ephemeral + Persistent Documentation

Date: 2025-01-06
Status: Accepted
Context: Need both working notes and historical record
Decision: Three-tier system: SESSION_NOTES (working) → progress/ (history) → CLAUDE.md (truth)
Consequences:

- Clear separation of concerns
- Information flows from rough to refined
- Some duplication across tiers
- Better knowledge preservation

## Decision: Use Bluesky's Official Trending API for Trending Topics

Date: 2025-11-29
Status: Accepted
Context: The trending topics feature required a decision on data source. Options were:

1. Global ATProto firehose processing (build our own trending aggregation)
2. User's network only (trends from followed accounts)
3. Hybrid approach with both
4. Use existing Bluesky API endpoints

The firehose approach would require significant bandwidth, processing resources, and infrastructure to aggregate trending data across all of Bluesky.

Decision: Use Bluesky's existing public trending API endpoints instead of building custom firehose processing.

Available endpoints:

- `app.bsky.unspecced.getTrendingTopics` - Returns trending topics and suggested feeds
  - Public endpoint: `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics`
  - Parameters: `limit` (1-25, default 10), `viewer` (DID for personalized ranking)
  - Returns: `topics` array and `suggested` array of trending topics

- `app.bsky.unspecced.getTrends` - Returns trending topics with post counts and key actors
  - Public endpoint: `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends`
  - Includes: Post count, "hot" status, representative accounts for each trend

- `app.bsky.feed.searchPosts` - Search posts with various filters
  - Can be used to fetch posts for specific trending topics/hashtags

Note: These endpoints are in the `unspecced` namespace, indicating they may change without formal API stability guarantees. However, they are actively used by the official Bluesky client.

Consequences:

- Significantly reduced implementation complexity (no firehose processing needed)
- No additional infrastructure or storage requirements
- Real-time trending data maintained by Bluesky
- Consistent with official Bluesky client experience
- Dependent on Bluesky's API availability and rate limits
- May be subject to API changes (unspecced namespace)
- Can still add personalized trending from user's network as enhancement later

References:

- User decision: "Try to find an available api resource for this rather than creating our own source"
- GitHub Discussion: https://github.com/bluesky-social/atproto/discussions/3822
- Lexicon: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/unspecced/getTrendingTopics.json
