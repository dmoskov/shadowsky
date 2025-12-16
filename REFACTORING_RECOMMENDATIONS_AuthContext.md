# Refactoring Recommendations: AuthContext.tsx

**Date:** 2025-12-16
**For:** Refactoring Agent
**Related Audit:** SECURITY_AUDIT_AuthContext_2025-12-16.md
**Asana Task:** https://app.asana.com/0/1211710875848660/1212467597437955

## Executive Summary

AuthContext.tsx has become a **hotspot** with 16 changes in 14 days due to excessive complexity (658 lines). This document provides actionable refactoring recommendations to reduce churn and improve maintainability while preserving security.

**Goal:** Reduce file size from 658 lines to ~200 lines, split into focused modules.

---

## Problem Statement

### Current Issues

- **Line count:** 658 lines (too large for a single file)
- **Cyclomatic complexity:** HIGH (multiple auth flows, error paths)
- **Churn rate:** 16 changes in 14 days (unsustainable)
- **Tight coupling:** 14 external dependencies
- **State management:** 6 interdependent state variables

### Impact

- Changes require deep context understanding
- High risk of introducing bugs
- Difficult to test in isolation
- New features require AuthContext changes

---

## Refactoring Plan

### Phase 1: Extract Authentication Strategies

**Goal:** Separate OAuth and app-password authentication into isolated strategies

#### Step 1.1: Create Strategy Interface

```typescript
// src/contexts/auth/strategies/AuthStrategy.ts
export interface AuthStrategy {
  readonly name: "oauth" | "app-password";

  /**
   * Initialize the strategy and check for existing session
   */
  init(): Promise<AuthResult | null>;

  /**
   * Authenticate with credentials
   */
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;

  /**
   * Sign out and clear session
   */
  signOut(): Promise<void>;

  /**
   * Refresh the current session
   */
  refreshSession(): Promise<AuthResult | null>;

  /**
   * Check if this strategy can handle the given credentials
   */
  canHandle(credentials: AuthCredentials): boolean;
}

export interface AuthResult {
  session: Session;
  agent: BskyAgent;
  method: "oauth" | "app-password";
}

export type AuthCredentials =
  | { type: "oauth"; handle: string }
  | {
      type: "app-password";
      identifier: string;
      password: string;
      pdsUrl?: string;
      authFactorToken?: string;
    }
  | { type: "oauth-callback" };
```

#### Step 1.2: Implement OAuth Strategy

```typescript
// src/contexts/auth/strategies/OAuthStrategy.ts
import { Agent } from "@atproto/api";
import type { BskyAgent } from "@atproto/api";
import { oauthService } from "../../../services/oauth-service";
import type { AuthResult, AuthStrategy, AuthCredentials } from "./AuthStrategy";

export class OAuthStrategy implements AuthStrategy {
  readonly name = "oauth" as const;

  async init(): Promise<AuthResult | null> {
    const oauthState = await oauthService.init();

    if (oauthState?.agent && oauthState.did) {
      const agent = oauthState.agent as unknown as BskyAgent;

      // Validate session by fetching profile
      const sessionValid = await this.validateSession(agent, oauthState.did);
      if (!sessionValid) {
        await oauthService.signOut();
        return null;
      }

      const { handle, profileData } = await this.fetchProfile(
        agent,
        oauthState.did,
      );

      return {
        session: this.createSession(oauthState.did, handle),
        agent: this.configureAgent(agent, oauthState.did, handle),
        method: "oauth",
      };
    }

    return null;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    if (credentials.type === "oauth") {
      await oauthService.authorize(credentials.handle);
      // This redirects, so we won't reach here
      throw new Error("Should have redirected");
    }

    if (credentials.type === "oauth-callback") {
      const state = await oauthService.handleCallback();
      if (!state?.agent || !state.did) {
        throw new Error("OAuth callback failed");
      }

      const agent = state.agent as unknown as BskyAgent;
      const { handle, profileData } = await this.fetchProfile(agent, state.did);

      return {
        session: this.createSession(state.did, handle),
        agent: this.configureAgent(agent, state.did, handle),
        method: "oauth",
      };
    }

    throw new Error("Invalid credentials for OAuth strategy");
  }

  async signOut(): Promise<void> {
    await oauthService.signOut();
  }

  async refreshSession(): Promise<AuthResult | null> {
    // OAuth sessions are managed by the OAuth library
    return null;
  }

  canHandle(credentials: AuthCredentials): boolean {
    return (
      credentials.type === "oauth" || credentials.type === "oauth-callback"
    );
  }

  private async validateSession(
    agent: BskyAgent,
    did: string,
  ): Promise<boolean> {
    try {
      await agent.getProfile({ actor: did });
      return true;
    } catch (err) {
      const error = err as Error & { status?: number };
      const status = error.status || error.response?.status;
      return status !== 401 && status !== 400;
    }
  }

  private async fetchProfile(
    agent: BskyAgent,
    did: string,
  ): Promise<{
    handle: string;
    profileData: { displayName?: string; avatar?: string };
  }> {
    try {
      const { data: profile } = await agent.getProfile({ actor: did });
      return {
        handle: profile.handle,
        profileData: {
          displayName: profile.displayName,
          avatar: profile.avatar,
        },
      };
    } catch {
      return { handle: "", profileData: {} };
    }
  }

  private createSession(did: string, handle: string): Session {
    return {
      did,
      handle,
      accessJwt: "",
      refreshJwt: "",
      active: true,
    };
  }

  private configureAgent(
    agent: BskyAgent,
    did: string,
    handle: string,
  ): BskyAgent {
    // Add session property for compatibility
    const sessionCompat = {
      did,
      handle,
      accessJwt: "",
      refreshJwt: "",
      active: true,
    };
    Object.defineProperty(agent, "session", {
      get: () => sessionCompat,
      configurable: true,
    });
    return agent;
  }
}
```

#### Step 1.3: Implement App Password Strategy

```typescript
// src/contexts/auth/strategies/AppPasswordStrategy.ts
import { atProtoClient } from "../../../services/atproto";
import type { AuthResult, AuthStrategy, AuthCredentials } from "./AuthStrategy";
import {
  SessionExpiredError,
  AuthenticationError,
  NetworkError,
} from "@bsky/shared";

/**
 * Validates that a PDS URL is safe to use for authentication.
 * Only allows official Bluesky domains to prevent credential theft via malicious servers.
 */
function isValidPDSUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const allowedDomains = ["bsky.social", "bsky.app", "blueskyweb.xyz"];
    return allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export class AppPasswordStrategy implements AuthStrategy {
  readonly name = "app-password" as const;
  private initAttempts = 0;
  private readonly maxRetries = 3;

  async init(): Promise<AuthResult | null> {
    const savedSession = ATProtoClient.loadSavedSession(
      atProtoClient.getSessionPrefix(),
    );

    if (!savedSession) {
      return null;
    }

    this.initAttempts++;

    try {
      const resumedSession = await atProtoClient.resumeSession(savedSession);
      this.initAttempts = 0;
      return {
        session: resumedSession,
        agent: atProtoClient.agent,
        method: "app-password",
      };
    } catch (error) {
      return this.handleInitError(error);
    }
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    if (credentials.type !== "app-password") {
      throw new Error("Invalid credentials for app-password strategy");
    }

    const { identifier, password, pdsUrl, authFactorToken } = credentials;

    // Validate custom PDS URL if provided
    if (pdsUrl && pdsUrl !== "https://bsky.social") {
      if (!isValidPDSUrl(pdsUrl)) {
        throw new Error(
          "Invalid PDS URL. Only official Bluesky servers (bsky.social, bsky.app) are supported.",
        );
      }
      atProtoClient.updateService(pdsUrl);
    }

    const trimAt = (s: string) => (s.startsWith("@") ? s.slice(1) : s);
    const session = await atProtoClient.login(
      trimAt(identifier),
      password,
      authFactorToken,
    );

    return {
      session,
      agent: atProtoClient.agent,
      method: "app-password",
    };
  }

  async signOut(): Promise<void> {
    atProtoClient.logout();
  }

  async refreshSession(): Promise<AuthResult | null> {
    const newSession = await atProtoClient.refreshSession();
    if (!newSession) return null;

    return {
      session: newSession,
      agent: atProtoClient.agent,
      method: "app-password",
    };
  }

  canHandle(credentials: AuthCredentials): boolean {
    return credentials.type === "app-password";
  }

  private async handleInitError(error: unknown): Promise<AuthResult | null> {
    const status = (error as Error & { status?: number })?.status;

    if (status === 400 || status === 401) {
      atProtoClient.logout();
      return null;
    }

    if (
      error instanceof SessionExpiredError ||
      error instanceof AuthenticationError
    ) {
      atProtoClient.logout();
      return null;
    }

    if (error instanceof NetworkError || status >= 500 || !navigator.onLine) {
      if (this.initAttempts < this.maxRetries && navigator.onLine) {
        // Retry with exponential backoff (handled by caller)
        throw error;
      }
    }

    return null;
  }
}
```

### Phase 2: Extract Service Initialization

```typescript
// src/contexts/auth/ServiceInitializer.ts
import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { queryClient } from "@bsky/shared";
import { dmService } from "../../services/dm-service";
import { appPreferencesService } from "../../services/app-preferences-service";
import { columnService } from "../../services/column-service";
import { draftService } from "../../services/draft-service";
import {
  bookmarkService,
  initializeBookmarkService,
} from "../../services/bookmark-service-wrapper";
import { initializeDataServices } from "../../services/data-services-initializer";
import { AccountManager } from "../../services/account-manager";

export class ServiceInitializer {
  /**
   * Initialize all services with authenticated agent and session
   */
  static async initializeForSession(
    agent: BskyAgent,
    session: Session,
    authMethod: "oauth" | "app-password",
  ): Promise<void> {
    // Set agent for services that need it immediately
    dmService.setAgent(agent);

    // Initialize services in parallel for faster startup
    await Promise.all([
      initializeBookmarkService(agent),
      initializeDataServices(agent),
    ]);

    // Store account for multi-account support
    await this.storeAccount(agent, session, authMethod);
  }

  /**
   * Clear all service state on logout
   */
  static clearAll(): void {
    bookmarkService.setAgent(null);
    dmService.setAgent(null);
    appPreferencesService.setAgent(null);
    columnService.setAgent(null);
    draftService.setAgent(null);
    queryClient.clear();
  }

  /**
   * Store account with profile data in AccountManager
   */
  private static async storeAccount(
    agent: BskyAgent,
    session: Session,
    authMethod: "oauth" | "app-password",
  ): Promise<void> {
    try {
      const { data: profile } = await agent.getProfile({
        actor: session.did,
      });
      AccountManager.addOrUpdateAccount(
        session,
        {
          displayName: profile.displayName,
          avatar: profile.avatar,
        },
        authMethod,
      );
    } catch {
      // Still add account even if profile fetch fails
      AccountManager.addOrUpdateAccount(session, undefined, authMethod);
    }
  }
}
```

### Phase 3: Simplify AuthContext

```typescript
// src/contexts/auth/AuthContext.tsx (simplified version)
import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { debug, queryClient } from "@bsky/shared";
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AccountManager } from "../../services/account-manager";
import { atProtoClient } from "../../services/atproto";
import { hasExistingOAuthSession, oauthService } from "../../services/oauth-service";
import { routePrefetchService } from "../../services/route-prefetch-service";
import { setApiAuthSession } from "../../utils/api-auth";
import { ServiceInitializer } from "./ServiceInitializer";
import { OAuthStrategy } from "./strategies/OAuthStrategy";
import { AppPasswordStrategy } from "./strategies/AppPasswordStrategy";
import type { AuthStrategy } from "./strategies/AuthStrategy";

type AuthMethod = "oauth" | "app-password" | null;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  isOAuthAvailable: boolean;
  loginWithOAuth: (handle: string) => Promise<void>;
  handleOAuthCallback: () => Promise<boolean>;
  login: (
    identifier: string,
    password: string,
    pdsUrl?: string,
    authFactorToken?: string
  ) => Promise<boolean>;
  logout: (logoutAllAccounts?: boolean) => void;
  session: Session | null;
  client: typeof atProtoClient;
  agent: BskyAgent | null;
  refreshSession: () => Promise<boolean>;
  switchAccount: (did: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isOAuthAvailable, setIsOAuthAvailable] = useState(false);

  // Initialize strategies
  const oauthStrategy = new OAuthStrategy();
  const appPasswordStrategy = new AppPasswordStrategy();

  const logout = useCallback(
    async (logoutAllAccounts = false) => {
      // Sign out based on auth method
      if (authMethod === "oauth") {
        await oauthStrategy.signOut();
      } else {
        await appPasswordStrategy.signOut();
      }

      // Clear all state
      setIsAuthenticated(false);
      setSession(null);
      setAgent(null);
      setApiAuthSession(null);
      setAuthMethod(null);

      // Clear services
      ServiceInitializer.clearAll();

      // Clear all accounts if specified
      if (logoutAllAccounts) {
        AccountManager.clearAllAccounts();
      }

      // Force page reload
      window.location.href = "/";
    },
    [authMethod]
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const strategy = authMethod === 'oauth' ? oauthStrategy : appPasswordStrategy;
      const result = await strategy.refreshSession();

      if (result) {
        setSession(result.session);
        setApiAuthSession(result.session);
        return true;
      }
      return false;
    } catch (error) {
      debug.error("Failed to refresh session:", error);
      logout();
      return false;
    }
  }, [authMethod, logout]);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    const initializeAuth = async () => {
      try {
        // Prefetch home route
        routePrefetchService.prefetchRoute("home");

        // Check for OAuth session first
        const mayHaveOAuthSession = await hasExistingOAuthSession();

        if (mayHaveOAuthSession) {
          const result = await oauthStrategy.init();
          setIsOAuthAvailable(oauthService.isAvailable());

          if (result) {
            await ServiceInitializer.initializeForSession(
              result.agent,
              result.session,
              result.method
            );
            setIsAuthenticated(true);
            setAuthMethod(result.method);
            setSession(result.session);
            setAgent(result.agent);
            setApiAuthSession(result.session);
            setIsLoading(false);
            return;
          }
        }

        // Fall back to app-password
        const result = await appPasswordStrategy.init();
        if (result) {
          await ServiceInitializer.initializeForSession(
            result.agent,
            result.session,
            result.method
          );
          setIsAuthenticated(true);
          setAuthMethod(result.method);
          setSession(result.session);
          setAgent(result.agent);
          setApiAuthSession(result.session);
        }
      } catch (error) {
        debug.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
    return () => clearTimeout(safetyTimeout);
  }, []);

  const login = useCallback(
    async (
      identifier: string,
      password: string,
      pdsUrl?: string,
      authFactorToken?: string
    ): Promise<boolean> => {
      try {
        const result = await appPasswordStrategy.authenticate({
          type: 'app-password',
          identifier,
          password,
          pdsUrl,
          authFactorToken,
        });

        await ServiceInitializer.initializeForSession(
          result.agent,
          result.session,
          result.method
        );

        setIsAuthenticated(true);
        setAuthMethod(result.method);
        setSession(result.session);
        setAgent(result.agent);
        setApiAuthSession(result.session);

        return true;
      } catch (error) {
        debug.error("Login error:", error);
        throw error;
      }
    },
    []
  );

  const loginWithOAuth = useCallback(async (handle: string): Promise<void> => {
    await oauthStrategy.authenticate({ type: 'oauth', handle });
  }, []);

  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    try {
      const result = await oauthStrategy.authenticate({ type: 'oauth-callback' });

      await ServiceInitializer.initializeForSession(
        result.agent,
        result.session,
        result.method
      );

      setIsAuthenticated(true);
      setAuthMethod(result.method);
      setSession(result.session);
      setAgent(result.agent);
      setApiAuthSession(result.session);

      return true;
    } catch (error) {
      debug.error("OAuth callback error:", error);
      throw error;
    }
  }, []);

  const switchAccount = useCallback(async (did: string): Promise<boolean> => {
    try {
      const account = AccountManager.switchAccount(did);
      if (!account) return false;

      if (account.authMethod === "oauth") {
        window.location.href = "/add-account";
        return false;
      }

      const resumedSession = await atProtoClient.resumeSession(account.session);
      await ServiceInitializer.initializeForSession(
        atProtoClient.agent,
        resumedSession,
        'app-password'
      );

      setIsAuthenticated(true);
      setAuthMethod("app-password");
      setSession(resumedSession);
      setAgent(atProtoClient.agent);
      setApiAuthSession(resumedSession);

      queryClient.clear();
      window.location.href = "/";
      return true;
    } catch (error) {
      debug.error("Failed to switch account:", error);
      const status = (error as Error & { status?: number })?.status;
      if (status === 400 || status === 401) {
        AccountManager.removeAccount(did);
        alert("Session expired. Please sign in again.");
        window.location.href = "/add-account";
      }
      return false;
    }
  }, []);

  const contextValue = {
    isAuthenticated,
    isLoading,
    authMethod,
    isOAuthAvailable,
    loginWithOAuth,
    handleOAuthCallback,
    login,
    logout,
    session,
    client: atProtoClient,
    agent: isAuthenticated ? agent : null,
    refreshSession,
    switchAccount,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
```

---

## Benefits of This Refactoring

### Quantifiable Improvements

- **File size:** 658 → ~200 lines (-70%)
- **Cyclomatic complexity:** HIGH → MEDIUM
- **Test coverage:** Easier to test strategies in isolation
- **Expected churn:** 16 changes/14 days → ~5 changes/14 days

### Qualitative Improvements

- **Separation of concerns:** Each strategy handles one auth method
- **Open/closed principle:** Easy to add new auth methods
- **Testability:** Strategies can be unit tested independently
- **Maintainability:** Changes to OAuth don't affect app-password
- **Security:** Isolated strategies reduce attack surface

---

## Migration Path

### Step 1: Create New Structure (No Breaking Changes)

1. Create `src/contexts/auth/` directory
2. Implement `AuthStrategy.ts` interface
3. Implement `OAuthStrategy.ts`
4. Implement `AppPasswordStrategy.ts`
5. Implement `ServiceInitializer.ts`
6. Write tests for each strategy

### Step 2: Parallel Implementation

1. Create new `AuthContext.tsx` using strategies
2. Export both old and new contexts
3. Gradually migrate components to new context
4. Run integration tests

### Step 3: Cutover

1. Replace old AuthContext with new implementation
2. Remove old code
3. Update imports
4. Final integration testing

---

## Testing Strategy

```typescript
// tests/auth/strategies/OAuthStrategy.test.ts
describe("OAuthStrategy", () => {
  let strategy: OAuthStrategy;

  beforeEach(() => {
    strategy = new OAuthStrategy();
  });

  it("should validate session and return AuthResult", async () => {
    const result = await strategy.init();
    expect(result).toMatchObject({
      session: expect.any(Object),
      agent: expect.any(Object),
      method: "oauth",
    });
  });

  it("should handle expired sessions gracefully", async () => {
    // Mock expired session
    const result = await strategy.init();
    expect(result).toBeNull();
  });
});

// tests/auth/strategies/AppPasswordStrategy.test.ts
describe("AppPasswordStrategy", () => {
  it("should reject invalid PDS URLs", async () => {
    const strategy = new AppPasswordStrategy();
    await expect(
      strategy.authenticate({
        type: "app-password",
        identifier: "user",
        password: "pass",
        pdsUrl: "http://malicious.com",
      }),
    ).rejects.toThrow("Invalid PDS URL");
  });
});
```

---

## Implementation Checklist

### Phase 1: Strategy Pattern (4-6 hours)

- [ ] Create `src/contexts/auth/strategies/` directory
- [ ] Implement `AuthStrategy.ts` interface
- [ ] Implement `OAuthStrategy.ts` with tests
- [ ] Implement `AppPasswordStrategy.ts` with tests
- [ ] Move PDS validation to strategy

### Phase 2: Service Initialization (2-3 hours)

- [ ] Create `ServiceInitializer.ts`
- [ ] Extract all service init logic
- [ ] Add tests for ServiceInitializer
- [ ] Verify no duplicate initialization

### Phase 3: Simplify AuthContext (3-4 hours)

- [ ] Create new `AuthContext.tsx` using strategies
- [ ] Migrate state management to use strategies
- [ ] Update all callbacks to use strategies
- [ ] Preserve backward compatibility

### Phase 4: Testing & Migration (2-3 hours)

- [ ] Write integration tests
- [ ] Test OAuth flow end-to-end
- [ ] Test app-password flow end-to-end
- [ ] Test account switching
- [ ] Performance testing

### Phase 5: Cleanup (1 hour)

- [ ] Remove old code
- [ ] Update documentation
- [ ] Final code review
- [ ] Deploy

**Total Time:** 12-17 hours

---

## Success Metrics

### Before Refactoring

- Lines of code: 658
- Churn: 16 changes in 14 days
- Cyclomatic complexity: HIGH
- Test coverage: ~60%
- Time to add new auth method: 4-6 hours

### After Refactoring

- Lines of code: ~500 total (split across 5 files)
- Expected churn: ~5 changes in 14 days
- Cyclomatic complexity: MEDIUM
- Test coverage: >80%
- Time to add new auth method: 1-2 hours

---

## Risk Assessment

### Low Risk

- No breaking API changes
- Backward compatible during migration
- Testable in isolation
- Gradual rollout possible

### Mitigation Strategies

1. **Feature flags:** Use feature flag for new auth context
2. **Parallel running:** Keep old code until new code proven
3. **Rollback plan:** Git revert if issues found
4. **Monitoring:** Add metrics to track auth success rates

---

## Questions for Refactoring Agent

1. Should we implement this refactoring in a separate branch?
2. Do you want to add feature flags for gradual rollout?
3. Should we add telemetry to measure before/after performance?
4. Are there any other services that should be extracted?

---

**Next Steps:**

1. Review this refactoring plan with team
2. Get approval for architectural changes
3. Create implementation branch
4. Start with Phase 1 (Strategy Pattern)
5. Iterate and get feedback

**For questions or clarifications, refer to:**

- Security audit: `SECURITY_AUDIT_AuthContext_2025-12-16.md`
- Original file: `src/contexts/AuthContext.tsx` (line 1-658)
