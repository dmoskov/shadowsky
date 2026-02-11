# QA Test Plan: Authentication Flow End-to-End Testing

**Task:** [1213223821955402] Verify auth flow end-to-end on iOS/Android simulator
**Date:** 2026-02-11
**Status:** Ready for Manual Testing

## Overview

This document outlines the comprehensive test plan for verifying the authentication flow after the Expo Router migration (completed in commit f440bd1). All test cases are based on the requirements specified in the Asana task.

## Test Environment

- **Mobile App Version:** 0.7.0
- **Expo SDK:** 54.0.33
- **Expo Router:** 5.0.7
- **React Native:** 0.81.5
- **Testing Platforms:** iOS Simulator (macOS) / Android Emulator

## Code Review Summary

### ✅ Implementation Verification

**1. AuthGate Logic (app/_layout.tsx)**
- Lines 19-36: Implements redirect logic based on authentication state
- Fresh install: `isAuthenticated` = false → redirects to `/(auth)` group
- After login: `isAuthenticated` = true → redirects to `/(app)/(tabs)/(home)`
- After logout: `isAuthenticated` = false → redirects back to `/(auth)` group

**2. Authentication Context (src/contexts/AuthContext.tsx)**
- Lines 30-42: Exposes `isAuthenticated` boolean computed from session state
- Line 260: `isAuthenticated: session !== null` - correctly returns auth state
- Lines 204-215: `signIn` method handles password authentication
- Lines 70-78: `signOut` method clears session and timers

**3. Auth Service (src/services/auth/auth-service.ts)**
- Lines 30-65: `signInWithPassword` - authenticates and stores session
- Lines 117-121: `signOut` - removes current session from AsyncStorage
- AsyncStorage Keys Used:
  - `@shadowsky/auth_session` - Current active session (CLEARED on signOut)
  - `@shadowsky/active_account` - Active account DID (CLEARED on signOut)
  - `@shadowsky/accounts` - All accounts list (RETAINED for multi-account)
  - `@shadowsky/sessions` - All sessions list (RETAINED for multi-account)

**4. Landing Screen (src/screens/auth/LandingScreen.tsx)**
- Lines 22-39: Login handler with validation and error handling
- Line 24: Shows alert for empty credentials
- Lines 32-35: Shows alert for invalid credentials, stays on login screen
- Line 30: Calls `signIn` from AuthContext

### ✅ Expected Behavior

All test cases should pass based on code analysis:

1. **Fresh Install** → Landing screen shown (auth group)
2. **Valid Login** → Redirect to home tab via AuthGate
3. **Invalid Login** → Error alert shown, stays on login screen
4. **Auth State** → `useAuth().isAuthenticated` returns `true` after successful login
5. **Sign Out** → Redirects to auth screen via AuthGate
6. **Storage Cleanup** → Current session removed from AsyncStorage (auth_session, active_account keys)

---

## Test Cases

### Test Case 1: Fresh Install - Landing Screen Display

**Objective:** Verify that a fresh install shows the authentication screen

**Prerequisites:**
- Clean simulator/emulator (or clear app data)
- No existing authentication session

**Steps:**
1. Install the app on iOS/Android simulator
2. Launch the app

**Expected Results:**
- ✅ App displays LandingScreen (/(auth) route group)
- ✅ Shows "ShadowSky" title and subtitle
- ✅ Shows "Handle or Email" and "App Password" input fields
- ✅ Shows "Sign In" button
- ✅ Shows "Sign in with Bluesky" OAuth button

**Verification Points:**
- `useAuth().isAuthenticated` should be `false`
- `useAuth().session` should be `null`
- No AsyncStorage data under `@shadowsky/auth_session`

---

### Test Case 2: Valid Credentials - Sign In Success

**Objective:** Verify successful authentication with valid credentials

**Prerequisites:**
- Fresh install or logged out state
- Valid Bluesky account with app password

**Test Data:**
- Handle: `[tester-handle].bsky.social` or email
- App Password: Valid app password (format: xxxx-xxxx-xxxx-xxxx)

**Steps:**
1. Open the app (should be on LandingScreen)
2. Enter valid handle/email in "Handle or Email" field
3. Enter valid app password in "App Password" field
4. Tap "Sign In" button
5. Wait for authentication to complete

**Expected Results:**
- ✅ Loading indicator appears during authentication
- ✅ No error alert is shown
- ✅ App redirects to home tab: `/(app)/(tabs)/(home)`
- ✅ User can see their home timeline
- ✅ Navigation bar shows tabs (Home, Notifications, Search, Profile)

**Verification Points:**
- `useAuth().isAuthenticated` should return `true`
- `useAuth().session` should contain valid session data
- `useAuth().account` should contain user profile data
- AsyncStorage contains session data under `@shadowsky/auth_session`
- Session timers are set up for refresh (50 min) and validity checks (5 min)

**Debug Verification (if needed):**
```javascript
// In React Native Debugger or browser console
AsyncStorage.getItem('@shadowsky/auth_session').then(console.log);
```

---

### Test Case 3: Invalid Credentials - Error Handling

**Objective:** Verify error handling for invalid credentials

**Prerequisites:**
- Fresh install or logged out state

**Test Data:**
- Handle: `invalid-handle.bsky.social`
- App Password: `invalid-password-1234`

**Steps:**
1. Open the app (should be on LandingScreen)
2. Enter invalid handle in "Handle or Email" field
3. Enter invalid password in "App Password" field
4. Tap "Sign In" button

**Expected Results:**
- ✅ Loading indicator appears briefly
- ✅ Alert dialog appears with:
  - Title: "Sign In Failed"
  - Message: "Invalid credentials. Please check your handle and app password."
- ✅ After dismissing alert, user stays on LandingScreen
- ✅ Input fields remain filled with entered values
- ✅ User can retry with correct credentials

**Verification Points:**
- `useAuth().isAuthenticated` should remain `false`
- `useAuth().session` should remain `null`
- No session data stored in AsyncStorage
- No redirect occurs

---

### Test Case 4: Empty Fields Validation

**Objective:** Verify validation for empty input fields

**Prerequisites:**
- Fresh install or logged out state

**Steps:**
1. Open the app (should be on LandingScreen)
2. Leave both fields empty
3. Tap "Sign In" button

**Expected Results:**
- ✅ Alert dialog appears with:
  - Title: "Error"
  - Message: "Please enter both handle and app password"
- ✅ User stays on LandingScreen
- ✅ No network request is made

**Additional Tests:**
- Test with only handle filled (password empty)
- Test with only password filled (handle empty)
- Test with whitespace-only values

---

### Test Case 5: useAuth Hook - isAuthenticated State

**Objective:** Verify that useAuth() correctly reflects authentication state

**Prerequisites:**
- Fresh install
- Valid credentials

**Steps:**
1. Open the app
2. Verify initial state: `isAuthenticated` should be `false`
3. Sign in with valid credentials
4. Verify post-login state: `isAuthenticated` should be `true`
5. Kill and restart the app
6. Verify persisted state: `isAuthenticated` should be `true` (session resumed)

**Expected Results:**
- ✅ Initial state: `isAuthenticated = false`, `isLoading = true` → then `false`
- ✅ After login: `isAuthenticated = true`, `session != null`
- ✅ After restart: Session is automatically resumed from AsyncStorage
- ✅ `account` object contains: `did`, `handle`, `displayName`, `avatar`

**Verification Points:**
- AuthContext correctly exposes authentication state
- Session persistence works across app restarts
- Session resume logic works correctly

---

### Test Case 6: Sign Out - Redirect to Auth Screen

**Objective:** Verify sign out functionality and redirect behavior

**Prerequisites:**
- User is logged in (completed Test Case 2)

**Steps:**
1. Ensure user is logged in and on home screen
2. Navigate to Profile tab
3. Find and tap "Sign Out" or "Logout" button
4. Confirm sign out if prompted

**Expected Results:**
- ✅ User is immediately redirected to `/(auth)` route
- ✅ LandingScreen is displayed
- ✅ No user data visible on screen
- ✅ `useAuth().isAuthenticated` returns `false`
- ✅ `useAuth().session` is `null`

**Verification Points:**
- AuthGate detects `isAuthenticated = false` and redirects
- User cannot navigate back to authenticated routes
- Attempting to access `/(app)/*` routes redirects to `/(auth)`

---

### Test Case 7: AsyncStorage Cleanup After Sign Out

**Objective:** Verify that sign out properly clears session data from AsyncStorage

**Prerequisites:**
- User is logged in
- React Native Debugger or access to AsyncStorage

**Steps:**
1. Before sign out, verify AsyncStorage contains:
   - `@shadowsky/auth_session` (current session)
   - `@shadowsky/active_account` (current account DID)
2. Sign out
3. Check AsyncStorage after sign out

**Expected Results:**
- ✅ `@shadowsky/auth_session` is removed
- ✅ `@shadowsky/active_account` is removed
- ✅ AT Proto client is reset
- ✅ Session refresh timers are cleared

**Note on Multi-Account Support:**
- `@shadowsky/accounts` list is RETAINED (by design)
- `@shadowsky/sessions` list is RETAINED (by design)
- This allows users to switch accounts without re-authenticating

**Debug Commands:**
```javascript
// Before sign out
await AsyncStorage.getItem('@shadowsky/auth_session'); // Should contain session
await AsyncStorage.getItem('@shadowsky/active_account'); // Should contain DID

// After sign out
await AsyncStorage.getItem('@shadowsky/auth_session'); // Should be null
await AsyncStorage.getItem('@shadowsky/active_account'); // Should be null

// Multi-account data (retained)
await AsyncStorage.getItem('@shadowsky/accounts'); // May still contain account list
await AsyncStorage.getItem('@shadowsky/sessions'); // May still contain session list
```

---

### Test Case 8: Session Persistence Across App Restarts

**Objective:** Verify that authenticated sessions persist across app restarts

**Prerequisites:**
- User is logged in

**Steps:**
1. Log in with valid credentials
2. Verify user is on home screen
3. Force close the app (swipe up from app switcher)
4. Reopen the app

**Expected Results:**
- ✅ User is automatically logged in
- ✅ App opens directly to home tab (not landing screen)
- ✅ Session is resumed from AsyncStorage
- ✅ Profile data is refreshed from server

**Verification Points:**
- `resumeSession()` is called on app start
- Session tokens are still valid
- If tokens are expired, refresh is attempted
- If refresh fails, user is logged out

---

### Test Case 9: Session Refresh and Validity

**Objective:** Verify automatic session refresh and validity checks

**Prerequisites:**
- User is logged in
- App is running

**Steps:**
1. Log in and keep app in foreground
2. Wait for session refresh interval (50 minutes - not practical for manual test)
3. Alternatively, test session validity check (5 minutes)

**Expected Results:**
- ✅ Session tokens are automatically refreshed every 50 minutes
- ✅ Session validity is checked every 5 minutes
- ✅ If session is invalid, refresh is attempted
- ✅ If refresh fails, user is logged out

**Note:** This test is difficult to perform manually due to long intervals. Consider:
- Shortening intervals in test environment
- Using automated testing
- Testing by manually invalidating tokens

---

### Test Case 10: App State Change Handling

**Objective:** Verify session checks when app returns to foreground

**Prerequisites:**
- User is logged in

**Steps:**
1. Log in with valid credentials
2. Switch to another app (put app in background)
3. Wait a few seconds
4. Return to app (bring to foreground)

**Expected Results:**
- ✅ App checks session validity when returning to foreground
- ✅ If session is valid, user remains logged in
- ✅ If session is invalid, refresh is attempted
- ✅ If refresh fails, user is logged out and redirected to login

**Verification Points:**
- `handleAppStateChange` listener is set up correctly
- `checkSessionValidity` is called on active state
- AppState subscription is cleaned up on unmount

---

## iOS-Specific Testing

### Setup

```bash
cd mobile
npm install
npx expo start --ios
```

### iOS Simulator Requirements
- macOS with Xcode installed
- iOS Simulator running (preferably iOS 17+)
- React Native Debugger or Safari Web Inspector for debugging

### iOS-Specific Test Points
- ✅ Keyboard behavior (padding vs height)
- ✅ Status bar appearance
- ✅ Safe area handling
- ✅ Navigation gestures
- ✅ Alert dialogs appearance

---

## Android-Specific Testing

### Setup

```bash
cd mobile
npm install
npx expo start --android
```

### Android Emulator Requirements
- Android Studio installed
- Android Emulator running (preferably Android 13+)
- React Native Debugger or Chrome DevTools for debugging

### Android-Specific Test Points
- ✅ Keyboard behavior (height)
- ✅ Status bar appearance
- ✅ Back button handling
- ✅ Alert dialogs appearance
- ✅ Hardware back button on auth screens

---

## Automated Testing Script

For developers with access to simulators, use this script to prepare test environment:

### iOS Test Script

```bash
#!/bin/bash
# iOS Authentication Flow Test Script

echo "=== iOS Authentication Flow Testing ==="
echo ""

# Start iOS simulator
echo "1. Starting iOS simulator..."
open -a Simulator

# Wait for simulator to boot
sleep 5

# Start Expo dev server
echo "2. Starting Expo development server..."
cd mobile
npx expo start --ios &

# Wait for app to build and launch
echo "3. Waiting for app to launch (this may take a minute)..."
sleep 30

echo ""
echo "=== Manual Test Checklist ==="
echo "[ ] Test Case 1: Fresh install shows LandingScreen"
echo "[ ] Test Case 2: Valid credentials → redirects to home"
echo "[ ] Test Case 3: Invalid credentials → error alert shown"
echo "[ ] Test Case 4: Empty fields → validation error"
echo "[ ] Test Case 5: useAuth().isAuthenticated = true after login"
echo "[ ] Test Case 6: Sign out → redirects to auth screen"
echo "[ ] Test Case 7: AsyncStorage cleared after sign out"
echo "[ ] Test Case 8: Session persists across app restarts"
echo "[ ] Test Case 9: Session refresh works (long-running test)"
echo "[ ] Test Case 10: App state change triggers session check"
echo ""
echo "Use React Native Debugger to inspect AsyncStorage and state."
```

### Android Test Script

```bash
#!/bin/bash
# Android Authentication Flow Test Script

echo "=== Android Authentication Flow Testing ==="
echo ""

# List available emulators
echo "Available Android emulators:"
emulator -list-avds

# Start first emulator (adjust name as needed)
echo "1. Starting Android emulator..."
emulator -avd Pixel_6_API_34 &

# Wait for emulator to boot
echo "2. Waiting for emulator to boot..."
sleep 20

# Start Expo dev server
echo "3. Starting Expo development server..."
cd mobile
npx expo start --android &

# Wait for app to build and launch
echo "4. Waiting for app to launch (this may take a minute)..."
sleep 30

echo ""
echo "=== Manual Test Checklist ==="
echo "[ ] Test Case 1: Fresh install shows LandingScreen"
echo "[ ] Test Case 2: Valid credentials → redirects to home"
echo "[ ] Test Case 3: Invalid credentials → error alert shown"
echo "[ ] Test Case 4: Empty fields → validation error"
echo "[ ] Test Case 5: useAuth().isAuthenticated = true after login"
echo "[ ] Test Case 6: Sign out → redirects to auth screen"
echo "[ ] Test Case 7: AsyncStorage cleared after sign out"
echo "[ ] Test Case 8: Session persists across app restarts"
echo "[ ] Test Case 9: Session refresh works (long-running test)"
echo "[ ] Test Case 10: App state change triggers session check"
echo ""
echo "Use React Native Debugger to inspect AsyncStorage and state."
```

---

## Debugging Tools

### AsyncStorage Inspector

Add to any screen for debugging:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Function to inspect all AsyncStorage keys
const inspectStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  console.log('AsyncStorage Keys:', keys);

  for (const key of keys) {
    const value = await AsyncStorage.getItem(key);
    console.log(`${key}:`, value);
  }
};

// Call in useEffect or button press
useEffect(() => {
  inspectStorage();
}, []);
```

### Auth State Inspector

Add to any screen:

```typescript
import { useAuth } from '../contexts/AuthContext';

const { isAuthenticated, isLoading, session, account } = useAuth();

console.log('Auth State:', {
  isAuthenticated,
  isLoading,
  sessionExists: session !== null,
  accountDid: account?.did,
  accountHandle: account?.handle,
});
```

---

## Known Limitations

1. **Long-running tests**: Session refresh (50 min) and validity checks (5 min) are difficult to test manually
2. **Token expiration**: Cannot easily simulate expired tokens without modifying server responses
3. **Network failures**: Requires manual network disruption to test error handling
4. **OAuth flow**: Requires actual Bluesky OAuth setup and testing in browser

---

## Success Criteria

All test cases must pass on BOTH iOS and Android simulators:

- ✅ Fresh install displays landing screen correctly
- ✅ Valid credentials result in successful authentication and redirect
- ✅ Invalid credentials show error alert and remain on login screen
- ✅ useAuth() hook correctly returns authentication state
- ✅ Sign out successfully logs out and redirects to auth screen
- ✅ AsyncStorage is properly cleared of current session on sign out
- ✅ Session persists across app restarts
- ✅ No console errors or warnings during auth flow
- ✅ UI is responsive and user-friendly on both platforms

---

## Test Results Template

```markdown
## Test Execution Results

**Tester:** [Name]
**Date:** [Date]
**Platform:** iOS / Android
**Simulator/Emulator:** [Device name and OS version]
**App Version:** 0.7.0

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Fresh Install | ⬜ Pass / ⬜ Fail | |
| TC2: Valid Login | ⬜ Pass / ⬜ Fail | |
| TC3: Invalid Login | ⬜ Pass / ⬜ Fail | |
| TC4: Empty Fields | ⬜ Pass / ⬜ Fail | |
| TC5: isAuthenticated | ⬜ Pass / ⬜ Fail | |
| TC6: Sign Out Redirect | ⬜ Pass / ⬜ Fail | |
| TC7: Storage Cleanup | ⬜ Pass / ⬜ Fail | |
| TC8: Session Persistence | ⬜ Pass / ⬜ Fail | |
| TC9: Session Refresh | ⬜ Pass / ⬜ Fail / ⬜ Skipped | |
| TC10: App State Change | ⬜ Pass / ⬜ Fail | |

**Overall Result:** ⬜ Pass / ⬜ Fail

**Issues Found:**
1. [List any issues discovered]

**Screenshots:**
[Attach relevant screenshots if available]
```

---

## Next Steps

1. **Manual Testing**: Run all test cases on iOS and Android simulators
2. **Report Results**: Fill out the test results template
3. **Fix Issues**: Address any failures or bugs discovered
4. **Automated Tests**: Consider adding Jest/Detox tests for critical flows
5. **Production Testing**: Test on real devices before release

---

## References

- **Migration Commit:** f440bd1 - "feat: migrate mobile app from bare React Native to Expo SDK 54 + Expo Router"
- **AuthGate Implementation:** mobile/app/_layout.tsx
- **Auth Context:** mobile/src/contexts/AuthContext.tsx
- **Auth Service:** mobile/src/services/auth/auth-service.ts
- **Landing Screen:** mobile/src/screens/auth/LandingScreen.tsx
- **Expo Router Docs:** https://docs.expo.dev/router/introduction/
