# Security Fixes Implementation Plan

**Date:** 2025-12-16
**Priority:** HIGH
**Estimated Effort:** 3-4 weeks (phased approach)

## Overview

This document provides a concrete implementation plan for addressing the security vulnerabilities identified in AuthContext.tsx. The plan is divided into three phases with specific code changes and testing requirements.

---

## Phase 1: Critical Security Fixes (Week 1)

### Fix 1.1: Secure Object.defineProperty Usage

**Current Code (AuthContext.tsx:252-262):**

```typescript
Object.defineProperty(agent, "session", {
  get: () => sessionCompat,
  configurable: true, // SECURITY RISK!
});
```

**Fixed Code:**

```typescript
// Create session compat once and freeze it
const sessionCompat = Object.freeze({
  did: oauthState.did,
  handle,
  accessJwt: "",
  refreshJwt: "",
  active: true,
});

Object.defineProperty(agent, "session", {
  get: () => sessionCompat,
  configurable: false, // ✅ Prevent reconfiguration
  enumerable: true,
});

// Add validation that session hasn't been tampered with
Object.seal(agent);
```

**Files to Change:**

- src/contexts/AuthContext.tsx (lines 252-262, 496-508)

**Testing:**

- Verify OAuth authentication still works
- Test that session property cannot be redefined
- Verify session data is immutable

---

### Fix 1.2: Add Session Validation Guard

**New File: src/utils/session-validator.ts**

```typescript
/**
 * Session security validator
 * Prevents session tampering and validates integrity
 */

import type { Session } from "@bsky/shared";
import { debug } from "@bsky/shared";

// Store session checksums to detect tampering
const sessionChecksums = new WeakMap<object, string>();

/**
 * Create a SHA-256 checksum of session data
 */
async function createChecksum(session: Session): Promise<string> {
  const data = JSON.stringify({
    did: session.did,
    handle: session.handle,
    timestamp: Date.now(),
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Seal a session object and store its checksum
 */
export async function sealSession(session: Session): Promise<Session> {
  const sealed = Object.freeze({ ...session });
  const checksum = await createChecksum(sealed);
  sessionChecksums.set(sealed, checksum);
  return sealed;
}

/**
 * Validate that a session hasn't been tampered with
 */
export async function validateSession(session: Session): Promise<boolean> {
  if (!session?.did || !session?.handle) {
    debug.error("Session validation failed: missing required fields");
    return false;
  }

  const storedChecksum = sessionChecksums.get(session);
  if (!storedChecksum) {
    debug.warn("Session validation: no checksum found (might be from storage)");
    return true; // Allow sessions from storage
  }

  const currentChecksum = await createChecksum(session);
  if (storedChecksum !== currentChecksum) {
    debug.error(
      "Session validation failed: checksum mismatch - possible tampering!",
    );
    return false;
  }

  return true;
}

/**
 * Validate DID format
 */
export function isValidDid(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * Validate handle format
 */
export function isValidHandle(handle: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/.test(handle);
}
```

**Update AuthContext.tsx:**

```typescript
import {
  sealSession,
  validateSession,
  isValidDid,
  isValidHandle,
} from "../utils/session-validator";

// In OAuth session creation (line 275)
const oauthSession: Session = await sealSession({
  did: oauthState.did,
  handle,
  accessJwt: "",
  refreshJwt: "",
  active: true,
});

// Validate DIDs and handles
if (!isValidDid(oauthSession.did)) {
  throw new Error("Invalid DID format");
}
if (!isValidHandle(oauthSession.handle)) {
  throw new Error("Invalid handle format");
}

setSession(oauthSession);
```

---

### Fix 1.3: Implement Secure Storage Manager

**New File: src/utils/secure-storage.ts**

```typescript
/**
 * Secure storage manager for sensitive authentication data
 * Provides encrypted storage and single source of truth
 */

import type { Session } from "@bsky/shared";
import { debug } from "@bsky/shared";

const ENCRYPTION_KEY_NAME = "bsky_storage_key";
const SESSION_KEY = "bsky_secure_session";

/**
 * Generate or retrieve encryption key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to load existing key from IndexedDB
  // For now, generate a new key (in production, persist this securely)
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt session data
 */
async function encryptSession(session: Session): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(session));

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt session data
 */
async function decryptSession(encryptedData: string): Promise<Session | null> {
  try {
    const key = await getEncryptionKey();

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0),
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    );

    const decoder = new TextDecoder();
    const sessionData = decoder.decode(decrypted);
    return JSON.parse(sessionData);
  } catch (error) {
    debug.error("Failed to decrypt session:", error);
    return null;
  }
}

/**
 * Secure storage interface
 */
export class SecureStorage {
  /**
   * Save session securely (encrypted in sessionStorage only)
   * SECURITY: Use sessionStorage instead of localStorage
   * SECURITY: Encrypt data at rest
   */
  async saveSession(session: Session): Promise<void> {
    try {
      const encrypted = await encryptSession(session);

      // Use sessionStorage (cleared when tab closes) instead of localStorage
      sessionStorage.setItem(SESSION_KEY, encrypted);

      debug.log("Session saved securely");
    } catch (error) {
      debug.error("Failed to save session:", error);
      throw error;
    }
  }

  /**
   * Load session securely
   */
  async loadSession(): Promise<Session | null> {
    try {
      const encrypted = sessionStorage.getItem(SESSION_KEY);
      if (!encrypted) {
        return null;
      }

      const session = await decryptSession(encrypted);
      return session;
    } catch (error) {
      debug.error("Failed to load session:", error);
      return null;
    }
  }

  /**
   * Clear session
   */
  clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
    debug.log("Session cleared");
  }

  /**
   * Check if session exists
   */
  hasSession(): boolean {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  }
}

export const secureStorage = new SecureStorage();
```

**Note:** This is a simplified implementation. In production:

1. Persist encryption key in IndexedDB
2. Implement key rotation
3. Add key derivation from user password (PBKDF2)
4. Consider using SubtleCrypto for key management

---

### Fix 1.4: Replace alert() with Secure Notification System

**New File: src/contexts/NotificationContext.tsx**

```typescript
/**
 * Secure notification system for auth events
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { debug } from "@bsky/shared";

export type NotificationType = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  dismissible: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string, dismissible?: boolean) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((
    type: NotificationType,
    message: string,
    dismissible: boolean = true
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
      dismissible,
    };

    debug.log(`[${type.toUpperCase()}] ${message}`);

    setNotifications(prev => [...prev, notification]);

    // Auto-dismiss after 5 seconds for non-critical notifications
    if (dismissible && type !== "error") {
      setTimeout(() => {
        dismissNotification(id);
      }, 5000);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
```

**Update AuthContext.tsx (line 578):**

```typescript
// Replace:
// alert("Session expired. Please sign in again.");

// With:
const { addNotification } = useNotification();
addNotification("error", "Session expired. Please sign in again.", false);
```

---

### Fix 1.5: Add Security Event Logging

**New File: src/utils/security-logger.ts**

```typescript
/**
 * Security event logger for audit trail
 */

import { debug } from "@bsky/shared";

export enum SecurityEvent {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_REFRESH = "SESSION_REFRESH",
  ACCOUNT_SWITCH = "ACCOUNT_SWITCH",
  OAUTH_CALLBACK = "OAUTH_CALLBACK",
  SESSION_VALIDATION_FAILED = "SESSION_VALIDATION_FAILED",
  TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED",
}

export interface SecurityLogEntry {
  event: SecurityEvent;
  timestamp: number;
  did?: string;
  handle?: string;
  ip?: string;
  userAgent: string;
  details?: Record<string, unknown>;
}

class SecurityLogger {
  private logs: SecurityLogEntry[] = [];
  private maxLogs = 100; // Keep last 100 events in memory

  log(
    event: SecurityEvent,
    details?: Record<string, unknown>,
    did?: string,
    handle?: string,
  ): void {
    const entry: SecurityLogEntry = {
      event,
      timestamp: Date.now(),
      did,
      handle,
      userAgent: navigator.userAgent,
      details,
    };

    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      debug.log(`[SECURITY] ${event}`, entry);
    }

    // In production, send to analytics/monitoring service
    this.sendToMonitoring(entry);
  }

  private sendToMonitoring(entry: SecurityLogEntry): void {
    // TODO: Implement sending to monitoring service (e.g., Sentry, DataDog)
    // For now, just store locally
  }

  getRecentLogs(): SecurityLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const securityLogger = new SecurityLogger();
```

**Update AuthContext.tsx to log all security events:**

```typescript
import { securityLogger, SecurityEvent } from "../utils/security-logger";

// After successful login
securityLogger.log(
  SecurityEvent.LOGIN_SUCCESS,
  { method: authMethod },
  session.did,
  session.handle,
);

// After logout
securityLogger.log(
  SecurityEvent.LOGOUT,
  { method: authMethod },
  session?.did,
  session?.handle,
);

// After session expiry
securityLogger.log(
  SecurityEvent.SESSION_EXPIRED,
  undefined,
  session?.did,
  session?.handle,
);

// After failed validation
securityLogger.log(SecurityEvent.SESSION_VALIDATION_FAILED, {
  reason: "checksum mismatch",
});
```

---

## Phase 2: Architecture Improvements (Week 2-3)

### Fix 2.1: Extract Authentication Strategy Pattern

**New File: src/auth/strategies/AuthStrategy.ts**

```typescript
/**
 * Authentication strategy interface
 */

import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";

export interface AuthResult {
  success: boolean;
  session?: Session;
  agent?: BskyAgent;
  error?: Error;
}

export interface AuthStrategy {
  readonly name: string;

  /**
   * Authenticate user
   */
  login(...args: unknown[]): Promise<AuthResult>;

  /**
   * Sign out user
   */
  logout(): Promise<void>;

  /**
   * Refresh/validate session
   */
  refresh(): Promise<AuthResult>;

  /**
   * Check if session is valid
   */
  validate(session: Session): Promise<boolean>;

  /**
   * Initialize strategy (e.g., load OAuth client)
   */
  initialize(): Promise<void>;
}
```

**New File: src/auth/strategies/OAuthStrategy.ts**

```typescript
/**
 * OAuth authentication strategy
 */

import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { debug } from "@bsky/shared";
import { oauthService } from "../../services/oauth-service";
import { sealSession, validateSession } from "../../utils/session-validator";
import { securityLogger, SecurityEvent } from "../../utils/security-logger";
import type { AuthStrategy, AuthResult } from "./AuthStrategy";

export class OAuthStrategy implements AuthStrategy {
  readonly name = "oauth";

  async initialize(): Promise<void> {
    await oauthService.init();
  }

  async login(handle: string): Promise<AuthResult> {
    try {
      await oauthService.authorize(handle);
      return { success: true };
    } catch (error) {
      securityLogger.log(SecurityEvent.LOGIN_FAILURE, {
        strategy: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error as Error };
    }
  }

  async logout(): Promise<void> {
    await oauthService.signOut();
    securityLogger.log(SecurityEvent.LOGOUT, { strategy: this.name });
  }

  async refresh(): Promise<AuthResult> {
    // OAuth refresh is handled by the oauth-service
    const state = await oauthService.init();

    if (state?.agent && state.did) {
      const agent = state.agent as unknown as BskyAgent;

      // Validate by fetching profile
      try {
        const { data: profile } = await agent.getProfile({ actor: state.did });

        const session = await sealSession({
          did: state.did,
          handle: profile.handle,
          accessJwt: "",
          refreshJwt: "",
          active: true,
        });

        securityLogger.log(
          SecurityEvent.SESSION_REFRESH,
          {
            strategy: this.name,
          },
          session.did,
          session.handle,
        );

        return { success: true, session, agent };
      } catch (error) {
        securityLogger.log(SecurityEvent.TOKEN_REFRESH_FAILED, {
          strategy: this.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: error as Error };
      }
    }

    return { success: false };
  }

  async validate(session: Session): Promise<boolean> {
    const isValid = await validateSession(session);

    if (!isValid) {
      securityLogger.log(
        SecurityEvent.SESSION_VALIDATION_FAILED,
        {
          strategy: this.name,
        },
        session.did,
        session.handle,
      );
    }

    return isValid;
  }
}
```

**New File: src/auth/strategies/AppPasswordStrategy.ts**

```typescript
/**
 * App password authentication strategy
 */

import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { debug } from "@bsky/shared";
import { atProtoClient } from "../../services/atproto";
import { sealSession, validateSession } from "../../utils/session-validator";
import { securityLogger, SecurityEvent } from "../../utils/security-logger";
import type { AuthStrategy, AuthResult } from "./AuthStrategy";

export class AppPasswordStrategy implements AuthStrategy {
  readonly name = "app-password";

  async initialize(): Promise<void> {
    // No initialization needed for app-password
  }

  async login(
    identifier: string,
    password: string,
    pdsUrl?: string,
    authFactorToken?: string,
  ): Promise<AuthResult> {
    try {
      if (pdsUrl && pdsUrl !== "https://bsky.social") {
        atProtoClient.updateService(pdsUrl);
      }

      const trimAt = (s: string) =>
        s.length > 0 && s[0] === "@" ? s.slice(1) : s;
      const session = await atProtoClient.login(
        trimAt(identifier),
        password,
        authFactorToken,
      );

      const sealedSession = await sealSession(session);

      securityLogger.log(
        SecurityEvent.LOGIN_SUCCESS,
        {
          strategy: this.name,
        },
        session.did,
        session.handle,
      );

      return {
        success: true,
        session: sealedSession,
        agent: atProtoClient.agent,
      };
    } catch (error) {
      securityLogger.log(SecurityEvent.LOGIN_FAILURE, {
        strategy: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error as Error };
    }
  }

  async logout(): Promise<void> {
    atProtoClient.logout();
    securityLogger.log(SecurityEvent.LOGOUT, { strategy: this.name });
  }

  async refresh(): Promise<AuthResult> {
    try {
      const session = await atProtoClient.refreshSession();

      if (session) {
        const sealedSession = await sealSession(session);

        securityLogger.log(
          SecurityEvent.SESSION_REFRESH,
          {
            strategy: this.name,
          },
          session.did,
          session.handle,
        );

        return {
          success: true,
          session: sealedSession,
          agent: atProtoClient.agent,
        };
      }

      return { success: false };
    } catch (error) {
      securityLogger.log(SecurityEvent.TOKEN_REFRESH_FAILED, {
        strategy: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error as Error };
    }
  }

  async validate(session: Session): Promise<boolean> {
    const isValid = await validateSession(session);

    if (!isValid) {
      securityLogger.log(
        SecurityEvent.SESSION_VALIDATION_FAILED,
        {
          strategy: this.name,
        },
        session.did,
        session.handle,
      );
    }

    return isValid;
  }
}
```

---

### Fix 2.2: Implement Service Registry

**New File: src/services/ServiceRegistry.ts**

```typescript
/**
 * Service registry for centralized service initialization
 */

import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { appPreferencesService } from "./app-preferences-service";
import {
  bookmarkService,
  initializeBookmarkService,
} from "./bookmark-service-wrapper";
import { columnService } from "./column-service";
import { draftService } from "./draft-service";
import { dmService } from "./dm-service";

interface Service {
  name: string;
  setAgent?: (agent: BskyAgent | null) => void;
  initialize?: (agent: BskyAgent) => Promise<void>;
  shutdown?: () => Promise<void>;
}

class ServiceRegistry {
  private services: Service[] = [
    {
      name: "bookmarks",
      setAgent: (agent) => bookmarkService.setAgent(agent),
      initialize: initializeBookmarkService,
    },
    {
      name: "dm",
      setAgent: (agent) => dmService.setAgent(agent),
    },
    {
      name: "preferences",
      setAgent: (agent) => appPreferencesService.setAgent(agent),
    },
    {
      name: "columns",
      setAgent: (agent) => columnService.setAgent(agent),
    },
    {
      name: "drafts",
      setAgent: (agent) => draftService.setAgent(agent),
    },
  ];

  /**
   * Initialize all services with agent
   */
  async initializeAll(agent: BskyAgent): Promise<void> {
    debug.log("Initializing all services...");

    const initPromises = this.services.map(async (service) => {
      try {
        if (service.initialize) {
          await service.initialize(agent);
        } else if (service.setAgent) {
          service.setAgent(agent);
        }
        debug.log(`✓ ${service.name} initialized`);
      } catch (error) {
        debug.error(`✗ ${service.name} failed to initialize:`, error);
        throw error;
      }
    });

    await Promise.all(initPromises);
    debug.log("All services initialized successfully");
  }

  /**
   * Shutdown all services
   */
  async shutdownAll(): Promise<void> {
    debug.log("Shutting down all services...");

    const shutdownPromises = this.services.map(async (service) => {
      try {
        if (service.shutdown) {
          await service.shutdown();
        } else if (service.setAgent) {
          service.setAgent(null);
        }
        debug.log(`✓ ${service.name} shut down`);
      } catch (error) {
        debug.error(`✗ ${service.name} failed to shut down:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    debug.log("All services shut down");
  }
}

export const serviceRegistry = new ServiceRegistry();
```

---

### Fix 2.3: Simplified AuthContext Using New Abstractions

**Updated AuthContext.tsx (simplified):**

```typescript
/**
 * Simplified AuthContext using strategy pattern
 */

import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { debug, queryClient } from "@bsky/shared";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppPasswordStrategy } from "../auth/strategies/AppPasswordStrategy";
import type { AuthStrategy } from "../auth/strategies/AuthStrategy";
import { OAuthStrategy } from "../auth/strategies/OAuthStrategy";
import { AccountManager } from "../services/account-manager";
import { serviceRegistry } from "../services/ServiceRegistry";
import { setApiAuthSession } from "../utils/api-auth";
import { securityLogger, SecurityEvent } from "../utils/security-logger";

type AuthMethod = "oauth" | "app-password" | null;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  isOAuthAvailable: boolean;
  loginWithOAuth: (handle: string) => Promise<void>;
  handleOAuthCallback: () => Promise<boolean>;
  login: (identifier: string, password: string, pdsUrl?: string, authFactorToken?: string) => Promise<boolean>;
  logout: (logoutAllAccounts?: boolean) => void;
  session: Session | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [isOAuthAvailable, setIsOAuthAvailable] = useState(false);

  // Initialize strategies
  const oauthStrategy = useMemo(() => new OAuthStrategy(), []);
  const appPasswordStrategy = useMemo(() => new AppPasswordStrategy(), []);

  const getCurrentStrategy = useCallback((): AuthStrategy | null => {
    if (authMethod === "oauth") return oauthStrategy;
    if (authMethod === "app-password") return appPasswordStrategy;
    return null;
  }, [authMethod, oauthStrategy, appPasswordStrategy]);

  const logout = useCallback(async (logoutAllAccounts = false) => {
    const strategy = getCurrentStrategy();
    if (strategy) {
      await strategy.logout();
    }

    await serviceRegistry.shutdownAll();
    setIsAuthenticated(false);
    setSession(null);
    setApiAuthSession(null);
    setAuthMethod(null);
    setAgent(null);

    queryClient.clear();

    if (logoutAllAccounts) {
      AccountManager.clearAllAccounts();
    }

    window.location.href = "/";
  }, [getCurrentStrategy]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const strategy = getCurrentStrategy();
    if (!strategy) return false;

    const result = await strategy.refresh();
    if (result.success && result.session) {
      setSession(result.session);
      setApiAuthSession(result.session);
      return true;
    }

    await logout();
    return false;
  }, [getCurrentStrategy, logout]);

  // Initialize auth on mount
  useEffect(() => {
    let abortController = new AbortController();

    const initializeAuth = async () => {
      try {
        // Try OAuth first
        await oauthStrategy.initialize();
        setIsOAuthAvailable(true);

        const oauthResult = await oauthStrategy.refresh();
        if (oauthResult.success && oauthResult.session && oauthResult.agent) {
          setIsAuthenticated(true);
          setAuthMethod("oauth");
          setSession(oauthResult.session);
          setAgent(oauthResult.agent);
          setApiAuthSession(oauthResult.session);

          await serviceRegistry.initializeAll(oauthResult.agent);
          setIsLoading(false);
          return;
        }

        // Fall back to app-password
        const appPasswordResult = await appPasswordStrategy.refresh();
        if (appPasswordResult.success && appPasswordResult.session && appPasswordResult.agent) {
          setIsAuthenticated(true);
          setAuthMethod("app-password");
          setSession(appPasswordResult.session);
          setAgent(appPasswordResult.agent);
          setApiAuthSession(appPasswordResult.session);

          await serviceRegistry.initializeAll(appPasswordResult.agent);
        }
      } catch (error) {
        debug.error("Auth initialization failed:", error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      abortController.abort();
    };
  }, [oauthStrategy, appPasswordStrategy]);

  const login = useCallback(async (
    identifier: string,
    password: string,
    pdsUrl?: string,
    authFactorToken?: string
  ): Promise<boolean> => {
    const result = await appPasswordStrategy.login(identifier, password, pdsUrl, authFactorToken);

    if (result.success && result.session && result.agent) {
      setIsAuthenticated(true);
      setAuthMethod("app-password");
      setSession(result.session);
      setAgent(result.agent);
      setApiAuthSession(result.session);

      await serviceRegistry.initializeAll(result.agent);
      return true;
    }

    throw result.error || new Error("Login failed");
  }, [appPasswordStrategy]);

  const loginWithOAuth = useCallback(async (handle: string): Promise<void> => {
    const result = await oauthStrategy.login(handle);
    if (!result.success) {
      throw result.error || new Error("OAuth login failed");
    }
  }, [oauthStrategy]);

  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    const result = await oauthStrategy.refresh();

    if (result.success && result.session && result.agent) {
      setIsAuthenticated(true);
      setAuthMethod("oauth");
      setSession(result.session);
      setAgent(result.agent);
      setApiAuthSession(result.session);

      await serviceRegistry.initializeAll(result.agent);

      securityLogger.log(SecurityEvent.OAUTH_CALLBACK, { success: true });
      return true;
    }

    securityLogger.log(SecurityEvent.OAUTH_CALLBACK, { success: false });
    return false;
  }, [oauthStrategy]);

  const switchAccount = useCallback(async (did: string): Promise<boolean> => {
    // Implementation similar to original, using strategies
    const account = AccountManager.switchAccount(did);
    if (!account) return false;

    if (account.authMethod === "oauth") {
      window.location.href = "/add-account";
      return false;
    }

    const result = await appPasswordStrategy.refresh();
    if (result.success && result.session && result.agent) {
      setIsAuthenticated(true);
      setAuthMethod("app-password");
      setSession(result.session);
      setAgent(result.agent);
      setApiAuthSession(result.session);

      await serviceRegistry.initializeAll(result.agent);
      queryClient.clear();

      window.location.href = "/";
      return true;
    }

    return false;
  }, [appPasswordStrategy]);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    isLoading,
    authMethod,
    isOAuthAvailable,
    loginWithOAuth,
    handleOAuthCallback,
    login,
    logout,
    session,
    agent: isAuthenticated ? agent : null,
    refreshSession,
    switchAccount,
  }), [
    isAuthenticated,
    isLoading,
    authMethod,
    isOAuthAvailable,
    loginWithOAuth,
    handleOAuthCallback,
    login,
    logout,
    session,
    agent,
    refreshSession,
    switchAccount,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## Phase 3: Additional Hardening (Week 3-4)

### Fix 3.1: Add Rate Limiting

**New File: src/utils/rate-limiter.ts**

```typescript
/**
 * Client-side rate limiter for authentication attempts
 */

export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  canAttempt(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside window
    const recentAttempts = attempts.filter(
      (time) => now - time < this.windowMs,
    );
    this.attempts.set(key, recentAttempts);

    return recentAttempts.length < this.maxAttempts;
  }

  recordAttempt(key: string): void {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    attempts.push(now);
    this.attempts.set(key, attempts);
  }

  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(
      (time) => now - time < this.windowMs,
    );
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  getWaitTime(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(
      (time) => now - time < this.windowMs,
    );

    if (recentAttempts.length < this.maxAttempts) {
      return 0;
    }

    const oldestAttempt = Math.min(...recentAttempts);
    return Math.max(0, this.windowMs - (now - oldestAttempt));
  }
}

export const loginRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute
```

---

### Fix 3.2: Add Session Health Monitoring

**New File: src/utils/session-monitor.ts**

```typescript
/**
 * Session health monitoring
 * Validates session when user returns to tab
 */

import { debug } from "@bsky/shared";
import type { Session } from "@bsky/shared";

export class SessionMonitor {
  private checkInterval: number = 5 * 60 * 1000; // 5 minutes
  private intervalId: number | null = null;
  private onSessionInvalid?: () => void;

  start(validateSession: () => Promise<boolean>, onInvalid: () => void): void {
    this.onSessionInvalid = onInvalid;

    // Check on visibility change
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        const isValid = await validateSession();
        if (!isValid) {
          debug.error("Session invalid after visibility change");
          this.onSessionInvalid?.();
        }
      }
    });

    // Check on window focus
    window.addEventListener("focus", async () => {
      const isValid = await validateSession();
      if (!isValid) {
        debug.error("Session invalid after window focus");
        this.onSessionInvalid?.();
      }
    });

    // Periodic check
    this.intervalId = window.setInterval(async () => {
      const isValid = await validateSession();
      if (!isValid) {
        debug.error("Session invalid during periodic check");
        this.onSessionInvalid?.();
      }
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const sessionMonitor = new SessionMonitor();
```

---

## Testing Strategy

### Unit Tests

```typescript
// session-validator.test.ts
describe("SessionValidator", () => {
  it("should validate sealed sessions", async () => {
    const session = { did: "did:plc:test", handle: "test.bsky.social", ... };
    const sealed = await sealSession(session);
    const isValid = await validateSession(sealed);
    expect(isValid).toBe(true);
  });

  it("should detect tampered sessions", async () => {
    const session = { did: "did:plc:test", handle: "test.bsky.social", ... };
    const sealed = await sealSession(session);
    (sealed as any).did = "did:plc:attacker";
    const isValid = await validateSession(sealed);
    expect(isValid).toBe(false);
  });
});

// rate-limiter.test.ts
describe("RateLimiter", () => {
  it("should allow attempts within limit", () => {
    const limiter = new RateLimiter(3, 60000);
    expect(limiter.canAttempt("test")).toBe(true);
    limiter.recordAttempt("test");
    limiter.recordAttempt("test");
    limiter.recordAttempt("test");
    expect(limiter.canAttempt("test")).toBe(false);
  });
});
```

### Integration Tests

```typescript
// auth-flow.test.ts
describe("Authentication Flow", () => {
  it("should login with app password", async () => {
    const strategy = new AppPasswordStrategy();
    const result = await strategy.login("user.bsky.social", "password");
    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
  });

  it("should validate session after login", async () => {
    const strategy = new AppPasswordStrategy();
    const result = await strategy.login("user.bsky.social", "password");
    const isValid = await strategy.validate(result.session!);
    expect(isValid).toBe(true);
  });
});
```

### Security Tests

```typescript
// security.test.ts
describe("Security", () => {
  it("should encrypt tokens at rest", async () => {
    const session = { did: "did:plc:test", accessJwt: "secret", ... };
    await secureStorage.saveSession(session);

    const raw = sessionStorage.getItem("bsky_secure_session");
    expect(raw).not.toContain("secret");
  });

  it("should prevent session property modification", async () => {
    const agent = {} as any;
    Object.defineProperty(agent, "session", {
      value: { did: "test" },
      configurable: false,
    });

    expect(() => {
      Object.defineProperty(agent, "session", {
        value: { did: "attacker" },
      });
    }).toThrow();
  });
});
```

---

## Migration Plan

### Step 1: Add New Utilities (No Breaking Changes)

- Add session-validator.ts
- Add security-logger.ts
- Add secure-storage.ts
- Add rate-limiter.ts
- Add session-monitor.ts

### Step 2: Add Strategy Pattern (Parallel Implementation)

- Add AuthStrategy.ts
- Add OAuthStrategy.ts
- Add AppPasswordStrategy.ts
- Add ServiceRegistry.ts

### Step 3: Update AuthContext (Use New Utilities)

- Update Object.defineProperty calls
- Add validation calls
- Add security logging
- Add rate limiting

### Step 4: Refactor to Strategy Pattern (Breaking Change)

- Replace direct OAuth/app-password logic with strategies
- Replace manual service initialization with ServiceRegistry
- Simplify state management

### Step 5: Testing & Validation

- Run full test suite
- Manual testing of all auth flows
- Security testing
- Performance testing

### Step 6: Monitor & Iterate

- Monitor security logs
- Track error rates
- Collect user feedback
- Iterate on improvements

---

## Success Metrics

### Security Metrics

- Zero XSS-related token theft incidents
- Zero session tampering incidents
- 100% of security events logged
- All sessions encrypted at rest

### Code Quality Metrics

- Reduced cyclomatic complexity (from ~30 to <10)
- Reduced file size (from 627 to ~300 lines)
- Increased test coverage (target: 80%+)
- Reduced churn rate (target: <5 changes/14 days)

### Performance Metrics

- Auth initialization time <1s
- No increase in bundle size
- Reduced memory footprint
- Faster hot reload in development

---

## Rollback Plan

If issues arise:

1. **Phase 1 Rollback:** Revert individual utility functions
2. **Phase 2 Rollback:** Keep old AuthContext, remove strategies
3. **Phase 3 Rollback:** Disable rate limiting/monitoring

Each phase should be behind feature flags for easy rollback.

---

## Documentation Updates Needed

1. Update AUTH.md with new architecture
2. Document security best practices
3. Add API documentation for strategies
4. Update developer onboarding guide
5. Create security incident response guide

---

## Timeline Summary

| Phase         | Duration | Deliverables            |
| ------------- | -------- | ----------------------- |
| Phase 1       | Week 1   | Critical security fixes |
| Phase 2       | Week 2-3 | Architecture refactor   |
| Phase 3       | Week 3-4 | Additional hardening    |
| Testing       | Week 4   | Full test coverage      |
| Documentation | Week 4   | Complete docs           |

**Total Estimated Time:** 3-4 weeks with 1 developer

---

## Questions & Considerations

1. **Token Storage:** Should we use HttpOnly cookies for production? (Requires backend support)
2. **Encryption Keys:** Where to persist encryption keys long-term?
3. **Breaking Changes:** Can we accept breaking changes to existing auth flows?
4. **Backward Compatibility:** How long to support old session formats?
5. **Monitoring:** Which monitoring service to integrate with?

---

**Next Steps:**

1. Review this plan with team
2. Get approval for breaking changes
3. Create feature flags for gradual rollout
4. Begin Phase 1 implementation
5. Set up monitoring/alerting
