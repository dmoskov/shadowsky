# Bluesky Client Architecture Documentation

## Overview

This document describes the architecture of the Bluesky client - a custom AT Protocol client built with React, TypeScript, and Vite. This document is maintained to provide situational awareness for all developers (human and AI) working on the project.

**Last Updated**: 2025-01-11
**Current Branch**: refactor/split-components
**Project Status**: Active Development (11/25 features complete)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
├─────────────────────────────────────────────────────────────┤
│  Components  │  Hooks  │  Contexts  │  Services  │  Utils   │
├─────────────────────────────────────────────────────────────┤
│                    State Management                          │
│  React Query (Server State) │ React Context (Auth State)    │
├─────────────────────────────────────────────────────────────┤
│                    AT Protocol Layer                         │
│              @atproto/api SDK Integration                    │
├─────────────────────────────────────────────────────────────┤
│                    External Services                         │
│                 Bluesky AT Protocol API                      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite (for fast HMR and optimized builds)
- **State Management**: 
  - React Query (TanStack Query) for server state
  - React Context for authentication state
  - Local component state for UI
- **Styling**: CSS modules with PostCSS
- **AT Protocol SDK**: @atproto/api for Bluesky integration
- **Data Storage**: 
  - localStorage for session persistence
  - IndexedDB for analytics data
- **Development Tools**:
  - ESLint for code quality
  - TypeScript for type safety
  - Custom dev scripts for automation

## Project Structure

### Main Application (`/BSKY`)

```
BSKY/
├── src/
│   ├── components/         # UI Components
│   │   ├── core/          # Essential app components
│   │   │   ├── App.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Header.tsx
│   │   ├── feed/          # Feed-related components
│   │   │   ├── Feed.tsx
│   │   │   ├── PostCard.tsx
│   │   │   └── ParentPost.tsx
│   │   ├── thread/        # Thread visualization
│   │   │   ├── ThreadView.tsx
│   │   │   └── ThreadPost.tsx
│   │   ├── analytics/     # Analytics dashboard
│   │   │   ├── Analytics.tsx
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   └── NetworkHealthActionable.tsx
│   │   └── ui/           # Reusable UI elements
│   │       └── PerformanceWidget.tsx
│   │
│   ├── services/         # Business Logic & API
│   │   └── atproto/     # AT Protocol services
│   │       ├── client.ts      # Main client setup
│   │       ├── feed.ts        # Feed operations
│   │       ├── interactions.ts # Like/repost/reply
│   │       ├── thread.ts      # Thread fetching
│   │       ├── analytics.ts   # Analytics data
│   │       └── index.ts       # Service exports
│   │
│   ├── hooks/           # Custom React Hooks
│   │   ├── useTimeline.ts     # Timeline data fetching
│   │   ├── useErrorHandler.ts # Error handling
│   │   ├── useThread.ts       # Thread data
│   │   └── useRenderTracking.ts # Performance monitoring
│   │
│   ├── contexts/        # React Contexts
│   │   └── AuthContext.tsx    # Authentication state
│   │
│   ├── lib/            # Utilities & Libraries
│   │   ├── errors.ts         # Error classes
│   │   ├── query-client.ts   # React Query setup
│   │   ├── performance-tracking.ts
│   │   ├── error-tracking.ts
│   │   ├── rate-limiter.ts
│   │   └── request-deduplication.ts
│   │
│   ├── types/          # TypeScript Definitions
│   │   ├── atproto.ts       # AT Protocol types
│   │   └── app.ts          # Application types
│   │
│   └── styles/         # CSS Modules
│       ├── design-system.css # Design tokens
│       ├── post-card.css
│       ├── thread.css
│       └── analytics.css
│
├── scripts/            # Development Scripts
│   ├── dev-server.sh       # Server management
│   ├── open-chrome.sh      # Browser launcher
│   └── check-dev-errors.js # Error monitoring
│
├── progress/           # Session Documentation
│   ├── TEMPLATE-session.md
│   ├── screenshots/
│   └── YYYY-MM-DD-*.md
│
└── docs/              # Project Documentation
    ├── architecture/
    └── handoff/
```

### Notifications App (`/notifications-app`)

A separate React app focused on notifications analytics and management:

```
notifications-app/
├── src/
│   ├── components/
│   │   ├── NotificationsDashboard.tsx
│   │   ├── NotificationsFeed.tsx
│   │   └── NotificationsAnalytics.tsx
│   ├── services/
│   │   └── atproto/     # Shared AT Protocol services
│   ├── hooks/
│   │   └── useNotifications.ts
│   └── contexts/
│       └── AuthContext.tsx
```

## Core Components

### 1. Authentication System

**Location**: `src/contexts/AuthContext.tsx`

The authentication system manages:
- User login/logout with AT Protocol
- Session persistence in localStorage
- Automatic session refresh
- Provides authenticated `agent` to all components

**Key Pattern**: Context + Provider pattern for global auth state

```typescript
interface AuthContextType {
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  resumeSession: () => Promise<void>
  agent: BskyAgent | null
  client: AtpServiceClient | null
  session: Session | null
}
```

### 2. Feed System

**Location**: `src/components/feed/`, `src/services/atproto/feed.ts`

The feed system handles:
- Timeline display with infinite scrolling
- Post rendering with embeds (images, links, quotes)
- Thread context display
- Engagement metrics

**Key Features**:
- Cursor-based pagination
- React Query for caching
- Optimistic UI updates ready
- Filtered to show only top-level posts

### 3. Analytics System

**Location**: `src/components/analytics/`, `src/services/atproto/analytics.ts`

Advanced analytics with:
- IndexedDB storage for historical data
- Multi-user analytics tracking
- Engagement Quality Score (EQS)
- Network health monitoring
- Background sync every 30 minutes

**Architecture**:
```
User Actions → Analytics Service → IndexedDB
                    ↓
              React Query → UI Components
```

### 4. Error Handling

**Location**: `src/lib/errors.ts`, `src/hooks/useErrorHandler.ts`

Comprehensive error handling:
- Custom error classes for AT Protocol errors
- Automatic error mapping from API responses
- User-friendly error messages
- Rate limit detection and retry logic

**Error Types**:
- `RateLimitError` - With retry timing
- `AuthRequiredError` - Redirect to login
- `NetworkError` - Connection issues
- `InvalidRequestError` - Validation failures

### 5. Performance Optimization

**Location**: `src/lib/performance-tracking.ts`, `src/lib/rate-limiter.ts`

Performance features:
- Web Vitals tracking (LCP, FID, CLS, etc.)
- Request deduplication
- Rate limiting (prevents API abuse)
- Component render tracking
- Performance marks for navigation

## Data Flow

### 1. Authentication Flow
```
Login Form → AuthContext → AT Protocol API → Session Storage
                ↓
         All Components (via Context)
```

### 2. Feed Data Flow
```
Feed Component → useTimeline Hook → Feed Service → AT Protocol API
        ↓              ↓                               ↓
   PostCard ← React Query Cache ← ← ← ← ← ← Response Data
```

### 3. Interaction Flow (Likes, Reposts)
```
User Action → Interaction Service → Optimistic Update → UI Update
                     ↓                                      ↓
              AT Protocol API → → → → → → → → → → Confirmed Update
```

## Security Considerations

### Current Security Measures
1. **Session Management**: Tokens stored in localStorage
2. **API Authentication**: All requests use authenticated agent
3. **Input Sanitization**: Basic XSS prevention
4. **Error Handling**: No sensitive data in error messages

### Recent Security Updates (2025-01-11)
- Removed all hardcoded credentials from test files
- Created `getTestCredentials()` helper for secure access
- Added pre-commit hook to prevent credential leaks
- All test credentials now use environment variables

### Security Vulnerabilities (Addressed)
1. ~~Hardcoded test credentials~~ ✅ Fixed
2. XSS protection needs enhancement
3. Consider httpOnly cookies for sessions
4. Add Content Security Policy headers

## Performance Architecture

### Optimization Strategies
1. **React Query Caching**: Aggressive caching with stale-while-revalidate
2. **Infinite Scrolling**: Load posts incrementally
3. **Request Deduplication**: Prevent duplicate API calls
4. **Rate Limiting**: Client-side throttling
5. **Component Memoization**: React.memo for expensive renders

### Current Metrics
- Initial Load: ~132ms (local dev)
- Bundle Size: ~450KB
- Memory Usage: 18-19MB
- DOM Processing: ~126ms

## Development Patterns

### 1. Service Pattern
All AT Protocol interactions go through service classes:
```typescript
class FeedService {
  constructor(private agent: BskyAgent) {}
  
  async getTimeline(params) {
    return this.agent.app.bsky.feed.getTimeline(params)
  }
}
```

### 2. Hook Pattern
Custom hooks encapsulate business logic:
```typescript
export function useTimeline() {
  const { agent } = useAuth()
  const feedService = new FeedService(agent)
  
  return useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({ pageParam }) => feedService.getTimeline({ cursor: pageParam })
  })
}
```

### 3. Error Boundary Pattern
Graceful error handling at component boundaries:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <Feed />
</ErrorBoundary>
```

## Critical Implementation Notes

### 1. AT Protocol Agent Usage
**CRITICAL**: Always use the full namespace path:
```typescript
// ❌ WRONG - Don't use convenience methods
agent.getTimeline()

// ✅ CORRECT - Use full namespace
agent.app.bsky.feed.getTimeline()
```

### 2. Post Data Structure
Post text can be in multiple locations:
```typescript
// Check in order:
1. post.record.text
2. post.record.value.text
3. post.value.text
4. post.text
```

### 3. Thread Display
- Parent posts use 48px avatars
- Thread lines connect at `left: calc(var(--spacing-lg) + 24px)`
- Replies filtered from main timeline

## Known Issues

### Active Issues
1. **PostCSS Warnings**: @import statements (non-breaking)
2. **ESLint Errors**: 175 errors from refactoring (mostly unused vars)
3. **Safari Compatibility**: Must use 127.0.0.1 instead of localhost

### Resolved Issues
- ✅ Parent post text extraction
- ✅ Thread line alignment
- ✅ Multi-image display
- ✅ Security: Hardcoded credentials removed

## Future Architecture Considerations

### Planned Enhancements
1. **Plugin System**: For custom feeds and features
2. **Offline Support**: Service worker implementation
3. **Code Splitting**: Route-based lazy loading
4. **Virtual Scrolling**: For better performance
5. **Theme System**: CSS variables for customization

### Scalability Planning
1. **Microservices Ready**: Service layer can be extracted
2. **State Management**: Can migrate to Redux if needed
3. **API Abstraction**: Easy to swap AT Protocol implementations
4. **Component Library**: Moving towards reusable components

## Development Guidelines

### Code Standards
1. **TypeScript**: Strict mode, minimal `any` usage
2. **Components**: Max 200 lines, single responsibility
3. **Hooks**: Prefix with `use`, return consistent shape
4. **Services**: Singleton pattern, dependency injection
5. **Error Handling**: Always catch and map errors

### Git Workflow
- Branch: `refactor/split-components` (current)
- Main branch for PRs
- Autonomous commits at natural breakpoints
- Pre-commit hooks for security

### Testing Strategy (Future)
```
├── unit/        # Services, hooks, utilities
├── integration/ # API interactions
├── e2e/        # User flows
└── visual/     # UI regression
```

## Monitoring and Observability

### Development Monitoring
- Console-based performance tracking
- Error detection script
- Chrome DevTools integration
- Development server health checks

### Production Monitoring (Planned)
- Error tracking (Sentry)
- Performance monitoring (Web Vitals)
- User analytics (privacy-respecting)
- API health checks

## Contact and Resources

### Documentation
- `CLAUDE.md` - Project overview and instructions
- `SESSION_NOTES.md` - Current working state
- `progress/` - Historical session logs
- `docs/` - Additional documentation

### Key Resources
- [AT Protocol Docs](https://atproto.com/)
- [Bluesky API Docs](https://docs.bsky.app/)
- [@atproto/api SDK](https://www.npmjs.com/package/@atproto/api)

### For AI Assistants
When working on this project:
1. Check this document first for architecture understanding
2. Review `SESSION_NOTES.md` for current state
3. Follow patterns established in existing code
4. Update this document when architecture changes
5. Maintain backward compatibility

---

**Note**: This document should be updated whenever significant architectural changes are made. It serves as the source of truth for the project's technical architecture.