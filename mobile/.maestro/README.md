# Maestro E2E Tests

This directory contains End-to-End (E2E) tests for the Shadowsky mobile app using [Maestro](https://maestro.mobile.dev/).

## Installation

Install Maestro CLI:

```bash
# macOS/Linux
curl -Ls "https://get.maestro.mobile.dev" | bash

# Or using Homebrew (macOS)
brew tap mobile-dev-inc/tap
brew install maestro
```

## Running Tests

### Prerequisites

1. Start the Expo development server:
```bash
npm start
```

2. Launch the app on a simulator/emulator or physical device

### Run Individual Tests

```bash
# Test authentication flow
maestro test .maestro/auth_flow.yaml

# Test post creation
maestro test .maestro/post_creation.yaml

# Test feed navigation
maestro test .maestro/feed_navigation.yaml

# Test offline behavior
maestro test .maestro/offline_behavior.yaml

# Test profile navigation
maestro test .maestro/profile_navigation.yaml
```

### Run All Tests

```bash
maestro test .maestro/
```

### Run Tests with Recording

```bash
maestro test --format junit --output results.xml .maestro/auth_flow.yaml
```

## Test Coverage

### 1. Authentication Flow (`auth_flow.yaml`)
- ✅ User sign in with credentials
- ✅ Navigation after authentication
- ✅ Sign out functionality
- ✅ Account switching

### 2. Post Creation (`post_creation.yaml`)
- ✅ Creating text posts
- ✅ Creating posts with images
- ✅ Adding alt text to images
- ✅ Creating threads
- ✅ Post validation

### 3. Feed Navigation (`feed_navigation.yaml`)
- ✅ Scrolling through feed
- ✅ Pull to refresh
- ✅ Interacting with posts (like, reply, repost)
- ✅ Quote posting
- ✅ Feed switching (Following/Discover)

### 4. Offline Behavior (`offline_behavior.yaml`)
- ✅ Viewing cached content offline
- ✅ Handling post creation while offline
- ✅ Draft saving
- ✅ Syncing when back online
- ✅ Error messages for offline operations

### 5. Profile Navigation (`profile_navigation.yaml`)
- ✅ Viewing own profile
- ✅ Editing profile information
- ✅ Profile tabs (Posts, Replies, Media, Likes)
- ✅ Viewing other users' profiles
- ✅ Following/unfollowing users
- ✅ Viewing followers/following lists

## CI Integration

These tests can be run in CI using Maestro Cloud or local runners. See the GitHub Actions workflow in `.github/workflows/mobile-e2e.yml`.

## Troubleshooting

### Test Fails to Find Element

If a test fails to find an element, ensure:
1. The app is fully loaded before the test runs
2. Element IDs match those in the app code
3. Add `wait` commands if needed for async operations

### Simulator Issues

If tests fail on simulator:
1. Reset simulator: `xcrun simctl erase all`
2. Restart Maestro daemon: `maestro stop && maestro start`

### Flaky Tests

If tests are flaky:
1. Add appropriate `wait` commands
2. Increase timeouts for slow operations
3. Check for race conditions in the app

## Writing New Tests

When writing new tests:
1. Use clear, descriptive test names
2. Assert expected states after actions
3. Clean up state at the end of tests
4. Use meaningful test IDs in components
5. Test both happy paths and error cases

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro API Reference](https://maestro.mobile.dev/api-reference)
- [Maestro Best Practices](https://maestro.mobile.dev/best-practices)
