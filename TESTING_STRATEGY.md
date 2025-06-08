# Testing Strategy

## Overview
This document outlines our testing strategy following the Distinguished Engineer recommendations. We're implementing a comprehensive testing approach with a focus on critical paths and gradual coverage increase.

## Current Status
- **Infrastructure**: ✅ Complete (Jest + React Testing Library)
- **Coverage**: 3.69% (Baseline established)
- **First Test**: ✅ usePostInteractions hook (66% passing)

## Testing Principles

### 1. Test the Critical Path First
Focus on features that, if broken, would most impact users:
- Authentication flow
- Post interactions (likes, reposts)
- Feed loading and pagination
- Thread navigation
- Data persistence

### 2. Test Pyramid
```
         /\
        /  \  E2E Tests (10%)
       /    \ 
      /      \  Integration Tests (30%)
     /        \
    /__________\ Unit Tests (60%)
```

### 3. Coverage Goals
- **Week 1**: 10% coverage (critical paths)
- **Month 1**: 30% coverage (main features)
- **Month 2**: 50% coverage (comprehensive)
- **Month 3**: 80% coverage (production ready)

## Test Organization

### Unit Tests
Location: `src/[feature]/__tests__/[component].test.tsx`

Priority order:
1. ✅ Hooks (usePostInteractions)
2. ⬜ Services (atproto client)
3. ⬜ Utilities (error handling, formatters)
4. ⬜ Components (isolated logic)

### Integration Tests
Location: `src/__tests__/integration/`

Priority order:
1. ⬜ Authentication flow
2. ⬜ Post creation and interactions
3. ⬜ Feed pagination
4. ⬜ Thread navigation
5. ⬜ Search functionality

### E2E Tests
Location: `tests/e2e/`

Priority order:
1. ⬜ Login → Feed → Post interaction
2. ⬜ Create post → View in feed
3. ⬜ Navigate thread → Reply
4. ⬜ Search → View profile

## Testing Checklist

### Immediate (This Week)
- [x] Set up Jest infrastructure
- [x] Create test utilities
- [x] First hook test (usePostInteractions)
- [ ] Fix failing tests (3 remaining)
- [ ] Add tests for useAuth hook
- [ ] Add tests for useTimeline hook
- [ ] Test error boundaries
- [ ] Reach 10% coverage

### Short Term (Next 2 Weeks)
- [ ] Test all API services
- [ ] Test React Query integration
- [ ] Test form validation
- [ ] Test keyboard navigation
- [ ] Add snapshot tests for key components
- [ ] Reach 30% coverage

### Medium Term (Month 1-2)
- [ ] Integration test suite
- [ ] E2E happy paths
- [ ] Performance tests
- [ ] Accessibility tests
- [ ] Visual regression tests
- [ ] Reach 50% coverage

## Testing Patterns

### Mock Management
```typescript
// Centralized mocks in __mocks__ directories
__mocks__/
  @atproto/
    api.ts
  services/
    atproto.ts
```

### Test Data Factories
```typescript
// Use factories for consistent test data
const post = createMockPost({ 
  likeCount: 10,
  viewer: { like: 'at://...' }
});
```

### Async Testing
```typescript
// Always use act() for async operations
await act(async () => {
  await result.current.someAsyncAction();
});
```

### Component Testing
```typescript
// Use custom render with providers
const { getByRole } = render(<Component />, {
  wrapper: AllTheProviders
});
```

## Common Testing Scenarios

### 1. Testing Hooks
```typescript
const { result } = renderHook(() => useCustomHook(), {
  wrapper: AllTheProviders
});
```

### 2. Testing API Calls
```typescript
// Mock at the service level
jest.mock('../services/api');
mockApi.getPosts.mockResolvedValue(mockData);
```

### 3. Testing User Interactions
```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button'));
```

### 4. Testing Loading States
```typescript
// Check loading → success flow
expect(screen.getByText('Loading')).toBeInTheDocument();
await waitFor(() => {
  expect(screen.getByText('Content')).toBeInTheDocument();
});
```

## Debugging Failed Tests

### Common Issues
1. **Async warnings**: Always await act() calls
2. **Provider errors**: Use simplified test providers
3. **TypeScript errors**: Update mock types regularly
4. **Timing issues**: Use waitFor() instead of setTimeout

### Debug Tools
- `screen.debug()` - Print DOM
- `screen.logTestingPlaygroundURL()` - Interactive debugger
- `--watch` mode for rapid iteration
- `--coverage` to find untested code

## CI Integration

### Pre-commit Hooks
```bash
npm test -- --bail --findRelatedTests
```

### PR Checks
- All tests must pass
- Coverage must not decrease
- No console errors/warnings

### Nightly Runs
- Full test suite with coverage
- E2E tests on multiple browsers
- Performance benchmarks

## Maintenance

### Weekly Tasks
- Review and fix flaky tests
- Update snapshots if needed
- Add tests for new features
- Review coverage reports

### Monthly Tasks
- Audit test performance
- Refactor slow tests
- Update testing patterns
- Document new patterns

## Resources
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Last Updated**: 2025-01-08
**Next Review**: After reaching 10% coverage
**Owner**: Engineering Team