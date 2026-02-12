# Asphodel Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Core Components](#core-components)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Storage Architecture](#storage-architecture)
6. [Authentication & Security](#authentication--security)
7. [Frontend Architecture](#frontend-architecture)
8. [API Integration Layer](#api-integration-layer)
9. [Performance Optimization](#performance-optimization)
10. [Deployment Architecture](#deployment-architecture)

## System Overview

Asphodel is a progressive web application built as an advanced Bluesky client with TweetDeck-style multi-column interface. It's designed with a focus on performance, privacy, and user control over data storage.

### Core Design Principles

1. **Privacy-First**: Users control where their data is stored (local device or AT Protocol)
2. **Progressive Enhancement**: Works offline with cached data, enhances with network
3. **Performance Optimized**: Smart caching, prefetching, and lazy loading
4. **Responsive Design**: Adapts from mobile single-column to desktop multi-column
5. **Extensible Architecture**: Plugin-ready design for future features

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Interface                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React Components (SkyDeck, Settings, Analytics, etc.)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      State Management Layer                          │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐      │
│  │  React Query   │  │  Context API  │  │  Local State     │      │
│  │  (Caching)     │  │  (Global)     │  │  (Component)     │      │
│  └────────────────┘  └───────────────┘  └──────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                        Service Layer                                 │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐      │
│  │ Service        │  │  Core         │  │  Storage         │      │
│  │ Wrappers       │  │  Services     │  │  Backends        │      │
│  └────────────────┘  └───────────────┘  └──────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                      Data Persistence Layer                          │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐      │
│  │  LocalStorage  │  │  IndexedDB    │  │  AT Protocol     │      │
│  └────────────────┘  └───────────────┘  └──────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                       External Services                              │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐      │
│  │  Bluesky PDS   │  │  Jetstream    │  │  Third-party     │      │
│  │  (AT Protocol) │  │  (WebSocket)  │  │  APIs            │      │
│  └────────────────┘  └───────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer (`/src`)

#### Components (`/src/components`)

- **UI Components**: Reusable UI elements (buttons, modals, cards)
- **Feature Components**: Business logic components (SkyDeck, Analytics)
- **Settings Components**: Configuration and preferences UI
- **Provider Components**: React context providers for global state

#### Pages (`/src/pages`)

- **Route Pages**: Top-level route components
- **Layout Components**: Page structure and navigation
- **Error Boundaries**: Error handling at page level

#### Hooks (`/src/hooks`)

- **Custom React Hooks**: Reusable logic extraction
- **API Hooks**: Data fetching abstractions
- **State Hooks**: Complex state management

### 2. Service Layer (`/src/services`)

#### Core Services

```typescript
// Service hierarchy
ServiceWrapper (handles initialization and storage switching)
    └── CoreService (business logic)
            └── StorageBackend (persistence)
```

**Key Services:**

- `bookmark-service-v2`: Bookmark management with dual storage
- `column-service`: SkyDeck column configuration
- `draft-service`: Post draft management
- `notification-service`: Real-time notifications
- `analytics-service`: Usage metrics and insights

#### Storage Backends (`/src/services/storage`)

- **LocalStorageBackend**: Browser localStorage interface
- **SingletonBackend**: AT Protocol singleton records
- **IndexedDBBackend**: Large data storage (notifications, posts)

#### AT Protocol Integration (`/src/services/atproto`)

- **Agent Management**: Authenticated API client
- **Record Operations**: CRUD for AT Protocol records
- **Feed Fetching**: Timeline and custom feeds
- **WebSocket**: Real-time updates via Jetstream

### 3. Context Layer (`/src/contexts`)

**Global Contexts:**

- `AuthContext`: Authentication state and session management
- `ThemeContext`: Dark/light mode and visual preferences
- `ModerationContext`: Content filtering and moderation
- `PreferencesContext`: User settings and configuration
- `NotificationContext`: Real-time notification state

### 4. Utility Layer (`/src/utils`)

**Core Utilities:**

- `api-client`: HTTP client with retry and error handling
- `storage-utils`: Storage abstraction and migration
- `date-utils`: Date formatting and parsing
- `text-utils`: Text processing and sanitization
- `media-utils`: Image/video processing

## Data Flow Architecture

### Request Flow

```
User Action
    ↓
React Component
    ↓
Custom Hook / Event Handler
    ↓
Service Wrapper (initialization check)
    ↓
Core Service (business logic)
    ↓
Storage Backend (persistence)
    ↓
External API (if needed)
```

### State Update Flow

```
API Response / User Input
    ↓
Service Processing
    ↓
React Query Cache Update
    ↓
Context State Update (if global)
    ↓
Component Re-render
    ↓
UI Update
```

### Real-time Update Flow

```
Jetstream WebSocket
    ↓
Event Parser
    ↓
Notification Service
    ↓
React Query Invalidation
    ↓
UI Update
```

## Storage Architecture

### Dual Storage System

The application implements a sophisticated dual storage system allowing users to choose between local and AT Protocol storage for different data types.

```
┌─────────────────────────────────────────────┐
│           Storage Manager                    │
│  ┌──────────────────────────────────────┐   │
│  │  Storage Type Detection               │   │
│  │  Migration Orchestration              │   │
│  │  Conflict Resolution                  │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│         Storage Backends                     │
│  ┌────────────────┬───────────────────┐     │
│  │ Local Storage  │  AT Protocol      │     │
│  ├────────────────┼───────────────────┤     │
│  │ • Bookmarks    │  • Bookmarks      │     │
│  │ • Columns      │  • Columns        │     │
│  │ • Drafts       │  • Drafts         │     │
│  │ • Preferences  │  • Preferences    │     │
│  │ • Cache        │  • Sync Data      │     │
│  └────────────────┴───────────────────┘     │
└─────────────────────────────────────────────┘
```

### Storage Strategy by Data Type

| Data Type     | Local Storage | AT Protocol               | Strategy                            |
| ------------- | ------------- | ------------------------- | ----------------------------------- |
| Bookmarks     | IndexedDB     | com.shadowsky.bookmarks   | User choice, migrate on change      |
| Columns       | LocalStorage  | com.shadowsky.columns     | User choice, auto-sync              |
| Drafts        | LocalStorage  | com.shadowsky.drafts      | User choice, conflict merge         |
| Preferences   | LocalStorage  | com.shadowsky.preferences | AT Protocol primary, local fallback |
| Notifications | IndexedDB     | Not stored                | Local only, 4-week retention        |
| Post Cache    | IndexedDB     | Not stored                | Local only, LRU eviction            |

## Authentication & Security

### Authentication Flow

```
Login Request
    ↓
Identifier Resolution (handle → DID)
    ↓
PDS Discovery
    ↓
Session Creation (JWT)
    ↓
Token Storage (localStorage)
    ↓
Service Initialization
    ↓
Data Synchronization
```

### Security Measures

1. **JWT Token Management**: Auto-refresh, secure storage
2. **App Passwords**: Scoped permissions for enhanced security
3. **2FA Support**: Auth factor token handling
4. **XSS Protection**: Content sanitization, CSP headers
5. **CORS Handling**: Proxy server for cross-origin requests

### Session Management

```typescript
// Session lifecycle
interface SessionLifecycle {
  login: "identifier → session";
  refresh: "expired token → new token";
  logout: "clear session → reset services";
  persistence: "localStorage → cross-tab sync";
}
```

## Frontend Architecture

### Component Hierarchy

```
App
├── Router
│   ├── AuthGuard
│   └── Routes
│       ├── Dashboard (SkyDeck)
│       ├── Settings
│       ├── Analytics
│       ├── Bookmarks
│       └── Messages
├── Providers
│   ├── QueryClient
│   ├── AuthContext
│   ├── ThemeContext
│   └── PreferencesContext
└── GlobalComponents
    ├── ErrorBoundary
    ├── Modals
    └── Toasts
```

### State Management Strategy

1. **Server State**: React Query for API data
2. **Global State**: Context API for app-wide state
3. **Local State**: useState/useReducer for component state
4. **Persistent State**: Storage backends for user data

### Performance Patterns

1. **Code Splitting**: Dynamic imports for routes
2. **Lazy Loading**: Component lazy loading with Suspense
3. \*\*Memo

**: Memoization of expensive computations 4. **Virtual Scrolling**: Virtualized lists for large datasets 5. **Optimistic Updates\*\*: Immediate UI updates with rollback

## API Integration Layer

### AT Protocol Client

```typescript
class ATProtoClient {
  // Core operations
  authenticate(identifier: string, password: string): Session;
  refreshSession(refreshToken: string): Session;

  // Record operations
  createRecord(collection: string, record: any): URI;
  updateRecord(uri: string, record: any): void;
  deleteRecord(uri: string): void;

  // Feed operations
  getTimeline(cursor?: string): Feed;
  getFeed(uri: string, cursor?: string): Feed;

  // Social operations
  like(uri: string): void;
  repost(uri: string): void;
  follow(did: string): void;
}
```

### External Service Integration

1. **Giphy API**: GIF search and embedding
2. **Anthropic API**: AI-powered alt text generation
3. **Google Analytics**: Usage tracking and insights
4. **Proxy Server**: CORS bypass for media fetching

## Performance Optimization

### Caching Strategy

```
┌──────────────────────────────────────┐
│         Multi-Layer Cache             │
├──────────────────────────────────────┤
│   Memory Cache (React Query)         │
│   • 5-minute stale time              │
│   • Background refetch               │
├──────────────────────────────────────┤
│   Browser Cache (IndexedDB)          │
│   • Persistent storage               │
│   • 4-week retention                 │
│   • LRU eviction                     │
├──────────────────────────────────────┤
│   Service Worker Cache               │
│   • Static assets                    │
│   • Offline support                  │
└──────────────────────────────────────┘
```

### Optimization Techniques

1. **Request Deduplication**: Prevent duplicate API calls
2. **Batch Operations**: Combine multiple operations
3. **Prefetching**: Anticipate user navigation
4. **Image Optimization**: Compression and lazy loading
5. **Bundle Optimization**: Tree shaking and minification

### Performance Monitoring

```typescript
interface PerformanceMetrics {
  // Core Web Vitals
  LCP: "Largest Contentful Paint < 2.5s";
  FID: "First Input Delay < 100ms";
  CLS: "Cumulative Layout Shift < 0.1";

  // Custom Metrics
  TTI: "Time to Interactive";
  FMP: "First Meaningful Paint";

  // API Metrics
  apiLatency: "Average API response time";
  cacheHitRate: "Percentage of cache hits";
}
```

## Deployment Architecture

### Build Pipeline

```
Source Code
    ↓
TypeScript Compilation
    ↓
Bundle Generation (Vite)
    ↓
Asset Optimization
    ↓
Static Files
    ↓
CDN Distribution
```

### Deployment Targets

1. **GitHub Pages**: Static hosting for demo
2. **Vercel/Netlify**: Production deployment with edge functions
3. **AWS S3 + CloudFront**: Scalable static hosting
4. **Self-hosted**: Docker container deployment

### Environment Configuration

```typescript
interface EnvironmentConfig {
  development: {
    apiUrl: "http://localhost:3000";
    debug: true;
    mockData: true;
  };
  staging: {
    apiUrl: "https://staging.shadowsky.app";
    debug: false;
    mockData: false;
  };
  production: {
    apiUrl: "https://api.shadowsky.app";
    debug: false;
    mockData: false;
  };
}
```

### Monitoring & Observability

1. **Error Tracking**: Sentry integration for error monitoring
2. **Analytics**: Google Analytics for usage patterns
3. **Performance**: Web Vitals monitoring
4. **Uptime**: Health check endpoints
5. **Logs**: Structured logging with log levels

## Technology Stack

### Frontend

- **React 18**: UI framework with concurrent features
- **TypeScript 5**: Type safety and IDE support
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Fast build tool and dev server

### State Management

- **React Query**: Server state management
- **Context API**: Global state management
- **IndexedDB**: Client-side database

### Build & Development

- **Wireit**: Task orchestration and caching
- **ESLint**: Code linting and standards
- **Prettier**: Code formatting
- **Vitest**: Unit and integration testing

### External Dependencies

- **@atproto/api**: AT Protocol client library
- **lucide-react**: Icon library
- **date-fns**: Date manipulation
- **hls.js**: Video streaming support

## Design Patterns

### 1. Service Wrapper Pattern

Handles service initialization and storage type switching transparently.

### 2. Storage Backend Pattern

Abstracts storage implementation details from business logic.

### 3. Context Provider Pattern

Manages global state with React Context API.

### 4. Custom Hook Pattern

Encapsulates complex logic in reusable hooks.

### 5. Optimistic Update Pattern

Updates UI immediately while async operations complete.

### 6. Error Boundary Pattern

Graceful error handling at component tree levels.

## Future Architecture Considerations

### Planned Enhancements

1. **Plugin System**: Extensible architecture for third-party plugins
2. **Web Worker Integration**: Offload heavy computations
3. **PWA Enhancement**: Better offline support with service workers
4. **Real-time Collaboration**: Multi-user features
5. **Federation Support**: Cross-instance communication

### Scalability Considerations

1. **Horizontal Scaling**: Stateless architecture for easy scaling
2. **Database Sharding**: Partition large datasets
3. **Edge Computing**: Deploy closer to users
4. **Microservices**: Split monolith into services
5. **Event-Driven**: Asynchronous processing for heavy operations

## Architectural Decisions Record (ADR)

### ADR-001: Dual Storage System

**Status**: Implemented
**Decision**: Support both local and AT Protocol storage
**Rationale**: Give users control over their data location
**Consequences**: Increased complexity, better privacy options

### ADR-002: React Query for Server State

**Status**: Implemented
**Decision**: Use React Query instead of Redux
**Rationale**: Better caching, simpler API, automatic background refetch
**Consequences**: Less boilerplate, better performance

### ADR-003: Tailwind CSS

**Status**: Implemented
**Decision**: Use Tailwind for styling
**Rationale**: Rapid development, consistent design, small bundle size
**Consequences**: Learning curve, utility-first approach

### ADR-004: Vite Build Tool

**Status**: Implemented
**Decision**: Use Vite instead of Webpack
**Rationale**: Faster builds, better DX, native ESM support
**Consequences**: Modern toolchain, faster development

### ADR-005: TypeScript Strict Mode

**Status**: Implemented
**Decision**: Enable strict TypeScript checking
**Rationale**: Catch more errors at compile time
**Consequences**: More type annotations needed, safer code

## Contact & Maintenance

**Primary Maintainer**: Asphodel Team
**Architecture Reviews**: Monthly architecture review meetings
**Documentation Updates**: Updated with each major feature
**Contact**: architecture@shadowsky.app

---

_This document is a living reference and should be updated as the architecture evolves. Last updated: 2024_
