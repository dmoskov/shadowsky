# Security Audit: AuthContext.tsx
**Date:** 2025-12-16
**Severity:** HIGH
**Signal:** Churn Hotspot - 16 changes in 14 days
**Auditor:** Security Agent
**Asana Task:** https://app.asana.com/0/1211710875848660/1212467597437955

## Executive Summary

This security audit analyzed `src/contexts/AuthContext.tsx` (626 lines), a critical authentication component that has undergone significant churn (16 changes in 14 days). The audit focused on authentication flow security, token handling, session management, and architectural stability.

**Overall Assessment:** MODERATE RISK with architectural concerns

### Key Findings
- ✅ **No Critical Security Vulnerabilities Detected**
- ⚠️ **7 Security Concerns Requiring Attention**
- 🔴 **High Code Complexity (626 lines) Contributing to Churn**
- ⚠️ **Dual Authentication Paths Increase Attack Surface**

---

## Security Findings

### 1. Token & Credential Storage ✅ SECURE

**Status:** Acceptable with recommendations

**Current Implementation:**
- Tokens stored in both localStorage and cookies
- SameSite=Strict flag prevents CSRF attacks
- Secure flag enforced for HTTPS connections
- OAuth tokens handled by @atproto/oauth-client-browser (IndexedDB)
- App password tokens in localStorage/cookies

**Security Controls:**
- `setCookie()` enforces `SameSite=Strict` (src/utils/cookies.ts:66)
- `Secure` flag enabled for HTTPS (src/utils/cookies.ts:72)
- Tokens properly encoded/decoded (src/utils/cookies.ts:66,86)

**Recommendations:**
```typescript
// LOW PRIORITY: Consider encryption for localStorage tokens
// Current: Plain JSON storage
localStorage.setItem(this.sessionKey, sessionData);

// Recommended: Encrypt sensitive session data
import { encryptSessionData } from './crypto-utils';
localStorage.setItem(this.sessionKey, encryptSessionData(sessionData));
```

**Risk Level:** LOW (current implementation is acceptable)

---

### 2. Session Management ⚠️ NEEDS IMPROVEMENT

**Status:** Functional but has edge cases

**Issues Identified:**

#### Issue 2A: Race Condition in OAuth Session Validation
**Location:** src/contexts/AuthContext.tsx:186-240

```typescript
// VULNERABILITY: Race condition during session validation
try {
  const { data: profile } = await agent.getProfile({
    actor: oauthState.did,
  });
  handle = profile.handle;
} catch (err) {
  // If network error occurs, continues with empty handle
  // Services initialized before handle is available
}
```

**Impact:** Services may initialize without proper user context
**Severity:** MEDIUM
**Recommendation:** Retry logic for critical profile fetching

#### Issue 2B: Silent Session Failures
**Location:** src/contexts/AuthContext.tsx:342-378

```typescript
} catch (error) {
  const status = (error as Error & { status?: number })?.status;
  if (status === 400) {
    debug.log("Session expired or invalid, clearing stored session");
    atProtoClient.logout();
  }
  // ISSUE: No user notification on silent logout
}
```

**Impact:** User session cleared without notification
**Severity:** LOW
**Recommendation:** Emit event or show toast notification

---

### 3. Authentication Flow Security ✅ MOSTLY SECURE

**Status:** Generally secure with minor concerns

**Positive Findings:**
- OAuth uses industry-standard @atproto/oauth-client-browser
- PKCE flow implemented (implicit in OAuth library)
- State parameter for CSRF protection (handled by OAuth library)
- Proper error handling for authentication failures

**Issue 3A: Password Exposure in Error Logs (MITIGATED)**
**Location:** src/contexts/AuthContext.tsx:451-455

```typescript
} catch (error) {
  debug.error("Login error:", error);
  // GOOD: Password not logged, only error object
  throw error;
}
```

**Status:** ✅ No password leakage detected

**Issue 3B: PDS URL Validation Missing**
**Location:** src/contexts/AuthContext.tsx:405-408

```typescript
if (pdsUrl && pdsUrl !== "https://bsky.social") {
  // ISSUE: No URL validation - could point to malicious server
  atProtoClient.updateService(pdsUrl);
}
```

**Impact:** Potential phishing or credential theft if malicious PDS provided
**Severity:** HIGH
**Recommendation:**
```typescript
// Add URL validation before switching PDS
function isValidPDSUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
           (parsed.hostname.endsWith('.bsky.app') ||
            parsed.hostname.endsWith('.bsky.social') ||
            parsed.hostname === 'bsky.social');
  } catch {
    return false;
  }
}

if (pdsUrl && pdsUrl !== "https://bsky.social") {
  if (!isValidPDSUrl(pdsUrl)) {
    throw new Error("Invalid PDS URL. Only official Bluesky servers are supported.");
  }
  atProtoClient.updateService(pdsUrl);
}
```

---

### 4. Multi-Account Security ⚠️ CONCERNS

**Status:** Secure but needs hardening

**Issue 4A: Account Data Stored Unencrypted**
**Location:** src/services/account-manager.ts:189-197

```typescript
private static saveAccounts(accounts: StoredAccount[]): void {
  const data = JSON.stringify(accounts); // Plain JSON
  setCookie(this.STORAGE_KEY, data, {...});
  localStorage.setItem(this.STORAGE_KEY, data);
}
```

**Impact:** Full session tokens for all accounts visible in localStorage
**Severity:** MEDIUM
**Data Exposed:**
- DID, handle, email
- accessJwt, refreshJwt (full JWT tokens)
- Avatar URLs, display names

**Recommendation:** Encrypt multi-account storage

#### Issue 4B: OAuth Account Switching Vulnerability
**Location:** src/contexts/AuthContext.tsx:550-555

```typescript
// OAuth accounts need re-authentication (can't restore session)
if (account.authMethod === "oauth") {
  // Redirect to add-account page for re-auth
  window.location.href = "/add-account";
  return false;
}
```

**Concern:** OAuth sessions stored but cannot be resumed
**Impact:** Poor UX and potential security confusion
**Recommendation:** Either don't store OAuth accounts or implement proper OAuth session restoration

---

### 5. Error Handling & Information Disclosure ✅ SECURE

**Status:** Good practices observed

**Positive Findings:**
- Sensitive errors not exposed to users
- Debug logging gated behind `debug.error()` utility
- Password/token not logged in error messages
- Proper error type discrimination (400, 401, 500, network)

**Location Examples:**
```typescript
// GOOD: Generic error, no sensitive data
debug.error("Failed to initialize auth:", error);

// GOOD: Status code checked, specific handling
if (status === 400) {
  debug.log("Session expired or invalid, clearing stored session");
}
```

---

### 6. Timeout & Denial of Service Protection ✅ IMPLEMENTED

**Status:** Adequate protection

**Finding:** Safety timeout prevents infinite loading
**Location:** src/contexts/AuthContext.tsx:149-157

```typescript
const safetyTimeout = setTimeout(() => {
  setIsLoading((current) => {
    if (current) {
      debug.error("Auth initialization timeout - forcing loading to false");
    }
    return false;
  });
}, 10000); // 10 second timeout
```

**Assessment:** Good defensive programming

---

### 7. Session Hijacking & CSRF Protection ✅ STRONG

**Status:** Well protected

**CSRF Protection:**
- SameSite=Strict on all session cookies (src/utils/cookies.ts:66)
- No cross-origin cookie sharing
- OAuth state parameter for CSRF (handled by library)

**Session Hijacking Mitigations:**
- Secure flag on HTTPS (src/utils/cookies.ts:72)
- Short-lived access tokens (standard JWT practice)
- Refresh token rotation (handled by BskyAgent)

**Missing (OPTIONAL):**
- HttpOnly flag (requires server-side Set-Cookie)
- Device fingerprinting
- IP address validation

---

## Root Cause Analysis: High Churn Rate (16 changes in 14 days)

### Primary Causes

#### 1. **Excessive Complexity** 🔴 CRITICAL
- **Line Count:** 626 lines in a single file
- **Multiple Responsibilities:** OAuth, app-password, multi-account, session management, service initialization
- **Cognitive Load:** High - difficult to modify without side effects

#### 2. **Dual Authentication Paths** ⚠️
- OAuth flow (lines 165-296)
- App-password flow (lines 298-380)
- Duplicated logic for:
  - Profile fetching
  - Service initialization
  - Account storage
  - Error handling

#### 3. **Tight Coupling** ⚠️
Services directly initialized in AuthContext:
- bookmarkService
- dmService
- appPreferencesService
- columnService
- draftService
- AccountManager
- routePrefetchService

**Impact:** Changes to any service require AuthContext modifications

#### 4. **Complex State Management** ⚠️
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [session, setSession] = useState<Session | null>(null);
const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
const [oauthAgent, setOauthAgent] = useState<BskyAgent | null>(null);
const [isOAuthAvailable, setIsOAuthAvailable] = useState(false);
```

6 interdependent state variables create complex state transitions

#### 5. **Large useEffect with Multiple Paths** ⚠️
- 245 lines (lines 148-394)
- Multiple async operations
- Nested error handling
- Retry logic
- Fallback flows

---

## Architecture Security Assessment

### Attack Surface Analysis

**Current Attack Vectors:**

1. **Credential Theft:**
   - ❌ Unvalidated PDS URLs (Issue 3B)
   - ✅ Tokens properly secured
   - ⚠️ Multi-account storage unencrypted

2. **Session Hijacking:**
   - ✅ SameSite=Strict protection
   - ✅ Secure flag on HTTPS
   - ⚠️ No HttpOnly flag (client-side limitation)

3. **Cross-Site Request Forgery (CSRF):**
   - ✅ SameSite=Strict cookies
   - ✅ OAuth state parameter
   - ✅ No GET-based auth changes

4. **Denial of Service:**
   - ✅ Timeout protection
   - ✅ Retry limits (maxRetries = 3)
   - ✅ Exponential backoff

5. **Information Disclosure:**
   - ✅ No sensitive data in errors
   - ✅ Debug logging properly gated
   - ⚠️ Tokens visible in localStorage (standard practice but not ideal)

### Complexity-Induced Security Risks

High code complexity increases risk of:
- **Logic Bugs:** Complex auth flows → edge cases → bypasses
- **Race Conditions:** Multiple async operations → timing attacks
- **State Confusion:** 6 state variables → inconsistent auth state
- **Maintenance Errors:** Frequent changes → introduced vulnerabilities

---

## Recommendations

### PRIORITY 1: IMMEDIATE (Security)

#### R1.1: Validate PDS URLs 🔴 HIGH
**File:** src/contexts/AuthContext.tsx:405
**Impact:** Prevent credential theft via malicious PDS

```typescript
// Add before line 405
function validatePDSUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;

    // Allowlist official Bluesky domains
    const allowedDomains = [
      'bsky.social',
      'bsky.app',
      'blueskyweb.xyz'
    ];

    return allowedDomains.some(domain =>
      parsed.hostname === domain ||
      parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

if (pdsUrl && pdsUrl !== "https://bsky.social") {
  if (!validatePDSUrl(pdsUrl)) {
    throw new Error("Invalid PDS URL. Only official Bluesky servers are supported.");
  }
  atProtoClient.updateService(pdsUrl);
}
```

#### R1.2: Add User Notification for Silent Logouts 🟡 MEDIUM
**File:** src/contexts/AuthContext.tsx:348
**Impact:** Security transparency

```typescript
if (status === 400) {
  debug.log("Session expired or invalid, clearing stored session");
  atProtoClient.logout();
  // ADD: Notify user
  toast.info("Your session has expired. Please sign in again.");
}
```

### PRIORITY 2: ARCHITECTURAL (Reduce Churn)

#### R2.1: Extract Authentication Strategies 🔴 HIGH
**Goal:** Separate OAuth and app-password flows

**Proposed Structure:**
```
src/contexts/auth/
  ├── AuthContext.tsx          (200 lines - orchestration only)
  ├── strategies/
  │   ├── OAuthStrategy.ts     (150 lines)
  │   ├── AppPasswordStrategy.ts (100 lines)
  │   └── AuthStrategy.ts      (interface)
  ├── hooks/
  │   ├── useAuthInit.ts
  │   ├── useSessionManagement.ts
  │   └── useAccountSwitching.ts
  └── services/
      └── ServiceInitializer.ts
```

**Benefits:**
- Reduces main file to ~200 lines
- Separates concerns
- Easier testing
- Lower churn rate (changes isolated to strategy files)

#### R2.2: Implement Service Initialization Manager 🟡 MEDIUM
**Goal:** Decouple service initialization from auth logic

```typescript
// src/services/ServiceInitializer.ts
export class ServiceInitializer {
  static async initializeForSession(
    agent: BskyAgent,
    session: Session
  ): Promise<void> {
    await Promise.all([
      initializeBookmarkService(agent),
      initializeDataServices(agent),
      dmService.setAgent(agent),
      appPreferencesService.setAgent(agent),
      columnService.setAgent(agent),
      draftService.setAgent(agent),
    ]);
  }

  static clearAll(): void {
    bookmarkService.setAgent(null);
    dmService.setAgent(null);
    appPreferencesService.setAgent(null);
    columnService.setAgent(null);
    draftService.setAgent(null);
    queryClient.clear();
  }
}
```

**Current Code Duplication:**
- Lines 265-268 (OAuth init)
- Lines 316-319 (app-password init)
- Lines 424-426 (login init)
- Lines 529-531 (OAuth callback init)
- Lines 563-565 (account switch init)

#### R2.3: Reduce State Variables with State Machine 🟡 MEDIUM
**Goal:** Eliminate inconsistent auth states

```typescript
// Replace 6 state variables with 1 state machine
type AuthState =
  | { type: 'loading' }
  | { type: 'unauthenticated' }
  | {
      type: 'authenticated',
      method: 'oauth',
      session: Session,
      agent: BskyAgent
    }
  | {
      type: 'authenticated',
      method: 'app-password',
      session: Session,
      agent: BskyAgent
    };

const [authState, setAuthState] = useState<AuthState>({ type: 'loading' });
```

**Benefits:**
- Impossible states become unrepresentable
- Simpler state transitions
- Better TypeScript type narrowing

### PRIORITY 3: SECURITY HARDENING (Optional)

#### R3.1: Encrypt Multi-Account Storage 🟢 LOW
```typescript
// src/services/account-manager.ts
import { encrypt, decrypt } from '../utils/crypto';

private static saveAccounts(accounts: StoredAccount[]): void {
  const data = JSON.stringify(accounts);
  const encrypted = encrypt(data); // AES-256-GCM
  setCookie(this.STORAGE_KEY, encrypted, {...});
  localStorage.setItem(this.STORAGE_KEY, encrypted);
}
```

#### R3.2: Implement Content Security Policy 🟢 LOW
```html
<!-- Add to index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               connect-src 'self' https://bsky.social https://*.bsky.app;
               script-src 'self' 'unsafe-inline';">
```

#### R3.3: Add Rate Limiting for Login Attempts 🟢 LOW
```typescript
// Prevent brute force attacks
const loginAttempts = new Map<string, number>();

async login(identifier: string, password: string) {
  const attempts = loginAttempts.get(identifier) || 0;
  if (attempts >= 5) {
    throw new Error("Too many login attempts. Please try again in 15 minutes.");
  }

  try {
    const session = await atProtoClient.login(identifier, password);
    loginAttempts.delete(identifier);
    return session;
  } catch (error) {
    loginAttempts.set(identifier, attempts + 1);
    throw error;
  }
}
```

---

## Refactoring Roadmap

### Phase 1: Immediate Security Fixes (1-2 hours)
- [ ] Add PDS URL validation (R1.1)
- [ ] Add session expiry notifications (R1.2)
- [ ] Add rate limiting for login (R3.3)

### Phase 2: Code Extraction (4-6 hours)
- [ ] Extract OAuthStrategy
- [ ] Extract AppPasswordStrategy
- [ ] Create ServiceInitializer
- [ ] Update tests

### Phase 3: State Management (2-3 hours)
- [ ] Implement state machine
- [ ] Refactor component to use new state
- [ ] Update dependent components

### Phase 4: Security Hardening (2-4 hours)
- [ ] Implement account storage encryption
- [ ] Add CSP headers
- [ ] Security testing

**Total Estimated Effort:** 9-15 hours

---

## Testing Recommendations

### Security Test Cases

```typescript
describe('AuthContext Security', () => {
  it('should reject invalid PDS URLs', async () => {
    await expect(
      login('user', 'pass', 'http://malicious.com')
    ).rejects.toThrow('Invalid PDS URL');
  });

  it('should not log passwords in errors', async () => {
    const spy = jest.spyOn(console, 'error');
    await expect(login('user', 'wrongpass')).rejects.toThrow();
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('wrongpass'));
  });

  it('should clear all session data on logout', async () => {
    await login('user', 'pass');
    await logout();
    expect(localStorage.getItem('notifications_bsky_session')).toBeNull();
    expect(getCookie('notifications_bsky_session')).toBeNull();
  });

  it('should enforce SameSite=Strict on cookies', () => {
    login('user', 'pass');
    expect(document.cookie).toContain('SameSite=Strict');
  });
});
```

---

## Compliance & Standards

### Security Standards Alignment

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 2021 | ✅ Mostly Compliant | Missing: A07:2021 - Identification and Authentication Failures (PDS validation) |
| OAuth 2.0 Best Practices | ✅ Compliant | Using official @atproto library |
| PKCE for OAuth | ✅ Compliant | Handled by library |
| Token Storage | ⚠️ Partial | No encryption for multi-account |
| CSRF Protection | ✅ Compliant | SameSite=Strict |
| XSS Protection | ✅ Compliant | React auto-escaping |

---

## Monitoring Recommendations

### Add Security Metrics

```typescript
// Track security events
analytics.track('auth.login.success', { method: 'oauth' });
analytics.track('auth.login.failed', { method: 'app-password', reason: 'invalid_credentials' });
analytics.track('auth.session.expired', { method: 'oauth' });
analytics.track('auth.pds.rejected', { url: sanitizedUrl });
```

### Alert on Suspicious Activity
- Multiple failed login attempts from same user
- Rejected PDS URLs
- Frequent session expirations
- OAuth errors

---

## Conclusion

**Overall Security Posture:** MODERATE

The authentication system is **fundamentally secure** with industry-standard practices for OAuth and session management. However, the high code complexity (626 lines, 16 changes in 14 days) creates **maintenance risk** that could lead to security vulnerabilities.

### Critical Actions Required:
1. ✅ **Add PDS URL validation** (HIGH priority - prevents credential theft)
2. ⚠️ **Refactor to reduce complexity** (HIGH priority - prevents future vulnerabilities)
3. ℹ️ **Add session expiry notifications** (MEDIUM priority - improves security UX)

### Expected Outcomes:
- **Reduced churn:** From 16 changes/14 days to ~5 changes/14 days
- **Lower attack surface:** Isolated auth strategies easier to audit
- **Improved security:** PDS validation prevents credential theft
- **Better maintainability:** Smaller files → fewer bugs

### Risk Summary:
- **Current Risk:** MEDIUM (complex code + missing PDS validation)
- **Risk After Fixes:** LOW (with R1.1 implemented)
- **Risk After Refactoring:** VERY LOW (with R2.1-R2.3 implemented)

---

## Appendix: File Metrics

```
File: src/contexts/AuthContext.tsx
Lines: 626
Functions: 10
State Variables: 6
External Dependencies: 14
Complexity Score: HIGH

Hotspot Ranking: 🔴 CRITICAL (16 changes in 14 days)
Security Ranking: 🟡 MODERATE (no critical vulns, but concerns)
Maintainability: 🔴 POOR (excessive complexity)
```

---

**Audit Completed:** 2025-12-16
**Next Review:** After implementing Priority 1 recommendations
**Signed:** Security Agent (Automated)
