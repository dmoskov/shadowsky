# Deep Link Testing Guide

## Overview

This document provides comprehensive testing instructions for the ShadowSky mobile app's deep linking functionality with Expo Router.

**Task**: [P2] QA: Test deep linking with shadowsky:// and bsky:// URL schemes
**Asana Task**: https://app.asana.com/1/19421316985/project/1211710875848660/task/1213223832437732

## Configuration Review

### ✅ URL Schemes Configuration (app.config.ts:10)
- **shadowsky://** - Primary custom scheme
- **bsky://** - Secondary custom scheme for compatibility

### ✅ Universal Links (iOS) - app.config.ts:21-26
- `applinks:shadowsky.io`
- `applinks:main.shadowsky.io`
- `applinks:bsky.app`
- `applinks:staging.bsky.app`

### ✅ App Links (Android) - app.config.ts:34-46
Intent filters configured for:
- `https://shadowsky.io`
- `https://main.shadowsky.io`
- `https://bsky.app`
- `https://staging.bsky.app`

### ✅ OAuth Callback Route
- Route: `app/(auth)/oauth-callback.tsx`
- Handles: `shadowsky://oauth-callback?code=...&state=...`
- Properly extracts code, state, and error parameters

## Route Structure (Expo Router)

Expo Router automatically generates deep link handling based on the file-system structure:

```
app/
├── (auth)/
│   ├── index.tsx              → shadowsky://auth
│   └── oauth-callback.tsx     → shadowsky://oauth-callback
└── (app)/
    ├── compose.tsx            → shadowsky://compose
    ├── settings.tsx           → shadowsky://settings
    ├── lists.tsx              → shadowsky://lists
    ├── analytics.tsx          → shadowsky://analytics
    ├── scheduled.tsx          → shadowsky://scheduled
    └── (tabs)/
        ├── (home)/
        │   ├── index.tsx                → shadowsky://home
        │   ├── timeline.tsx             → shadowsky://home/timeline
        │   ├── profile/[handle].tsx     → shadowsky://home/profile/user.bsky.social
        │   ├── thread/[postId].tsx      → shadowsky://home/thread/abc123
        │   └── list/[listId].tsx        → shadowsky://home/list/xyz789
        ├── (search)/
        │   ├── index.tsx                → shadowsky://search
        │   ├── profile/[handle].tsx     → shadowsky://search/profile/user.bsky.social
        │   └── thread/[postId].tsx      → shadowsky://search/thread/abc123
        ├── (notifications)/
        │   ├── index.tsx                → shadowsky://notifications
        │   ├── analytics.tsx            → shadowsky://notifications/analytics
        │   ├── profile/[handle].tsx     → shadowsky://notifications/profile/user.bsky.social
        │   └── thread/[postId].tsx      → shadowsky://notifications/thread/abc123
        └── (profile)/
            ├── index.tsx                → shadowsky://profile
            ├── bookmarks.tsx            → shadowsky://profile/bookmarks
            ├── messages.tsx             → shadowsky://profile/messages
            ├── user/[handle].tsx        → shadowsky://profile/user/user.bsky.social
            └── thread/[postId].tsx      → shadowsky://profile/thread/abc123
```

## Test Cases

### Prerequisites
- Mobile app installed on device/simulator
- Developer tools available:
  - **iOS**: `npx uri-scheme` (part of Expo CLI)
  - **Android**: `adb shell am start`

### 1. URL Scheme Registration

#### iOS Test
```bash
# Check registered schemes
npx uri-scheme list --ios

# Expected output should include:
# - shadowsky
# - bsky
```

#### Android Test
```bash
# Check intent filters
adb shell dumpsys package io.shadowsky.app | grep -A 5 "scheme"

# Expected output should show both schemes registered
```

### 2. Custom URL Scheme Tests - shadowsky://

#### Test 2.1: Home Tab
```bash
# iOS
npx uri-scheme open shadowsky://home --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://home" io.shadowsky.app

# Expected: App opens to Home tab
```

#### Test 2.2: Search Tab
```bash
# iOS
npx uri-scheme open shadowsky://search --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://search" io.shadowsky.app

# Expected: App opens to Search tab
```

#### Test 2.3: Notifications Tab
```bash
# iOS
npx uri-scheme open shadowsky://notifications --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://notifications" io.shadowsky.app

# Expected: App opens to Notifications tab
```

#### Test 2.4: Profile Tab
```bash
# iOS
npx uri-scheme open shadowsky://profile --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://profile" io.shadowsky.app

# Expected: App opens to Profile tab
```

#### Test 2.5: Compose Screen
```bash
# iOS
npx uri-scheme open shadowsky://compose --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://compose" io.shadowsky.app

# Expected: App opens Compose screen (modal or full-screen)
```

#### Test 2.6: Settings Screen
```bash
# iOS
npx uri-scheme open shadowsky://settings --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://settings" io.shadowsky.app

# Expected: App opens Settings screen
```

#### Test 2.7: Lists Screen
```bash
# iOS
npx uri-scheme open shadowsky://lists --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://lists" io.shadowsky.app

# Expected: App opens Lists screen
```

#### Test 2.8: Bookmarks
```bash
# iOS
npx uri-scheme open shadowsky://profile/bookmarks --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://profile/bookmarks" io.shadowsky.app

# Expected: App navigates to Bookmarks screen
```

#### Test 2.9: Profile by Handle
```bash
# iOS
npx uri-scheme open "shadowsky://home/profile/alice.bsky.social" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://home/profile/alice.bsky.social" io.shadowsky.app

# Expected: App opens profile for alice.bsky.social
# Note: Can also use search/profile or notifications/profile paths
```

#### Test 2.10: Thread by Post ID
```bash
# iOS
npx uri-scheme open "shadowsky://home/thread/3km4q2z5abc" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://home/thread/3km4q2z5abc" io.shadowsky.app

# Expected: App opens thread view for the post
```

#### Test 2.11: List by ID
```bash
# iOS
npx uri-scheme open "shadowsky://home/list/list123xyz" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://home/list/list123xyz" io.shadowsky.app

# Expected: App opens the specified list timeline
```

### 3. Alternate URL Scheme Tests - bsky://

#### Test 3.1: Home via bsky://
```bash
# iOS
npx uri-scheme open bsky://home --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "bsky://home" io.shadowsky.app

# Expected: App opens to Home tab (same as shadowsky://)
```

#### Test 3.2: Profile via bsky://
```bash
# iOS
npx uri-scheme open "bsky://home/profile/alice.bsky.social" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "bsky://home/profile/alice.bsky.social" io.shadowsky.app

# Expected: App opens profile (same as shadowsky://)
```

#### Test 3.3: Compose via bsky://
```bash
# iOS
npx uri-scheme open bsky://compose --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "bsky://compose" io.shadowsky.app

# Expected: App opens Compose screen
```

### 4. OAuth Callback Deep Link

#### Test 4.1: Successful OAuth Callback
```bash
# iOS
npx uri-scheme open "shadowsky://oauth-callback?code=test_auth_code&state=test_state" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://oauth-callback?code=test_auth_code&state=test_state" io.shadowsky.app

# Expected: App handles OAuth callback, extracts code and state
# Should navigate to appropriate screen after auth completion
```

#### Test 4.2: OAuth Error Callback
```bash
# iOS
npx uri-scheme open "shadowsky://oauth-callback?error=access_denied&state=test_state" --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://oauth-callback?error=access_denied&state=test_state" io.shadowsky.app

# Expected: App shows error message or handles error gracefully
```

### 5. Universal Links (iOS) / App Links (Android)

**Note**: Universal/App Links require proper domain verification and app deployment.

#### Test 5.1: bsky.app Universal Link
```bash
# iOS (via Safari or Notes app)
# Tap on: https://bsky.app/profile/alice.bsky.social

# Android (via Chrome or default browser)
# Tap on: https://bsky.app/profile/alice.bsky.social

# Expected: App opens instead of browser, navigates to profile
```

#### Test 5.2: shadowsky.io Universal Link
```bash
# iOS (via Safari or Notes app)
# Tap on: https://shadowsky.io/profile/alice.bsky.social

# Android (via Chrome or default browser)
# Tap on: https://shadowsky.io/profile/alice.bsky.social

# Expected: App opens instead of browser, navigates to profile
```

### 6. Cold Start vs Warm Start Tests

#### Test 6.1: Cold Start (App Not Running)
1. Force quit the app completely
2. Run any deep link test (e.g., `shadowsky://compose`)
3. **Expected**: App launches and navigates to the correct screen

#### Test 6.2: Warm Start (App Backgrounded)
1. Open the app normally
2. Background the app (home button/gesture)
3. Run any deep link test (e.g., `shadowsky://profile`)
4. **Expected**: App comes to foreground and navigates to the correct screen

#### Test 6.3: Hot Start (App Already Foregrounded)
1. Open the app and navigate to Home
2. Without closing, run a deep link test (e.g., `shadowsky://settings`)
3. **Expected**: App navigates to the settings screen

### 7. Invalid Deep Link Handling

#### Test 7.1: Invalid Route
```bash
# iOS
npx uri-scheme open shadowsky://invalid-route-name --ios

# Android
adb shell am start -a android.intent.action.VIEW -d "shadowsky://invalid-route-name" io.shadowsky.app

# Expected: App should handle gracefully (show 404 or navigate to home)
# Note: app/+not-found.tsx should handle this
```

#### Test 7.2: Malformed Parameters
```bash
# iOS
npx uri-scheme open "shadowsky://home/profile/" --ios

# Expected: App handles gracefully, doesn't crash
```

## Deep Link Utility Functions (src/utils/deepLinks.ts)

The codebase includes helper functions for building deep links:

```typescript
// Build generic deep link
buildDeepLink("home") // → "bsky://home"
buildDeepLink("search", { q: "test" }) // → "bsky://search?q=test"

// Build profile link
buildProfileLink("alice.bsky.social") // → "bsky://profile/alice.bsky.social"

// Build thread link
buildThreadLink("alice.bsky.social", "3km4q2z5abc") // → "bsky://profile/alice.bsky.social/post/3km4q2z5abc"

// Build search link
buildSearchLink("test query") // → "bsky://search?q=test+query"
```

**Note**: These functions currently build `bsky://` URLs. Both `shadowsky://` and `bsky://` schemes are registered and should work identically.

## Authentication Flow with Deep Links

The app uses an `AuthGate` component in `app/_layout.tsx` that:
1. Redirects unauthenticated users to `/(auth)` routes
2. Redirects authenticated users from auth routes to `/(app)/(tabs)/(home)`
3. This ensures deep links respect authentication state

### Test 8.1: Deep Link When Not Authenticated
1. Log out of the app (or clear auth state)
2. Try opening: `shadowsky://compose`
3. **Expected**: App should redirect to login screen, then navigate to compose after auth

### Test 8.2: OAuth Callback Authentication
1. Start OAuth flow (triggers external browser)
2. Complete OAuth on provider
3. Provider redirects to: `shadowsky://oauth-callback?code=...&state=...`
4. **Expected**: App handles callback, completes auth, navigates to home

## Known Limitations & Notes

1. **Expo Router Auto-Linking**: Expo Router v5 automatically generates linking configuration from the file structure. No manual linking config needed.

2. **Group Routes**: Routes in parentheses like `(tabs)` or `(home)` are layout groups and don't appear in URLs.

3. **Dynamic Routes**: Square brackets like `[handle].tsx` create dynamic segments that match any value.

4. **Universal Links**: Require:
   - Proper AASA (Apple App Site Association) file hosted at domain
   - Domain verification in Apple Developer console
   - Valid SSL certificate

5. **App Links (Android)**: Require:
   - Digital Asset Links JSON file at `/.well-known/assetlinks.json`
   - Signed app with matching SHA-256 fingerprint

6. **deepLinks.ts Functions**: Currently build `bsky://` URLs. Consider updating to use `shadowsky://` as primary or make scheme configurable.

## Verification Checklist

- [ ] Both `shadowsky://` and `bsky://` schemes are registered in app.config.ts
- [ ] All tab navigation deep links work (home, search, notifications, profile)
- [ ] Compose screen opens via `shadowsky://compose`
- [ ] Settings screen opens via `shadowsky://settings`
- [ ] Profile deep links work with handle parameter
- [ ] Thread deep links work with post ID parameter
- [ ] List deep links work with list ID parameter
- [ ] OAuth callback route properly handles code, state, and error parameters
- [ ] Cold start (app not running) handles deep links correctly
- [ ] Warm start (app backgrounded) handles deep links correctly
- [ ] Hot navigation (app foregrounded) handles deep links correctly
- [ ] Invalid routes are handled gracefully (404 screen)
- [ ] Universal links configuration is present for iOS
- [ ] App links configuration is present for Android
- [ ] Authentication gate respects deep link navigation

## Testing Tools

### Expo CLI
```bash
# Install globally
npm install -g @expo/cli

# Test deep links on iOS simulator
npx uri-scheme open shadowsky://home --ios

# Test deep links on Android emulator
npx uri-scheme open shadowsky://home --android
```

### Android Debug Bridge (ADB)
```bash
# Test deep link
adb shell am start -a android.intent.action.VIEW -d "shadowsky://home" io.shadowsky.app

# View app logs
adb logcat | grep shadowsky

# Check intent filters
adb shell dumpsys package io.shadowsky.app
```

### iOS Simulator
```bash
# Open URL in simulator
xcrun simctl openurl booted "shadowsky://home"

# Get device list
xcrun simctl list devices
```

## Troubleshooting

### Issue: Deep link opens browser instead of app
- **iOS**: Check associated domains in Xcode entitlements
- **Android**: Verify intent filters in AndroidManifest.xml and digital asset links

### Issue: App crashes on deep link
- Check logs for navigation errors
- Verify route exists in app/ directory structure
- Ensure parameters match expected format

### Issue: Deep link doesn't navigate
- Verify app is properly installed
- Check that scheme is registered (use uri-scheme list)
- Ensure navigation is not blocked by auth gate

### Issue: OAuth callback not working
- Verify callback URL matches exactly: `shadowsky://oauth-callback`
- Check that route file exists: `app/(auth)/oauth-callback.tsx`
- Test with sample parameters first

## Next Steps

1. **Manual Testing**: Execute all test cases on physical devices
2. **Automated Testing**: Consider adding E2E tests with Detox or Maestro
3. **Analytics**: Add deep link tracking to monitor usage
4. **Documentation**: Update main README with successful test results
5. **Universal Links**: Set up AASA and Digital Asset Links files on domains

## Related Files

- `mobile/app.config.ts` - URL schemes and associated domains
- `mobile/src/utils/deepLinks.ts` - Deep link builder utilities
- `mobile/app/(auth)/oauth-callback.tsx` - OAuth callback route
- `mobile/app/_layout.tsx` - Root layout with AuthGate
- `mobile/app/(app)/(tabs)/_layout.tsx` - Tab navigation layout

---

**Last Updated**: 2026-02-11
**Created By**: Claude (Automated QA Review)
**Status**: Ready for manual testing
