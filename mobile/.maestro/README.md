# Maestro E2E Tests

End-to-End tests for the Asphodel (Shadowsky) mobile app using [Maestro](https://maestro.mobile.dev/).

## Installation

```bash
# macOS/Linux
curl -Ls "https://get.maestro.mobile.dev" | bash

# Or using Homebrew (macOS)
brew tap mobile-dev-inc/tap
brew install maestro
```

## Test Categories

### Unauthenticated Tests (always pass, no credentials needed)

These tests exercise the auth screen UI without requiring a Bluesky account:

| Test | File | What it covers |
|------|------|----------------|
| App Launch | `app_launch.yaml` | App starts, auth screen renders with correct text |
| Auth Mode Switch | `auth_mode_switch.yaml` | Switching between OAuth and App Password modes |
| Auth Input Validation | `auth_input_validation.yaml` | Form inputs, placeholder text, Advanced PDS toggle |

### Authenticated Tests (require test credentials)

These tests require `MAESTRO_TEST_HANDLE` and `MAESTRO_TEST_APP_PASSWORD` env vars.
They sign in via App Password and exercise the main app screens:

| Test | File | What it covers |
|------|------|----------------|
| Feed Scroll | `feed_scroll.yaml` | Home feed loads, scroll, pull-to-refresh |
| Profile View | `profile_view.yaml` | Profile header, stats, tab switching |
| Tab Navigation | `tab_navigation.yaml` | Navigate all 5 tabs: Home, Search, Feeds, Notifications, Profile |

### Disabled Tests (reference only)

Previous fictional tests are in `disabled/` for intent reference. They do not run.

## Running Tests

### Prerequisites

1. Build and run the app on an iOS Simulator
2. Ensure the simulator is booted (`xcrun simctl list devices booted`)

### Run unauthenticated tests (no credentials needed)

```bash
maestro test .maestro/app_launch.yaml
maestro test .maestro/auth_mode_switch.yaml
maestro test .maestro/auth_input_validation.yaml
```

### Run authenticated tests (credentials required)

```bash
export MAESTRO_TEST_HANDLE=your.handle.bsky.social
export MAESTRO_TEST_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

maestro test .maestro/feed_scroll.yaml
maestro test .maestro/profile_view.yaml
maestro test .maestro/tab_navigation.yaml
```

### Run all tests with JUnit output

```bash
maestro test --format junit --output e2e-results.xml .maestro/
```

## Accessibility Identifiers

Tests target elements via text content, accessibility labels, and accessibility identifiers.
Key identifiers added to the codebase:

### React Native (testID)
- `auth-title` - App title on auth screen
- `oauth-sign-in-button` - OAuth sign-in button
- `oauth-handle-input` - Handle input field
- `auth-mode-toggle` - OAuth/App Password toggle container
- `tab-home`, `tab-search`, `tab-feeds`, `tab-notifications`, `tab-profile` - Tab bar items
- `home-screen` - Home screen container
- `feed-picker` - Feed picker scroll view
- `feed-chip-following` - Following feed chip

### SwiftUI (accessibilityIdentifier)
- `feed-list` - Main feed list container
- `feed-post-{index}` - Individual post cards (0-indexed)
- `feed-loading` - Feed loading skeleton
- `feed-empty` - Empty feed state
- `reply-button`, `repost-button`, `like-button`, `share-button` - Post action buttons
- `post-actions` - Post actions bar
- `profile-display-name` - Profile display name
- `profile-handle` - Profile handle (@username)
- `profile-stats` - Stats section container
- `profile-posts-count`, `profile-followers-count`, `profile-following-count` - Stats
- `profile-tab-bar` - Profile content tab bar
- `profile-tab-{name}` - Individual profile tabs (posts, replies, media, likes)
- `edit-profile-button`, `sign-out-button` - Profile action buttons

## Troubleshooting

### Test Fails to Find Element

1. Verify the app is fully loaded before assertions
2. Check that element text matches exactly (case-sensitive)
3. Use `waitForAnimationToEnd` after navigation actions
4. For authenticated tests, verify credentials are valid

### Simulator Issues

```bash
# Reset simulator
xcrun simctl erase all

# Restart Maestro daemon
maestro stop && maestro start
```

## CI Integration

See `.github/workflows/mobile-tests.yml` for the E2E job configuration.
Unauthenticated tests run on every PR. Authenticated tests run when
`MAESTRO_TEST_HANDLE` and `MAESTRO_TEST_APP_PASSWORD` secrets are configured.
