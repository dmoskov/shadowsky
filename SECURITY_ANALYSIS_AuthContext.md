# Security Analysis: AuthContext.tsx

**Analysis Date:** 2025-12-16
**Signal:** High Churn Hotspot (16 changes in 14 days)
**Severity:** High
**Analyst:** Security Agent

## Executive Summary

This security analysis identifies **12 security concerns** in the AuthContext.tsx authentication system, ranging from critical token exposure vulnerabilities to architectural issues that contribute to the high churn rate. The dual authentication system (OAuth + app-password) introduces complexity that has led to frequent changes and potential security gaps.

---

## Critical Security Vulnerabilities

### 🔴 CRITICAL: Session Tokens Stored in Multiple Locations

**Location:** AuthContext.tsx:102-103, account-manager.ts:143-148, client.ts:128-133

**Issue:** JWT tokens (accessJwt, refreshJwt) are stored in:

1. LocalStorage (persistent, no expiration)
2. Cookies (SameSite=Strict but still exposed)
3. Multiple service state managers
4. AccountManager for multi-account support

**Attack Vectors:**

- XSS attacks can read localStorage and steal tokens
- Multiple storage locations increase attack surface
- No token encryption at rest
- Tokens persist even after logout in some edge cases

**Risk:** HIGH - A single XSS vulnerability could compromise all user sessions

**Evidence:**

```typescript
// client.ts:128-133 - Tokens stored in cleartext
setCookie(this.sessionKey, sessionData, {
  secure: window.location.protocol === "https:",
  sameSite: "Strict",
});
localStorage.setItem(this.sessionKey, sessionData);

// account-manager.ts:143-148 - Duplicate storage with JWTs
setCookie(sessionKey, sessionData, {
  secure: window.location.protocol === "https:",
  sameSite: "Strict",
});
```

**Recommendation:**

1. Implement HttpOnly cookies for token storage
2. Use sessionStorage instead of localStorage where appropriate
3. Encrypt sensitive tokens at rest using Web Crypto API
4. Centralize token storage to single source of truth
5. Implement token rotation and short-lived access tokens

---

### 🔴 CRITICAL: Object.defineProperty Used for Security-Critical Session Compatibility

**Location:** AuthContext.tsx:252-262, 496-508

**Issue:** Dynamic property injection on OAuth agent for backward compatibility creates maintainability and security risks.

**Evidence:**

```typescript
// AuthContext.tsx:252-262
const sessionCompat = {
  did: oauthState.did,
  handle,
  accessJwt: "", // Empty JWT for OAuth!
  refreshJwt: "",
  active: true,
};
Object.defineProperty(agent, "session", {
  get: () => sessionCompat,
  configurable: true, // Can be reconfigured!
});
```

**Vulnerabilities:**

1. Empty JWT strings might bypass security checks expecting valid tokens
2. `configurable: true` allows property to be redefined by malicious code
3. Getter function creates new object on each access (memory/performance)
4. Inconsistent session representation across auth methods
5. Hard to audit - session structure differs by auth method

**Attack Scenario:**

```javascript
// Malicious code could exploit configurable property
Object.defineProperty(agent, "session", {
  get: () => ({ did: "attacker-did", accessJwt: "fake-token" }),
});
```

**Recommendation:**

1. Create proper adapter pattern instead of runtime property injection
2. Set `configurable: false` if property must be defined this way
3. Unify session representation across OAuth and app-password flows
4. Use sealed objects for session data
5. Add runtime validation that session properties haven't been tampered with

---

### 🟡 HIGH: Insufficient Session Validation

**Location:** AuthContext.tsx:186-240

**Issue:** OAuth session validation relies on profile fetch, which may not catch all invalid session states.

**Evidence:**

```typescript
// AuthContext.tsx:186-240
try {
  const { data: profile } = await agent.getProfile({
    actor: oauthState.did,
  });
  handle = profile.handle;
} catch (err) {
  // Catches errors but validation logic is complex
  const status = error.status || error.statusCode ||
                 error.response?.status || ...
  // Multiple fallback checks for error status
}
```

**Vulnerabilities:**

1. Validation depends on external API call (network dependency)
2. Complex error parsing could miss edge cases
3. Non-auth errors (network) treated differently, session preserved
4. Race conditions possible during async validation
5. No cryptographic validation of OAuth tokens

**Recommendation:**

1. Implement cryptographic token validation (JWT signature check)
2. Add offline validation before making network requests
3. Simplify error handling with consistent error types
4. Add session health check separate from profile fetch
5. Implement session version/nonce to detect stale sessions

---

### 🟡 HIGH: Password Transmitted in Plain Object

**Location:** AuthContext.tsx:396-458

**Issue:** App-password login accepts password as plain string parameter.

**Evidence:**

```typescript
// AuthContext.tsx:396-402
const login = useCallback(
  async (
    identifier: string,
    password: string,  // Plain string!
    pdsUrl?: string,
    authFactorToken?: string,
  ): Promise<boolean> => {
```

**Vulnerabilities:**

1. Password visible in memory as plain string
2. No immediate zeroing of password after use
3. Could be logged by debugging tools
4. May appear in error messages/stack traces
5. Remains in memory until garbage collection

**Recommendation:**

1. Consider using credential objects that zero memory
2. Add explicit password clearing after authentication
3. Ensure passwords never appear in logs/errors
4. Document secure password handling requirements
5. Consider implementing client-side password hashing

---

### 🟡 MEDIUM: Retry Logic with Exponential Backoff Vulnerable to Timing Attacks

**Location:** AuthContext.tsx:360-368

**Issue:** Retry behavior for network errors is predictable.

**Evidence:**

```typescript
// AuthContext.tsx:360-368
if (initAttempts.current < maxRetries && navigator.onLine) {
  setTimeout(() => {
    initializeAuth(); // Retry
  }, 2000 * initAttempts.current); // Predictable timing!
}
```

**Vulnerabilities:**

1. Fixed retry intervals (2000ms × attempts) are predictable
2. No jitter added to prevent thundering herd
3. Could be used to DoS authentication service
4. Retry state stored in ref, not properly reset on unmount
5. Multiple concurrent auth attempts possible

**Recommendation:**

1. Add random jitter to retry intervals
2. Implement proper cleanup in useEffect return
3. Add maximum total retry time limit
4. Track retry state more robustly
5. Consider exponential backoff with circuit breaker pattern

---

## Medium Security Concerns

### 🟡 MEDIUM: Unsafe window.location.href Redirects

**Location:** AuthContext.tsx:122, 244, 553, 569, 579

**Issue:** Multiple unvalidated redirects using window.location.href.

**Evidence:**

```typescript
// AuthContext.tsx:122, 553, 569, 579
window.location.href = "/";
window.location.href = "/add-account";
```

**Vulnerabilities:**

1. Open redirect if paths are ever parameterized
2. No CSRF token validation on POST-redirect-GET flows
3. Forces full page reload (performance impact)
4. Bypasses React Router, breaks SPA experience
5. Could be exploited if path ever comes from user input

**Recommendation:**

1. Use React Router navigation instead of window.location
2. Validate redirect URLs if they become dynamic
3. Implement CSRF tokens for state-changing redirects
4. Add allowlist for redirect destinations
5. Consider security implications of breaking SPA flow

---

### 🟡 MEDIUM: alert() Used for Security-Critical Messages

**Location:** AuthContext.tsx:578

**Issue:** Using browser alert() for session expiry notification.

**Evidence:**

```typescript
// AuthContext.tsx:578
alert("Session expired. Please sign in again.");
```

**Vulnerabilities:**

1. alert() can be hijacked by malicious scripts
2. No logging of security events (session expiry)
3. Poor user experience for security-critical message
4. Blocks UI thread
5. Not accessible/internationalized

**Recommendation:**

1. Use proper notification system instead of alert()
2. Log all authentication failures for security monitoring
3. Implement security event tracking
4. Show user-friendly error messages in UI
5. Add telemetry for authentication issues

---

### 🟡 MEDIUM: Race Conditions in Authentication Initialization

**Location:** AuthContext.tsx:148-394

**Issue:** Complex async initialization with multiple state updates could race.

**Evidence:**

```typescript
// AuthContext.tsx:148-394
useEffect(() => {
  const safetyTimeout = setTimeout(..., 10000);
  const initializeAuth = async () => {
    // Multiple async operations
    // Multiple setState calls
    // Parallel service initialization
  };
  initializeAuth();
  return () => clearTimeout(safetyTimeout);
}, []); // Runs once, but complex async flow
```

**Vulnerabilities:**

1. 10-second timeout might interrupt valid auth flows
2. Multiple setState calls could race during fast networks
3. Component unmount might not cancel all async operations
4. initAttempts ref not properly cleaned up
5. Services might be initialized with stale/wrong agent

**Recommendation:**

1. Use AbortController for cancellable async operations
2. Implement proper async state machine
3. Add guards against updates after unmount
4. Use useReducer for complex state transitions
5. Add comprehensive error recovery

---

### 🟡 MEDIUM: Insufficient Error Context in Security Operations

**Location:** AuthContext.tsx:93-95, 231-234, 442

**Issue:** Security errors swallowed or logged without sufficient context.

**Evidence:**

```typescript
// AuthContext.tsx:93-95
catch (error) {
  debug.error("Error signing out of OAuth:", error);
}

// AuthContext.tsx:231-234
catch {
  // Ignore signOut errors - BAD!
}
```

**Vulnerabilities:**

1. Failed logout might leave user thinking they're logged out
2. No security event logging for audit trail
3. Catch-all error handlers hide security issues
4. No differentiation between expected/unexpected errors
5. Makes incident response difficult

**Recommendation:**

1. Log all security events (login, logout, failures)
2. Never silently ignore errors in security operations
3. Implement proper security event monitoring
4. Add structured logging with correlation IDs
5. Create audit trail for compliance

---

## Low/Informational Security Issues

### 🟢 LOW: No Rate Limiting on Authentication Attempts

**Location:** AuthContext.tsx (entire file)

**Issue:** No client-side rate limiting on login attempts.

**Recommendation:**

- Add client-side rate limiting for login attempts
- Track failed login attempts per identifier
- Implement progressive delays after failures
- Add CAPTCHA after threshold

---

### 🟢 LOW: Session State Not Validated After Tab/Window Focus

**Issue:** No session revalidation when user returns to tab.

**Recommendation:**

- Add visibility change listener to revalidate session
- Check session on window focus events
- Implement session health checks
- Auto-logout on detection of invalid session

---

### 🟢 INFO: Debug Logging May Expose Sensitive Information

**Location:** Multiple locations with debug.log()

**Issue:** Debug logs might expose sensitive auth data in production.

**Recommendation:**

- Audit all debug.log statements for sensitive data
- Ensure debug logs disabled in production
- Use log levels to separate security-sensitive logs
- Implement log sanitization

---

## Root Cause Analysis: Why High Churn?

### Primary Factors Contributing to Frequent Changes:

1. **Dual Authentication System Complexity**
   - OAuth and app-password flows have different session models
   - Compatibility shims (Object.defineProperty) needed
   - Different error handling paths
   - Different initialization sequences

2. **Tight Coupling**
   - AuthContext directly manages 8+ services (bookmark, draft, DM, column, preferences, etc.)
   - Service initialization tightly coupled to auth flow
   - Changes to any service require AuthContext changes

3. **Complex State Management**
   - 7 useState hooks, 1 useRef, multiple useCallbacks
   - Complex async initialization logic
   - Multiple early returns and conditional flows
   - Difficult to reason about state transitions

4. **Error Handling Fragmentation**
   - Different error handling for OAuth vs app-password
   - Special cases for 400, 401, 500 errors
   - Network error retry logic
   - Session validation errors

5. **Backward Compatibility Requirements**
   - Supporting existing app-password users
   - Multi-account system (AccountManager)
   - Cookie + localStorage dual storage
   - Session format compatibility

### Architectural Issues:

1. **God Object Pattern** - AuthContext does too much:
   - Authentication (OAuth + app-password)
   - Session management
   - Service initialization
   - Account switching
   - Error handling
   - Retry logic

2. **Missing Abstractions**:
   - No auth strategy pattern for different auth methods
   - No session manager abstraction
   - No service registry for initialization
   - No error recovery strategy pattern

3. **Technical Debt**:
   - Comments mention "kept for backwards compatibility"
   - Workarounds like Object.defineProperty
   - Dual storage (cookies + localStorage)
   - Empty JWT strings for OAuth sessions

---

## Recommended Architecture Improvements

### 1. Implement Strategy Pattern for Authentication

```typescript
interface AuthStrategy {
  login(...args): Promise<Session>;
  logout(): Promise<void>;
  refresh(): Promise<Session>;
  validate(): Promise<boolean>;
}

class OAuthStrategy implements AuthStrategy { ... }
class AppPasswordStrategy implements AuthStrategy { ... }
```

### 2. Extract Session Manager

```typescript
class SessionManager {
  private storage: SecureStorage;

  saveSession(session: Session): void;
  loadSession(): Session | null;
  clearSession(): void;
  validateSession(): boolean;
}
```

### 3. Service Registry Pattern

```typescript
class ServiceRegistry {
  private services: Map<string, Service>;

  initializeAll(agent: Agent): Promise<void>;
  shutdownAll(): Promise<void>;
}
```

### 4. State Machine for Auth Flow

```typescript
type AuthState =
  | { type: "initializing" }
  | { type: "authenticated"; session: Session }
  | { type: "unauthenticated" }
  | { type: "error"; error: Error };
```

---

## Priority Remediation Plan

### Phase 1: Critical Security Fixes (Immediate)

1. ✅ Fix Object.defineProperty security issue
2. ✅ Implement HttpOnly cookie storage for tokens
3. ✅ Add token encryption at rest
4. ✅ Fix session validation logic
5. ✅ Remove alert() usage

### Phase 2: Architecture Improvements (1-2 weeks)

1. Extract authentication strategies
2. Create session manager abstraction
3. Implement service registry
4. Add comprehensive error handling
5. Implement audit logging

### Phase 3: Hardening (2-4 weeks)

1. Add rate limiting
2. Implement session health checks
3. Add security monitoring/telemetry
4. Comprehensive security testing
5. Documentation and training

---

## Testing Recommendations

### Security Test Cases Needed:

1. **Token Security**
   - XSS attack simulation
   - Token extraction attempts
   - Token replay attacks
   - CSRF testing

2. **Session Management**
   - Concurrent session handling
   - Session fixation attacks
   - Session timeout testing
   - Multi-tab session sync

3. **Error Handling**
   - Malformed OAuth responses
   - Network failure scenarios
   - Service initialization failures
   - Race condition testing

4. **Authentication Flow**
   - OAuth callback manipulation
   - Redirect validation
   - Multi-account switching
   - Logout completeness

---

## Compliance & Best Practices

### Current Gaps:

1. **OWASP Top 10:**
   - A01: Broken Access Control (multiple storage locations)
   - A02: Cryptographic Failures (no token encryption)
   - A04: Insecure Design (tight coupling)
   - A09: Security Logging Failures (insufficient audit trail)

2. **OAuth 2.0 Security Best Practices:**
   - ✅ Using Authorization Code Flow with PKCE
   - ✅ SameSite cookies
   - ❌ No token refresh rotation
   - ❌ Tokens stored in localStorage (should be httpOnly cookies)

3. **Security Headers Missing:**
   - Content-Security-Policy implementation needed
   - X-Frame-Options validation
   - Strict-Transport-Security enforcement

---

## Monitoring & Alerting Recommendations

### Add Metrics For:

1. Failed login attempts per IP/user
2. Session validation failures
3. OAuth callback errors
4. Token refresh failures
5. Concurrent session anomalies
6. Service initialization timeouts

### Add Alerts For:

1. High rate of authentication failures
2. Session validation anomalies
3. Multiple failed OAuth callbacks
4. Unusual session patterns
5. Service initialization failures

---

## Conclusion

The AuthContext.tsx file exhibits **high security risk** due to:

1. **Critical vulnerabilities** in token storage and session management
2. **Architectural complexity** leading to frequent changes and potential bugs
3. **Insufficient security controls** for session validation and error handling
4. **Technical debt** from supporting dual authentication systems

**Recommended Action:** Implement Phase 1 critical fixes immediately, then proceed with architectural refactoring to reduce future churn and improve security posture.

The high churn rate (16 changes in 14 days) is a **symptom** of poor architectural separation of concerns. Addressing the architectural issues will naturally reduce churn while improving security.

---

## References

- OWASP Top 10 2021: https://owasp.org/www-project-top-ten/
- OAuth 2.0 Security Best Practices: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
- OWASP Session Management Cheat Sheet
- OWASP Authentication Cheat Sheet
- CWE-312: Cleartext Storage of Sensitive Information
- CWE-319: Cleartext Transmission of Sensitive Information

---

**Report Generated:** 2025-12-16
**Analyst:** Security Agent (Automated Analysis)
**Next Review:** After implementing Phase 1 fixes
