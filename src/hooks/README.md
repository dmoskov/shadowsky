# Hooks Directory (`/src/hooks`)

## Overview
This directory contains custom React hooks that encapsulate reusable logic, state management, and side effects. Hooks promote code reuse and separate concerns from component rendering logic.

## Hook Categories

### 1. Data Fetching Hooks
Hooks that handle API calls and data management
```typescript
useBookmarks()      // Fetch and manage bookmarks
useNotifications()  // Fetch and update notifications
useFeed()          // Load feed data with pagination
useProfile()       // Get user profile information
```

### 2. State Management Hooks
Hooks that manage complex state logic
```typescript
useLocalStorage()   // Persist state to localStorage
useSessionStorage() // Persist state to sessionStorage
useDebounce()      // Debounce rapidly changing values
useToggle()        // Boolean state toggle
```

### 3. UI/Interaction Hooks
Hooks for user interface interactions
```typescript
useModal()         // Modal open/close state
useKeyboard()      // Keyboard shortcut handling
useSwipeGesture()  // Mobile swipe detection
useIntersection()  // Intersection observer
useMediaQuery()    // Responsive breakpoints
```

### 4. Business Logic Hooks
Hooks that encapsulate domain-specific logic
```typescript
useAuth()          // Authentication state and methods
usePreferences()   // User preferences management
useModeration()    // Content moderation rules
useAnalytics()     // Analytics tracking
```

## Hook Patterns

### Basic Custom Hook
```typescript
export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, reset };
}
```

### Data Fetching Hook with React Query
```typescript
export function useBookmarks() {
  const { agent } = useAuth();

  const query = useQuery({
    queryKey: ['bookmarks', agent?.session?.did],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated');
      return await bookmarkService.getAll();
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const addBookmark = useMutation({
    mutationFn: async (post: Post) => {
      return await bookmarkService.add(post);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookmarks']);
    },
  });

  return {
    bookmarks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addBookmark: addBookmark.mutate,
    refetch: query.refetch,
  };
}
```

### Local Storage Hook
```typescript
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Get from localStorage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  // Save to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function
        ? value(storedValue)
        : value;

      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue];
}
```

### Debounce Hook
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Keyboard Shortcut Hook
```typescript
export function useKeyboard(
  key: string,
  callback: () => void,
  options?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    preventDefault?: boolean;
  }
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== key) return;

      if (options?.ctrl && !event.ctrlKey) return;
      if (options?.alt && !event.altKey) return;
      if (options?.shift && !event.shiftKey) return;

      if (options?.preventDefault) {
        event.preventDefault();
      }

      callback();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}
```

### Media Query Hook
```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}
```

## Hook Composition

### Combining Multiple Hooks
```typescript
export function useAuthenticatedData() {
  const { agent, isAuthenticated } = useAuth();
  const preferences = usePreferences();
  const bookmarks = useBookmarks();
  const notifications = useNotifications();

  return {
    isLoading: !isAuthenticated ||
               bookmarks.isLoading ||
               notifications.isLoading,
    data: {
      preferences,
      bookmarks: bookmarks.data,
      notifications: notifications.data,
    },
    error: bookmarks.error || notifications.error,
  };
}
```

### Hook with Context
```typescript
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
```

## Testing Hooks

### Using React Testing Library
```typescript
import { renderHook, act } from '@testing-library/react';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

### Testing Async Hooks
```typescript
import { renderHook, waitFor } from '@testing-library/react';

describe('useBookmarks', () => {
  it('should fetch bookmarks', async () => {
    const wrapper = ({ children }) => (
      <QueryClient>
        {children}
      </QueryClient>
    );

    const { result } = renderHook(() => useBookmarks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bookmarks).toHaveLength(3);
  });
});
```

## Hook Rules and Best Practices

### Rules of Hooks
1. **Only call hooks at the top level**: Don't call hooks inside loops, conditions, or nested functions
2. **Only call hooks from React functions**: Either React components or custom hooks
3. **Use consistent naming**: Custom hooks must start with `use`

### Best Practices
```typescript
// ✅ Good: Clear dependencies
useEffect(() => {
  fetchData(id);
}, [id]);

// ❌ Bad: Missing dependencies
useEffect(() => {
  fetchData(id);
}, []); // ESLint warning

// ✅ Good: Cleanup effect
useEffect(() => {
  const timer = setTimeout(callback, 1000);
  return () => clearTimeout(timer);
}, [callback]);

// ✅ Good: Stable references with useCallback
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);

// ✅ Good: Expensive computations with useMemo
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);
```

## Performance Optimization

### Dependency Optimization
```typescript
// Avoid creating new objects in dependencies
const options = useMemo(() => ({
  enabled: isEnabled,
  retries: 3
}), [isEnabled]);

useEffect(() => {
  fetchWithOptions(options);
}, [options]);
```

### Ref vs State
```typescript
// Use ref for values that don't trigger re-renders
export function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

## Common Hook Examples

### `useAuth()`
```typescript
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### `useNotifications()`
```typescript
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}
```

### `useInfiniteScroll()`
```typescript
export function useInfiniteScroll(fetchMore: () => Promise<void>) {
  const observer = useRef<IntersectionObserver>();
  const lastElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [fetchMore]);

  return lastElementRef;
}
```

## Hook Documentation Template

When creating a new hook:

```typescript
/**
 * Hook description
 *
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Object containing:
 *   - data: The fetched data
 *   - isLoading: Loading state
 *   - error: Error if any
 *
 * @example
 * const { data, isLoading } = useMyHook('param');
 */
export function useMyHook(param1: string, param2?: number) {
  // Implementation
}
```

## Testing Checklist

- [ ] Test initial state
- [ ] Test state updates
- [ ] Test error cases
- [ ] Test cleanup functions
- [ ] Test with different parameters
- [ ] Test re-rendering behavior
- [ ] Mock external dependencies
- [ ] Test loading states
- [ ] Test edge cases

## Related Documentation

- **[React Hooks Documentation](https://react.dev/reference/react)**: Official React hooks
- **[React Query Hooks](https://tanstack.com/query)**: Data fetching hooks
- **[Testing Hooks](https://testing-library.com/docs/react-testing-library/api/#renderhook)**: Hook testing guide

---

*Hooks are powerful tools for sharing logic. Keep them focused, well-tested, and properly documented.*