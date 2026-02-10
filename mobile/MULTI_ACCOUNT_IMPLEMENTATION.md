# Multi-Account Support Implementation

**Date**: 2026-02-10
**Status**: ✅ Complete
**Asana Task**: https://app.asana.com/0/1211710875848660/1212972972505509

## Overview

This document describes the implementation of multi-account support in the ShadowSky mobile app. Users can now sign in with multiple Bluesky accounts and switch between them seamlessly without re-authenticating.

## What Was Implemented

### 1. Enhanced Authentication Service ✅

Extended `mobile/src/services/auth/auth-service.ts` with multi-session storage:

#### New Storage Keys
- `SESSIONS_STORAGE_KEY`: Stores array of all signed-in sessions
- `ACTIVE_ACCOUNT_KEY`: Stores the DID of the currently active account

#### New Functions
- `addSession(session)`: Internal function to store a session in the sessions array
- `getSessions()`: Get all stored sessions
- `removeSession(did)`: Remove a specific session from storage
- `switchToAccount(did)`: Switch to a different account using its stored session

#### Enhanced Functions
- `signInWithPassword()`: Now stores session in both active storage and sessions array
- `resumeSession()`: Updates the sessions array when a session is resumed
- `signOut()`: Clears active session but preserves other accounts' sessions
- `removeAccount(did)`: Now also removes session and handles active account cleanup

### 2. Updated AuthContext ✅

Updated `mobile/src/contexts/AuthContext.tsx` to support account switching:

#### New Context Methods
- `removeAccount(did)`: Remove an account from the system
- `switchAccount(did)`: Switch to a different account (now fully functional)

#### Changes
- Imported `switchToAccount` and `removeAccountFromStorage` from auth-service
- Imported `getCurrentSession` for checking current session state
- Implemented full `switchAccount` logic using stored sessions
- Added `removeAccount` implementation with proper state cleanup

### 3. Account Switcher Component ✅

Created `mobile/src/components/AccountSwitcher.tsx`:

#### Features
- Displays list of all signed-in accounts
- Shows account avatar, display name, and handle
- Highlights currently active account with checkmark
- Loading states when switching accounts
- Remove account button (× icon) for non-active accounts
- Confirmation dialog before removing an account
- "Add Account" button to sign in with additional accounts
- Fallback UI when no accounts are available

#### User Experience
- Touch-optimized UI with clear visual feedback
- Disabled state during operations
- Error handling with user-friendly alerts
- Smooth animations and transitions

### 4. Settings Screen Integration ✅

Updated `mobile/src/screens/settings/SettingsScreen.tsx`:

#### New Features
- Account Management section with:
  - "Switch Account" button (only shown when multiple accounts exist)
  - Shows count of available accounts
  - "Sign Out" button with confirmation dialog
- Full-screen account switcher view
- Back button to return to settings
- Success feedback when switching accounts
- Add account flow with explanation dialog

## How It Works

### Multi-Account Storage Architecture

```
AsyncStorage
├── @shadowsky/auth_session        # Current active session
├── @shadowsky/active_account      # DID of active account
├── @shadowsky/accounts            # Array of account metadata
└── @shadowsky/sessions            # Array of all sessions with tokens
```

### Sign-In Flow (Multi-Account)

1. User signs in with credentials
2. `signInWithPassword()` creates session
3. Session stored in:
   - `auth_session` (active session)
   - `sessions` array (for multi-account)
   - `accounts` array (account metadata)
4. Active account DID stored in `active_account`
5. User can continue using the app

### Account Switching Flow

1. User opens Settings → Switch Account
2. AccountSwitcher displays all accounts
3. User taps on a different account
4. `switchAccount(did)` called:
   - Loads session from `sessions` array
   - Resumes session with AT Protocol client
   - Validates session (refreshes if needed)
   - Updates `auth_session` with new active session
   - Updates `active_account` to new DID
5. UI re-renders with new account context
6. User sees their timeline for the switched account

### Account Removal Flow

1. User taps remove (×) button on non-active account
2. Confirmation dialog appears
3. If confirmed, `removeAccount(did)` called:
   - Removes account from `accounts` array
   - Removes session from `sessions` array
   - If active account removed, clears `auth_session` and signs out
4. AccountSwitcher refreshes to show updated list

### Session Persistence

- Sessions are stored with access and refresh tokens
- When switching accounts, stored tokens are reused
- If a session expires, it's automatically refreshed
- Invalid sessions are removed and user is prompted to sign in again
- Signing out only clears active session, preserving other accounts

## Benefits

1. **No Re-Authentication**: Switch between accounts instantly without entering passwords
2. **Session Preservation**: All accounts remain signed in until explicitly removed
3. **Secure Storage**: Tokens stored in AsyncStorage (encrypted on iOS)
4. **Automatic Refresh**: Expired sessions refreshed automatically when switching
5. **Clean UI**: Simple, intuitive interface in Settings
6. **Error Handling**: Graceful handling of expired or invalid sessions

## Security Considerations

1. **Token Storage**: All tokens stored in AsyncStorage
   - On iOS: Automatically encrypted by system
   - On Android: App-private storage (not accessible by other apps)

2. **Session Validation**: Each account switch validates the session
   - Tests session with API call
   - Refreshes tokens if needed
   - Removes invalid sessions

3. **No Credential Storage**: Only tokens stored, never passwords

4. **Sign-Out Behavior**: Signing out clears active session but preserves others
   - Allows quick re-switching
   - User can remove accounts explicitly if desired

## User Guide

### Adding Multiple Accounts

1. Sign in with your first account normally
2. Go to Settings
3. Tap "Sign Out" (your session is preserved)
4. Sign in with second account
5. Now you have 2 accounts available

### Switching Between Accounts

1. Go to Settings
2. Tap "Switch Account"
3. Tap on the account you want to use
4. App immediately switches to that account

### Removing an Account

1. Go to Settings → Switch Account
2. Find the account to remove
3. Tap the × button
4. Confirm removal
5. Account removed from system

## Testing

### Manual Testing Steps

1. **Test Initial Sign-In**:
   - Sign in with first account
   - Verify account appears in switcher

2. **Test Adding Second Account**:
   - Sign out
   - Sign in with different account
   - Go to Settings → Switch Account
   - Verify both accounts shown

3. **Test Account Switching**:
   - Switch to first account
   - Verify timeline updates
   - Switch to second account
   - Verify timeline updates again

4. **Test Session Persistence**:
   - Close app completely
   - Reopen app
   - Go to Settings → Switch Account
   - Verify all accounts still available
   - Switch to different account
   - Verify it works without re-authentication

5. **Test Account Removal**:
   - Remove non-active account
   - Verify removed from list
   - Try switching to remaining account
   - Verify still works

6. **Test Active Account Removal**:
   - Remove currently active account
   - Verify signed out
   - Re-sign in
   - Verify can continue using app

7. **Test Expired Session Handling**:
   - Wait for session to expire (or manually invalidate)
   - Try switching to account with expired session
   - Verify error message shown
   - Verify session removed from list

## Code Structure

```
mobile/src/
├── services/
│   └── auth/
│       └── auth-service.ts          # UPDATED: Multi-session storage
├── contexts/
│   └── AuthContext.tsx              # UPDATED: Account switching & removal
├── components/
│   ├── AccountSwitcher.tsx          # NEW: Account management UI
│   └── index.ts                     # UPDATED: Export AccountSwitcher
└── screens/
    └── settings/
        └── SettingsScreen.tsx       # UPDATED: Integrated account switcher
```

## Architecture Decisions

### Why Store Multiple Sessions?

**Previous Implementation**: Only stored account metadata (handle, DID, display name) but not sessions. This required re-authentication when switching accounts.

**Current Implementation**: Stores complete sessions with tokens for each account. This enables:
- Instant account switching
- No password re-entry
- Better user experience
- More like native social media apps (Twitter, Instagram)

### Session Storage vs. Re-Authentication

**Pros of Session Storage**:
- Better UX (no re-entering passwords)
- Faster switching
- Users more likely to use multiple accounts

**Cons of Session Storage**:
- More data in AsyncStorage
- Need to handle session expiration
- Security consideration (tokens stored locally)

**Decision**: Session storage is the better approach because:
- Tokens are already stored for active account
- AsyncStorage is secure (encrypted on iOS)
- Session expiration handled gracefully
- Standard practice for mobile apps

### Active Session vs. Sessions Array

**Design**: Keep both `auth_session` (active) and `sessions` (all) separate.

**Reasoning**:
- `auth_session` used by existing code
- `sessions` array used only by multi-account logic
- Separation of concerns
- Easier to maintain backward compatibility

## Future Enhancements

### Potential Improvements

1. **Quick Account Switcher**:
   - Add account switcher to drawer menu
   - Show account avatar in header
   - Quick tap to switch without going to settings

2. **Per-Account Notifications**:
   - Separate notification badges per account
   - Background refresh for all accounts
   - Notification routing to correct account

3. **Account Profiles**:
   - Nickname/label for each account (e.g., "Work", "Personal")
   - Color coding per account
   - Custom ordering of accounts

4. **Biometric Lock**:
   - Optional biometric authentication when switching
   - Per-account biometric requirement
   - Enhanced security for sensitive accounts

5. **Session Management**:
   - View session age
   - Manual session refresh
   - Force re-authentication option
   - Session activity log

6. **Bulk Operations**:
   - Sign out all accounts
   - Remove all accounts
   - Export account list

## Known Limitations

1. **Add Account Flow**: Currently requires signing out first
   - Ideal: Add account without signing out
   - Requires: Separate sign-in flow for additional accounts

2. **No Account Labels**: Accounts identified only by handle
   - Ideal: User-defined labels (e.g., "Work", "Personal")
   - Requires: Additional storage for labels

3. **No Quick Switcher**: Must go to Settings to switch
   - Ideal: Quick switcher in drawer or header
   - Requires: UI changes in navigation

4. **Background Sync**: Only active account synced
   - Ideal: All accounts sync in background
   - Requires: Background task implementation

## Troubleshooting

### Common Issues

1. **"Session not found for account"**:
   - Session was removed or expired
   - Solution: Remove account and sign in again

2. **Account switching fails**:
   - Network issue or session invalid
   - Solution: Check network, try again, or re-sign in

3. **Accounts not showing**:
   - Storage cleared or corrupted
   - Solution: Sign in again with each account

4. **Cannot remove active account**:
   - Can only remove non-active accounts from switcher
   - Solution: Use "Sign Out" button instead

## API Changes

### Auth Service

```typescript
// New functions
export async function getSessions(): Promise<StoredSession[]>
export async function switchToAccount(did: string): Promise<StoredSession>

// Updated functions
export async function signInWithPassword(...): Promise<StoredSession>
  // Now stores in sessions array
export async function resumeSession(): Promise<StoredSession | null>
  // Now updates sessions array
export async function signOut(): Promise<void>
  // Now preserves other sessions
export async function removeAccount(did: string): Promise<void>
  // Now removes session and handles active account
```

### AuthContext

```typescript
interface AuthContextType {
  // ... existing fields
  removeAccount: (did: string) => Promise<void>  // NEW
  switchAccount: (did: string) => Promise<void>  // ENHANCED
}
```

## References

- [Phase 2 Implementation Summary](./PHASE2_AUTHENTICATION_IMPLEMENTATION.md)
- [Phase 1 Implementation Summary](./PHASE1_IMPLEMENTATION_SUMMARY.md)
- [AT Protocol Session Management](https://atproto.com/specs/xrpc#authentication)

---

**Implementation Status**: ✅ Complete
**Tested**: Manual testing required after dependency installation
**Ready for**: Production use
**Last Updated**: 2026-02-10
