# Source Code Directory (`/src`)

## Overview
This directory contains all the application source code for ShadowSky. The code is organized by feature and responsibility, following React and TypeScript best practices.

## Directory Structure

```
src/
├── components/      # Reusable UI components and feature components
├── contexts/        # React Context providers for global state
├── hooks/          # Custom React hooks
├── lib/            # Third-party library configurations
├── pages/          # Route-level page components
├── services/       # Business logic and API integrations
├── shared/         # Shared utilities and constants
├── styles/         # Global styles and CSS modules
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and helpers
├── App.tsx         # Root application component
├── main.tsx        # Application entry point
└── vite-env.d.ts   # Vite environment type definitions
```

## Key Files

### `main.tsx`
The application entry point that:
- Sets up React root
- Wraps app with providers
- Initializes error boundaries
- Configures React Query client

### `App.tsx`
The root component that:
- Sets up routing
- Provides global contexts
- Handles authentication flow
- Manages theme and preferences

### `vite-env.d.ts`
TypeScript definitions for:
- Vite-specific types
- Environment variables
- Import meta extensions

## Component Organization

### Feature-Based Structure
Components are organized by feature rather than type:
- Each feature has its own directory
- Related components are grouped together
- Shared components live in `components/ui/`

### Component Patterns
```typescript
// Standard component structure
ComponentName/
├── ComponentName.tsx       # Main component
├── ComponentName.test.tsx  # Tests
├── ComponentName.module.css # Styles (if needed)
├── index.ts               # Public exports
└── subcomponents/         # Child components
```

## State Management Strategy

### 1. Server State (React Query)
- API data fetching
- Caching and synchronization
- Background refetching
- Optimistic updates

### 2. Global State (Context API)
- Authentication state
- User preferences
- Theme settings
- Moderation rules

### 3. Local State (useState/useReducer)
- Form inputs
- UI toggles
- Component-specific data

## Service Layer Architecture

Services handle business logic and external integrations:

### Service Types
1. **Core Services**: Business logic (`bookmark-service`, `column-service`)
2. **Storage Services**: Data persistence (`storage-backends`)
3. **API Services**: External integrations (`atproto`, `giphy`)
4. **Utility Services**: Helpers (`analytics`, `logger`)

### Service Pattern
```typescript
// Wrapper → Service → Backend
ServiceWrapper (initialization)
  └→ CoreService (business logic)
      └→ StorageBackend (persistence)
```

## Development Guidelines

### Adding New Features
1. Create feature directory in appropriate location
2. Follow existing component patterns
3. Add types to `types/` directory
4. Create service wrapper if needed
5. Add tests alongside implementation

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules
- Format with Prettier
- Use Tailwind for styling
- Prefer composition over inheritance

### Import Order
```typescript
// External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal absolute imports
import { AuthContext } from '@/contexts/AuthContext';

// Relative imports
import { Button } from './Button';
import styles from './Component.module.css';

// Type imports
import type { User } from '@/types';
```

## Testing Strategy

### Test Types
- **Unit Tests**: Utilities and pure functions
- **Component Tests**: React Testing Library
- **Integration Tests**: Service interactions
- **E2E Tests**: User flows (in `/tests/e2e`)

### Test Location
Tests are co-located with implementation:
```
ComponentName.tsx
ComponentName.test.tsx
```

## Performance Considerations

### Code Splitting
- Routes are lazy loaded
- Large components use dynamic imports
- Heavy libraries loaded on demand

### Optimization Techniques
- React.memo for expensive components
- useMemo/useCallback for expensive operations
- Virtual scrolling for long lists
- Image lazy loading and optimization

## Common Patterns

### Custom Hooks
```typescript
// Encapsulate complex logic
export function useBookmarks() {
  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: fetchBookmarks
  });

  return { bookmarks: data, isLoading };
}
```

### Error Boundaries
```typescript
// Wrap features with error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <FeatureComponent />
</ErrorBoundary>
```

### Suspense Boundaries
```typescript
// Handle loading states
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

## Environment Variables

Access through `import.meta.env`:
```typescript
const apiKey = import.meta.env.VITE_API_KEY;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

## Build Configuration

### TypeScript Config
- Strict mode enabled
- Path aliases configured
- Source maps generated
- Declaration files emitted

### Vite Config
- Optimized dependencies
- Chunking strategy
- Environment variables
- Proxy configuration

## Debugging

### Debug Mode
```javascript
// Enable in browser console
window.enableDebug();
```

### React DevTools
- Component tree inspection
- State and props viewing
- Performance profiling
- React Query DevTools included

## Related Documentation

- **[components/README.md](components/README.md)**: Component guidelines
- **[services/README.md](services/README.md)**: Service architecture
- **[hooks/README.md](hooks/README.md)**: Custom hooks documentation
- **[types/README.md](types/README.md)**: TypeScript types

---

*This is the main source directory. Follow existing patterns and maintain consistency when adding new code.*