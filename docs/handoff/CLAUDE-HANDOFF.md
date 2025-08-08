# Bluesky Client - Claude Code Instructions

This document provides comprehensive instructions for using Claude Code to continue development on the Bluesky client project. It includes project context, patterns, common tasks, and guidelines optimized for AI-assisted development.

## 🎯 Project Overview

You are working on a custom Bluesky (AT Protocol) client built with React, TypeScript, and Vite. The client provides a full-featured interface for interacting with the Bluesky social network, with additional features beyond the official client.

### Core Principles

1. **Type Safety First**: Use TypeScript strictly, avoid `any` types
2. **AT Protocol Compliance**: Always use authenticated agents and proper namespaces
3. **Performance Matters**: Optimize for speed and smooth interactions
4. **User Experience**: Clean, intuitive interface with thoughtful interactions
5. **Code Reusability**: Check existing code before creating new components

## 🏗️ Architecture Context

### Technology Stack

```yaml
Frontend:
  - React 18 with TypeScript
  - Vite for build tooling
  - TanStack Query for data fetching
  - Tailwind CSS for styling
  - Framer Motion for animations

AT Protocol:
  - @atproto/api official SDK
  - Custom service layer for all API calls
  - Proper error handling and rate limiting

State Management:
  - React Context for auth state
  - TanStack Query for server state
  - Local storage for preferences
  - IndexedDB for analytics data
```

### Critical Patterns

#### 1. AT Protocol Authentication

```typescript
// ALWAYS use authenticated agent from context
const { agent } = useAuth();

// NEVER use convenience methods
// ❌ agent.searchPosts()
// ✅ agent.app.bsky.feed.searchPosts()

// ALWAYS use full namespaces
// ❌ agent.feed.getTimeline()
// ✅ agent.app.bsky.feed.getTimeline()
```

#### 2. Service Layer Pattern

```typescript
// All API calls go through service classes
import { feedService } from "../services/atproto";

// Services handle:
// - Error mapping
// - Rate limiting
// - Request deduplication
// - Type safety
```

#### 3. Component Organization

```typescript
// Feature-based structure
components/
  feed/         # Feed-related components
  thread/       # Thread viewing components
  profile/      # User profile components
  modals/       # Modal dialogs
  ui/           # Reusable UI components
```

## 📋 Common Development Tasks

### Adding a New Feature

1. **Check Existing Code First**

```bash
# Search for similar functionality
grep -r "feature_name" src/
# Check component index
cat src/components/index.ts
```

2. **Follow Established Patterns**

- Look at similar features for guidance
- Use existing hooks and utilities
- Maintain consistent styling

3. **Update Documentation**

- Add to SESSION_NOTES.md during development
- Update CLAUDE.md when feature stabilizes
- Document in progress/ folder

### Working with AT Protocol

#### Fetching Data

```typescript
// Use service layer
const posts = await feedService.getTimeline(cursor);

// Use React Query hooks
const { data, isLoading } = useTimeline();

// Handle errors properly
try {
  const result = await service.method();
} catch (error) {
  handleError(mapATProtoError(error));
}
```

#### Creating Content

```typescript
// Always validate before sending
const post = {
  text: validatePostText(content),
  createdAt: new Date().toISOString(),
};

// Use proper record creation
await agent.com.atproto.repo.createRecord({
  repo: session.did,
  collection: "app.bsky.feed.post",
  record: post,
});
```

### Styling Guidelines

#### Color System

```css
/* Use CSS variables from design system */
background: var(--color-bg-primary);    /* #0F172A */
color: var(--color-text-primary);      /* #F1F5F9 */
border: 1px solid var(--color-border); /* rgba(255,255,255,0.1) */

/* Or Tailwind classes */
bg-gray-900    /* Main background */
text-gray-100  /* Primary text */
border-gray-800 /* Borders */
```

#### Responsive Design

```typescript
// Use ResponsiveContainer for consistent widths
<ResponsiveContainer>
  <Feed />
</ResponsiveContainer>

// Fixed widths: 600px max on desktop
// Full width on mobile with padding
```

### Testing

#### Unit Tests

```typescript
// Test utilities and hooks
describe("usePostInteractions", () => {
  it("should handle like action", async () => {
    // Test implementation
  });
});
```

#### E2E Tests

```typescript
// Test user flows with Playwright
test("user can create post", async ({ page }) => {
  await page.goto("/");
  await loginUser(page);
  await createPost(page, "Test content");
  await expect(page.locator(".post")).toContainText("Test content");
});
```

## 🚨 Important Warnings

### Security

1. **NEVER hardcode credentials** - Use environment variables
2. **NEVER commit .env.local** - It's gitignored for a reason
3. **ALWAYS validate user input** - Prevent XSS and injection
4. **USE the test-credentials helper** - For test scripts

### Performance

1. **Avoid unnecessary re-renders** - Use React.memo wisely
2. **Implement virtualization** - For long lists
3. **Optimize images** - Use proper sizing and lazy loading
4. **Cache API responses** - TanStack Query handles this

### Common Pitfalls

1. **Don't create duplicate components** - Check existing first
2. **Don't use relative imports** - Use `@/` alias
3. **Don't skip error boundaries** - Wrap risky components
4. **Don't ignore TypeScript errors** - Fix them properly

## 🛠️ Development Workflow

### Daily Development

```bash
# Start dev server
npm run dev

# In another terminal, monitor for errors
npm run check:errors

# Run tests before committing
npm test
npm run type-check
```

### Git Workflow

```bash
# Claude manages commits autonomously
# Commits happen at natural breakpoints
# Work on feature branches for major changes
git checkout -b feature/new-feature
```

### Documentation Flow

```
Active Work → SESSION_NOTES.md → progress/*.md → CLAUDE.md
(immediate)   (session end)      (complete)     (stable)
```

## 📚 Key Files Reference

### Configuration

- `vite.config.ts` - Build configuration
- `tailwind.config.js` - Styling configuration
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variables template

### Core Application

- `src/App.tsx` - Main application component
- `src/main.tsx` - Application entry point
- `src/contexts/AuthContext.tsx` - Authentication state
- `src/services/atproto/` - AT Protocol services

### Documentation

- `CLAUDE.md` - This file, AI development guide
- `SESSION_NOTES.md` - Current session progress
- `DECISIONS.md` - Architecture decisions
- `PATTERNS.md` - Code patterns and conventions

## 🔧 Debugging Tools

### Browser Tools

```javascript
// Debug in console
window.__BLUESKY_CLIENT__ = {
  auth: () => console.log(localStorage.getItem("auth")),
  clearCache: () => queryClient.clear(),
  toggleDebug: () => localStorage.setItem("debug", "true"),
};
```

### Performance Monitoring

```typescript
// Built-in performance tracking
import { performanceTracker } from "@/lib/performance-tracking";

performanceTracker.startMeasure("my-operation");
// ... operation ...
performanceTracker.endMeasure("my-operation");
```

### Error Tracking

```typescript
// Centralized error handling
import { useErrorHandler } from "@/hooks/useErrorHandler";

const { handleError } = useErrorHandler();
handleError(error); // Logs and displays appropriately
```

## 🚀 Next Steps

### Immediate Priorities

1. Complete cleanup plan (see CLEANUP_PLAN.md)
2. Remove hardcoded credentials
3. Organize scattered test files
4. Update documentation

### Feature Development

1. Multi-account support
2. Offline mode
3. Advanced search filters
4. Custom feed algorithms
5. Plugin system

### Technical Debt

1. Migrate analytics to server-side storage
2. Implement proper WebSocket support
3. Add service worker for offline
4. Improve test coverage

## 💡 Tips for Claude Code

1. **Be Specific**: Provide clear, detailed requirements
2. **Reference Patterns**: Point to existing code as examples
3. **Test Incrementally**: Verify changes work before moving on
4. **Document Decisions**: Update DECISIONS.md for architecture changes
5. **Use Todo System**: Track progress with TodoWrite/TodoRead
6. **Visual Verification**: Take screenshots for UI changes
7. **Check Existing Code**: Always search before creating new files

Remember: The codebase is well-structured with established patterns. Follow them for consistency and maintainability.
