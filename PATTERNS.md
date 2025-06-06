# Development Patterns and Learnings

This document captures recurring patterns, successful approaches, and lessons learned across development sessions.

## Pattern Categories
- 🐛 Bug Patterns - Common issues and fixes
- ✅ Success Patterns - Approaches that work well
- 🚫 Anti-Patterns - Things to avoid
- 🔧 Tooling Patterns - Development workflow optimizations
- 🎨 UI/UX Patterns - Interface design approaches

---

## 🐛 Bug Patterns

### Safari Localhost Issues
**Problem**: Safari can't connect to localhost:5173
**Solution**: Use http://127.0.0.1:5173 instead
**Frequency**: Every Safari session
**Root Cause**: Safari's stricter security policies

### AT Protocol Text Location Variations
**Problem**: Post text can be in multiple locations in the API response
**Locations to check**:
1. `post.record.value.text`
2. `post.record.text`
3. `post.value.text`
4. `post.text`
**Solution**: Implement fallback chain checking all locations
**Frequency**: Common with parent posts and replies

### PostCSS Import Warnings
**Problem**: "@import must precede all other statements"
**Solution**: Move @import statements to top of CSS files
**Frequency**: Every build
**Impact**: Warning only, doesn't break functionality

## ✅ Success Patterns

### Error Boundary Implementation
**Pattern**: Wrap major UI sections in error boundaries
**Benefits**: Graceful degradation, better user experience
**Implementation**: Custom ErrorBoundary component with retry

### Service Layer Abstraction
**Pattern**: Separate AT Protocol logic from React components
**Benefits**: Testable, reusable, clean separation
**Example**: services/atproto/* structure

### React Query for Server State
**Pattern**: Use React Query for all API calls
**Benefits**: 
- Automatic caching
- Background refetching
- Optimistic updates
- Error/loading states
**Key**: Configure stale time based on data type

### Development Automation
**Pattern**: Scripts for common tasks
**Benefits**: Consistent environment, fewer manual steps
**Examples**:
- dev-server.sh for server management
- open-chrome.sh for browser testing
- check-dev-errors.js for error monitoring

## 🚫 Anti-Patterns

### Direct DOM Manipulation
**Avoid**: Using document.querySelector in React
**Use Instead**: React refs and state

### Synchronous Session Checks
**Avoid**: Blocking UI while checking auth
**Use Instead**: Optimistic UI with background validation

### Hardcoded Styles
**Avoid**: Inline styles with magic numbers
**Use Instead**: CSS variables from design system

## 🔧 Tooling Patterns

### Git Commit Workflow
**Pattern**: Commit after each feature/fix completion
**Benefits**: Easy rollback, clear history
**Naming**: Descriptive messages focusing on "why"

### Console Error Monitoring
**Pattern**: Automated script checking for errors
**Benefits**: Catch issues early
**Implementation**: Node script parsing Vite output

### Chrome-First Development
**Pattern**: Primary testing in Chrome, verify in Safari
**Benefits**: Better DevTools, consistent behavior
**Note**: Always test Safari before deployment

## 🎨 UI/UX Patterns

### Thread Visualization
**Pattern**: Vertical line connecting posts
**Implementation**: CSS pseudo-elements
**Key Measurements**:
- Line offset: 24px from left padding
- Avatar size: 48px for parents, 40px for replies
- Connector height: Calculated dynamically

### Loading States
**Pattern**: Skeleton screens over spinners
**Benefits**: Better perceived performance
**Implementation**: CSS animations on placeholder elements

### Error Messages
**Pattern**: User-friendly text with actions
**Examples**:
- "Rate limited. Try again in X seconds"
- "Session expired. Please log in again"
**Avoid**: Technical error codes

### Dark Theme Variables
**Pattern**: CSS custom properties for all colors
**Benefits**: Easy theme switching later
**Key Variables**:
- --color-bg-*: Background layers
- --color-text-*: Text hierarchy
- --color-accent-*: Interactive elements

## 📊 Performance Patterns

### Infinite Scroll
**Pattern**: Intersection Observer for trigger
**Benefits**: Better than scroll event listeners
**Key**: Disconnect observer when not needed

### Image Optimization
**Pattern**: Lazy load avatars and media
**Benefits**: Faster initial load
**Implementation**: React lazy + Suspense

### Bundle Optimization
**Pattern**: Analyze and split large dependencies
**Tools**: vite-plugin-visualizer
**Target**: Keep initial bundle < 500KB