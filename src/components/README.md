# Components Directory (`/src/components`)

## Overview
This directory contains all React components for the ShadowSky application. Components are organized by feature and responsibility, with shared UI components in dedicated folders.

## Directory Structure

```
components/
├── providers/        # Context providers and app-level wrappers
├── settings/         # Settings and preferences UI components
├── ui/              # Reusable UI components (buttons, modals, etc.)
├── SkyDeck/         # Multi-column dashboard components
├── Analytics/       # Analytics and metrics components
├── Bookmarks/       # Bookmark management components
├── Composer/        # Post composition components
├── Messages/        # Direct messaging components
├── Notifications/   # Notification display components
└── [Feature]/       # Other feature-specific components
```

## Component Categories

### 1. UI Components (`/ui`)
**Purpose**: Reusable, presentational components
**Examples**: Button, Modal, Card, Dropdown, Spinner
**Characteristics**:
- No business logic
- Highly reusable
- Consistent styling
- Accessible by default

### 2. Feature Components
**Purpose**: Business logic and feature implementation
**Examples**: SkyDeck, Analytics, Bookmarks
**Characteristics**:
- Contains business logic
- Uses services and hooks
- May have sub-components
- Feature-specific

### 3. Provider Components (`/providers`)
**Purpose**: Global state and context providers
**Examples**: QueryProvider, ThemeProvider
**Characteristics**:
- Wraps app or sections
- Provides context values
- Handles initialization
- No UI rendering

### 4. Settings Components (`/settings`)
**Purpose**: User preferences and configuration
**Examples**: StorageSettings, ThemeSettings
**Characteristics**:
- Form-based interfaces
- Preference management
- Validation logic
- Settings persistence

## Component Standards

### File Naming
```
ComponentName.tsx          # Component implementation
ComponentName.test.tsx     # Component tests
ComponentName.module.css   # Component styles (if needed)
index.ts                  # Public exports
```

### Component Structure
```typescript
// Standard functional component
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const [state, setState] = useState();
  const { data } = useQuery();

  // Event handlers
  const handleClick = () => { /* ... */ };

  // Effects
  useEffect(() => { /* ... */ }, []);

  // Render
  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}
```

### Props Interface
```typescript
interface ComponentProps {
  // Required props
  id: string;
  name: string;

  // Optional props
  className?: string;
  onClick?: () => void;

  // Children
  children?: React.ReactNode;
}
```

## Component Patterns

### Container/Presentational Pattern
```typescript
// Container (smart component)
function UserListContainer() {
  const users = useUsers();
  return <UserList users={users} />;
}

// Presentational (dumb component)
function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {users.map(user => <UserItem key={user.id} user={user} />)}
    </ul>
  );
}
```

### Compound Component Pattern
```typescript
// Parent component with child components
export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter
};

// Usage
<Card.Root>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card.Root>
```

### Render Props Pattern
```typescript
function DataProvider({ render }: { render: (data: Data) => JSX.Element }) {
  const data = useData();
  return render(data);
}
```

## Styling Guidelines

### Tailwind CSS Classes
```typescript
// Prefer Tailwind utilities
<div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800">
  {/* Content */}
</div>
```

### CSS Modules (when needed)
```typescript
// Import styles
import styles from './Component.module.css';

// Apply styles
<div className={styles.container}>
  {/* Content */}
</div>
```

### Dynamic Styles
```typescript
// Use conditional classes
<button
  className={cn(
    "px-4 py-2 rounded",
    isActive ? "bg-blue-500" : "bg-gray-500",
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
```

## Performance Best Practices

### Memoization
```typescript
// Memoize expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component implementation
});

// Memoize callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency]);

// Memoize computed values
const computedValue = useMemo(() => {
  return expensiveComputation(data);
}, [data]);
```

### Lazy Loading
```typescript
// Lazy load heavy components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Virtual Scrolling
```typescript
// For long lists
import { VirtualList } from '@/components/ui/VirtualList';

<VirtualList
  items={items}
  itemHeight={50}
  renderItem={(item) => <ItemComponent item={item} />}
/>
```

## Accessibility Guidelines

### ARIA Attributes
```typescript
<button
  aria-label="Close dialog"
  aria-pressed={isPressed}
  role="button"
  tabIndex={0}
>
```

### Keyboard Navigation
```typescript
// Handle keyboard events
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleSelect();
  }
};
```

### Focus Management
```typescript
// Manage focus
useEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
  }
}, [isOpen]);
```

## Testing Components

### Basic Component Test
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('renders and handles click', async () => {
  const handleClick = jest.fn();

  render(<Button onClick={handleClick}>Click me</Button>);

  const button = screen.getByText('Click me');
  await userEvent.click(button);

  expect(handleClick).toHaveBeenCalled();
});
```

### Testing with Context
```typescript
// Wrap with providers
render(
  <QueryClient>
    <AuthContext.Provider value={mockAuth}>
      <Component />
    </AuthContext.Provider>
  </QueryClient>
);
```

## Common Components Reference

### UI Components
- **Button**: Standard button with variants
- **Modal**: Overlay dialog component
- **Card**: Content container with sections
- **Dropdown**: Select menu component
- **Toast**: Notification messages
- **Spinner**: Loading indicator
- **Avatar**: User profile image
- **Badge**: Status indicators

### Feature Components
- **SkyDeck**: Multi-column dashboard
- **PostComposer**: Create new posts
- **NotificationList**: Display notifications
- **BookmarkGrid**: Bookmark gallery
- **AnalyticsChart**: Data visualizations
- **SettingsPanel**: Configuration UI

## Import Guidelines

### Import Order
```typescript
// 1. React and libraries
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// 3. Hooks
import { useAuth } from '@/hooks/useAuth';

// 4. Utils
import { formatDate } from '@/utils/date';

// 5. Types
import type { User } from '@/types';

// 6. Styles
import styles from './Component.module.css';
```

## Component Checklist

When creating a new component:

- [ ] TypeScript props interface defined
- [ ] Proper error handling implemented
- [ ] Loading states handled
- [ ] Accessibility attributes added
- [ ] Responsive design tested
- [ ] Dark mode support verified
- [ ] Component documented
- [ ] Tests written
- [ ] Performance optimized
- [ ] Code reviewed

## Related Documentation

- **[ui/README.md](ui/README.md)**: UI component library
- **[settings/README.md](settings/README.md)**: Settings components
- **[providers/README.md](providers/README.md)**: Provider patterns

---

*Components are the building blocks of the application. Keep them focused, reusable, and well-tested.*