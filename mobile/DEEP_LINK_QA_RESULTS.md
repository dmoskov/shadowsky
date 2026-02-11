# Deep Link QA Results

**Task**: [P2] QA: Test deep linking with shadowsky:// and bsky:// URL schemes
**Asana Task**: https://app.asana.com/1/19421316985/project/1211710875848660/task/1213223832437732
**Date**: 2026-02-11
**Status**: Code Review Complete - Manual Testing Required

## Executive Summary

A comprehensive code review of the mobile app's deep linking implementation has been completed. The configuration is **properly set up** and follows Expo Router best practices. All required URL schemes, routes, and configurations are in place.

However, **manual testing on physical devices/simulators is required** to verify runtime behavior, as this environment does not have access to iOS/Android development tools.

## Configuration Status

### ✅ PASS: URL Schemes Registration
**Location**: `mobile/app.config.ts:10`

```typescript
scheme: ["shadowsky", "bsky"]
```

- Both `shadowsky://` and `bsky://` custom URL schemes are registered
- Follows Expo configuration standards
- Will be automatically included in iOS Info.plist and Android AndroidManifest.xml

### ✅ PASS: iOS Universal Links
**Location**: `mobile/app.config.ts:21-26`

```typescript
associatedDomains: [
  "applinks:shadowsky.io",
  "applinks:main.shadowsky.io",
  "applinks:bsky.app",
  "applinks:staging.bsky.app",
]
```

- All four domains properly configured
- Follows Apple's associated domains format
- **Note**: Requires AASA files to be hosted on these domains for production use

### ✅ PASS: Android App Links
**Location**: `mobile/app.config.ts:34-46`

```typescript
intentFilters: [
  {
    action: "VIEW",
    autoVerify: true,
    data: [
      { scheme: "https", host: "shadowsky.io" },
      { scheme: "https", host: "main.shadowsky.io" },
      { scheme: "https", host: "bsky.app" },
      { scheme: "https", host: "staging.bsky.app" },
    ],
    category: ["BROWSABLE", "DEFAULT"],
  },
]
```

- Intent filters properly configured with autoVerify
- Matches iOS universal links configuration
- **Note**: Requires Digital Asset Links JSON at `/.well-known/assetlinks.json` on domains

### ✅ PASS: OAuth Callback Route
**Location**: `mobile/app/(auth)/oauth-callback.tsx`

```typescript
export default function OAuthCallbackRoute() {
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  return <OAuthCallbackScreen code={code} state={state} error={error} />;
}
```

- Route properly extracts OAuth parameters
- Handles both success (code/state) and error cases
- Will be accessible via `shadowsky://oauth-callback`

### ✅ PASS: Expo Router File Structure
**Location**: `mobile/app/` directory

Expo Router automatically generates deep link routes from the file structure:

```
Main Screens:
- shadowsky://home → app/(app)/(tabs)/(home)/index.tsx
- shadowsky://search → app/(app)/(tabs)/(search)/index.tsx
- shadowsky://notifications → app/(app)/(tabs)/(notifications)/index.tsx
- shadowsky://profile → app/(app)/(tabs)/(profile)/index.tsx
- shadowsky://compose → app/(app)/compose.tsx
- shadowsky://settings → app/(app)/settings.tsx
- shadowsky://lists → app/(app)/lists.tsx

Dynamic Routes:
- shadowsky://home/profile/[handle] → Profile screens
- shadowsky://home/thread/[postId] → Thread screens
- shadowsky://home/list/[listId] → List timeline screens
- (Similar routes exist under search, notifications, and profile tabs)

Auth Routes:
- shadowsky://auth → app/(auth)/index.tsx
- shadowsky://oauth-callback → app/(auth)/oauth-callback.tsx

Error Handling:
- Invalid routes → app/+not-found.tsx
```

All routes are properly structured following Expo Router v5 conventions.

### ⚠️ MINOR: Deep Link Utility Functions
**Location**: `mobile/src/utils/deepLinks.ts`

The utility functions are well-implemented but currently build `bsky://` URLs:

```typescript
export function buildDeepLink(path: string, params?: Record<string, string>): string {
  let url = `bsky://${path}`;  // Uses bsky:// scheme
  // ...
}
```

**Observation**: Functions build `bsky://` URLs while `shadowsky://` is the primary scheme.

**Impact**: Low - Both schemes are registered and will work identically. This is not a bug.

**Recommendation**: Consider making the scheme configurable or using `shadowsky://` as primary for brand consistency.

### ✅ PASS: Authentication Gate
**Location**: `mobile/app/_layout.tsx`

```typescript
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(app)/(tabs)/(home)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <Slot />;
}
```

- Properly redirects unauthenticated users to auth screens
- Protects app routes behind authentication
- Deep links will respect authentication state

## Test Coverage Analysis

### Automated Tests
**Status**: ❌ None found

No automated E2E tests for deep linking were found in the codebase.

**Recommendation**: Add automated tests using Detox or Maestro for:
- URL scheme registration verification
- Deep link navigation flows
- OAuth callback handling
- Cold/warm start behavior

### Manual Test Cases
**Status**: ✅ Documented

Created comprehensive test documentation in `mobile/DEEP_LINK_TESTING.md` covering:
- 40+ test cases across all routes
- Both `shadowsky://` and `bsky://` schemes
- OAuth callback scenarios
- Universal links / App links
- Cold start, warm start, and hot navigation
- Error handling and invalid routes

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|----------|--------|-------|
| Both URL schemes (shadowsky://, bsky://) are handled | ✅ PASS | Configured in app.config.ts |
| Profile and thread deep links navigate to correct screens | ⏳ NEEDS TESTING | Routes exist, runtime testing required |
| OAuth callback deep link works | ⏳ NEEDS TESTING | Route configured correctly, runtime testing required |
| Cold start and warm start both handle links | ⏳ NEEDS TESTING | Expo Router should handle this, verification needed |
| Universal links from bsky.app and shadowsky.io domains work | ⚠️ PARTIAL | Configured in app, requires domain setup (AASA/assetlinks) |

## Findings Summary

### Configuration: ✅ Complete
All required configuration is in place:
- URL schemes registered
- Routes properly structured
- OAuth callback implemented
- Universal/App links configured
- Authentication gate in place

### Implementation: ✅ Correct
The implementation follows Expo Router v5 best practices:
- File-based routing structure is correct
- Dynamic routes use proper syntax
- Layout groups properly configured
- No manual linking config needed (Expo Router handles automatically)

### Testing: ⏳ Pending
Manual testing on devices/simulators is required to verify:
- Runtime deep link handling
- Navigation behavior
- OAuth flow completion
- Cold/warm/hot start scenarios
- Universal links domain verification

## Recommendations

### High Priority
1. **Manual Testing**: Execute test cases from DEEP_LINK_TESTING.md on iOS and Android
2. **OAuth Flow**: Test complete OAuth flow with real provider
3. **Domain Setup**: Host AASA and Digital Asset Links files for universal/app links

### Medium Priority
4. **Automated Tests**: Implement E2E tests for deep linking with Detox or Maestro
5. **Analytics**: Add deep link tracking to monitor usage patterns
6. **Error Handling**: Verify 404 behavior for invalid routes

### Low Priority
7. **Deep Link Utils**: Consider updating to use `shadowsky://` or make scheme configurable
8. **Documentation**: Add deep linking section to main README.md
9. **Monitoring**: Set up crash reporting for deep link navigation failures

## Dependencies for Full Verification

To complete manual testing, the following are required:
- iOS device or simulator with app installed
- Android device or emulator with app installed
- Expo CLI tools (`npx uri-scheme`)
- Working OAuth provider configuration
- (Optional) Deployed AASA and assetlinks files on domains

## Conclusion

**Code Review Result**: ✅ **PASS**

The deep linking implementation is **correctly configured** and follows industry best practices. All required routes, schemes, and configurations are in place. The app is ready for manual testing.

**Next Step**: Execute manual test cases on physical devices/simulators to verify runtime behavior and complete acceptance criteria.

---

**Reviewed By**: Claude (Automated Code Review)
**Review Date**: 2026-02-11
**Review Scope**: Configuration and code structure analysis
**Test Environment**: AWS ECS (no iOS/Android tools available)
