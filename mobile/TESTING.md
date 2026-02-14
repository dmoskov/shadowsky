# Testing Guide for Shadowsky Mobile

This document describes the testing strategy and setup for the Shadowsky mobile app.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [CI Integration](#ci-integration)
6. [Coverage Requirements](#coverage-requirements)
7. [Troubleshooting](#troubleshooting)

## Testing Philosophy

We follow the testing pyramid approach:
- **Unit Tests** (60%): Test individual functions and components in isolation
- **Integration Tests** (30%): Test how components work together
- **E2E Tests** (10%): Test critical user flows end-to-end

All new features should include appropriate tests. Aim for meaningful coverage, not just high percentages.

## Test Types

### Unit Tests

Located in `src/**/__tests__/*.test.{ts,tsx}`

Unit tests verify individual functions, hooks, and components work correctly in isolation.

**Technologies:**
- Jest
- React Native Testing Library
- React Hooks Testing Library

**What to test:**
- Pure functions and utilities
- Custom hooks
- Component rendering and interaction
- State management (contexts, reducers)

**Example:**
```typescript
import { renderHook } from '@testing-library/react-native';
import { useAuth } from '../contexts/AuthContext';

test('signs in user with valid credentials', async () => {
  const { result } = renderHook(() => useAuth());
  await result.current.signIn('test@example.com', 'password');
  expect(result.current.isAuthenticated).toBe(true);
});
```

### Integration Tests

Integration tests verify that multiple components, hooks, or services work together correctly.

**What to test:**
- Data fetching with React Query
- Network state management
- Offline behavior
- Cache synchronization
- Navigation flows

**Example:**
```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFeed } from '../hooks/api/useFeed';

test('loads feed and handles pagination', async () => {
  const { result } = renderHook(() => useFeed('following'));

  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });

  result.current.fetchNextPage();

  await waitFor(() => {
    expect(result.current.data.pages.length).toBeGreaterThan(1);
  });
});
```

### E2E Tests (Maestro)

Located in `.maestro/*.yaml`

E2E tests verify complete user workflows work correctly on real devices/simulators.

**Technologies:**
- Maestro

**What to test:**
- Critical user journeys (auth, post creation, feed browsing)
- Cross-screen workflows
- Offline/online transitions
- Real device interactions (gestures, keyboard)

**Example:**
See `.maestro/auth_flow.yaml` for a complete example.

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- AuthContext.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="sign in"
```

### E2E Tests

```bash
# Install Maestro (first time only)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Start app
npm start

# Run all E2E tests
maestro test .maestro/

# Run specific E2E test
maestro test .maestro/auth_flow.yaml

# Run with recording
maestro test --format junit --output results.xml .maestro/auth_flow.yaml
```

## Writing Tests

### Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
   ```typescript
   test('description', () => {
     // Arrange: Set up test data
     const user = { id: '1', name: 'Test' };

     // Act: Perform action
     const result = formatUser(user);

     // Assert: Verify result
     expect(result).toBe('Test (1)');
   });
   ```

2. **Test behavior, not implementation**: Focus on what the code does, not how
   ```typescript
   // ❌ Bad: Testing implementation details
   expect(component.state.isLoading).toBe(true);

   // ✅ Good: Testing behavior
   expect(screen.getByTestId('loading-spinner')).toBeVisible();
   ```

3. **Use meaningful test descriptions**
   ```typescript
   // ❌ Bad
   test('test 1', () => { ... });

   // ✅ Good
   test('shows error message when sign in fails', () => { ... });
   ```

4. **Mock external dependencies**
   ```typescript
   jest.mock('@atproto/api', () => ({
     BskyAgent: jest.fn(() => ({
       login: jest.fn(),
     })),
   }));
   ```

5. **Clean up after tests**
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
     cleanup();
   });
   ```

### Component Testing

Use React Native Testing Library for component tests:

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

test('calls onPress when button is pressed', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button onPress={onPress}>Click me</Button>);

  fireEvent.press(getByText('Click me'));

  expect(onPress).toHaveBeenCalledTimes(1);
});
```

### Hook Testing

Use React Hooks Testing Library for hook tests:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useCounter } from '../useCounter';

test('increments counter', () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

### Async Testing

Use `waitFor` for async operations:

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFeed } from '../hooks/api/useFeed';

test('loads feed data', async () => {
  const { result } = renderHook(() => useFeed());

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.data).toBeDefined();
});
```

## CI Integration

Tests run automatically on:
- Pull requests to `main`
- Pushes to `main` branch
- Changes to mobile app code

See `.github/workflows/mobile-tests.yml` for the complete CI configuration.

### CI Jobs

1. **Unit Tests**: Runs all Jest tests with coverage reporting
2. **E2E Tests**: Runs Maestro tests on iOS simulator
3. **Build Check**: Verifies TypeScript compilation

### Status Checks

Pull requests must pass all tests before merging:
- ✅ Unit tests pass
- ✅ E2E tests pass
- ✅ Code coverage meets thresholds
- ✅ No TypeScript errors

## Coverage Requirements

Minimum coverage thresholds (configured in `jest.config.js`):

- **Statements**: 50%
- **Branches**: 40%
- **Functions**: 40%
- **Lines**: 50%

Critical paths should have higher coverage:
- Authentication: 80%+
- Data fetching: 70%+
- Post creation: 70%+

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Troubleshooting

### Tests Timeout

Increase timeout for slow operations:
```typescript
test('slow operation', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

### Mock Not Working

Ensure mocks are defined before imports:
```typescript
jest.mock('../service', () => ({
  fetchData: jest.fn(),
}));

import { Component } from '../Component'; // Import after mock
```

### Snapshot Mismatch

Update snapshots after intentional changes:
```bash
npm test -- -u
```

### Flaky Tests

Common causes:
1. Timing issues - use `waitFor` for async operations
2. Shared state - ensure proper cleanup between tests
3. Network mocks - verify all endpoints are mocked
4. Random data - use deterministic test data

### E2E Tests Fail

1. Ensure app is running: `npm start`
2. Check simulator is booted: `xcrun simctl list`
3. Reset Maestro: `maestro stop && maestro start`
4. Check test IDs match app code

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Getting Help

- Check existing tests for examples
- Review this guide
- Ask in team chat
- Open an issue for documentation improvements
