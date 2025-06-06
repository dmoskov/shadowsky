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