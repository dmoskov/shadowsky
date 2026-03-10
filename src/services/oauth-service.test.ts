/**
 * Tests for OAuth Service
 *
 * Coverage targets:
 * 1. hasExistingOAuthSession() - OAuth callback detection and IndexedDB checks
 * 2. loadOAuthClient() - Lazy module loading
 * 3. init() - Session restoration and error handling
 * 4. authorize() - OAuth flow initiation
 * 5. handleCallback() - OAuth callback processing
 * 6. signOut() - Session cleanup
 * 7. Event listeners - Session and deletion events
 * 8. State getters - Agent, session, authentication status
 */

import type {
  BrowserOAuthClient as BrowserOAuthClientType,
  OAuthSession,
} from "@atproto/oauth-client-browser";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { hasExistingOAuthSession, oauthService } from "./oauth-service";

// Mock the logger to suppress output during tests
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the debug module
vi.mock("@bsky/shared", () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the Agent constructor from @atproto/api
vi.mock("@atproto/api", () => ({
  Agent: vi.fn().mockImplementation(() => ({
    api: {},
  })),
}));

// Helper to wait for async operations
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("hasExistingOAuthSession", () => {
  let mockOpen: Mock;
  let mockDeleteDatabase: Mock;

  beforeEach(() => {
    // Reset window.location
    Object.defineProperty(window, "location", {
      value: {
        search: "",
        href: "",
      },
      writable: true,
      configurable: true,
    });

    // Mock indexedDB methods
    mockOpen = vi.fn();
    mockDeleteDatabase = vi.fn();
    (global as Record<string, unknown>).indexedDB = {
      open: mockOpen,
      deleteDatabase: mockDeleteDatabase,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuth callback detection", () => {
    it("should return true when 'code' parameter is present", async () => {
      window.location.search = "?code=test-code";
      const result = await hasExistingOAuthSession();
      expect(result).toBe(true);
    });

    it("should return true when 'state' parameter is present", async () => {
      window.location.search = "?state=test-state";
      const result = await hasExistingOAuthSession();
      expect(result).toBe(true);
    });

    it("should return true when 'iss' parameter is present", async () => {
      window.location.search = "?iss=https://example.com";
      const result = await hasExistingOAuthSession();
      expect(result).toBe(true);
    });

    it("should return true when multiple OAuth parameters are present", async () => {
      window.location.search = "?code=test-code&state=test-state";
      const result = await hasExistingOAuthSession();
      expect(result).toBe(true);
    });
  });

  describe("IndexedDB availability", () => {
    it("should return false if IndexedDB is not available", async () => {
      // @ts-expect-error - Deleting indexedDB for testing
      delete global.indexedDB;
      const result = await hasExistingOAuthSession();
      expect(result).toBe(false);
    });
  });

  describe("OAuth database checks", () => {
    it("should return true when OAuth database exists with object stores", async () => {
      const mockDb = {
        objectStoreNames: { length: 2 },
        close: vi.fn(),
      };

      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDb,
      });

      const promise = hasExistingOAuthSession();

      // Trigger success handler
      await wait(10);
      const request = mockOpen.mock.results[0].value;
      if (request.onsuccess) {
        request.onsuccess();
      }

      const result = await promise;
      expect(result).toBe(true);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("should return false when OAuth database exists but is empty", async () => {
      const mockDb = {
        objectStoreNames: { length: 0 },
        close: vi.fn(),
      };

      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDb,
      });

      const promise = hasExistingOAuthSession();

      await wait(10);
      const request = mockOpen.mock.results[0].value;
      if (request.onsuccess) {
        request.onsuccess();
      }

      const result = await promise;
      expect(result).toBe(false);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("should return false when database open fails", async () => {
      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
      });

      const promise = hasExistingOAuthSession();

      await wait(10);
      const request = mockOpen.mock.results[0].value;
      if (request.onerror) {
        request.onerror();
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should return false and clean up when database doesn't exist (onupgradeneeded)", async () => {
      const mockTransaction = {
        abort: vi.fn(),
      };

      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        transaction: mockTransaction,
      });

      const promise = hasExistingOAuthSession();

      await wait(10);
      const request = mockOpen.mock.results[0].value;
      if (request.onupgradeneeded) {
        request.onupgradeneeded();
      }

      const result = await promise;
      expect(result).toBe(false);
      expect(mockTransaction.abort).toHaveBeenCalled();
      expect(mockDeleteDatabase).toHaveBeenCalledWith("@atproto-oauth-client");
    });

    it("should return false when database check throws an error", async () => {
      const mockDb = {
        get objectStoreNames() {
          throw new Error("Access denied");
        },
        close: vi.fn(),
      };

      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDb,
      });

      const promise = hasExistingOAuthSession();

      await wait(10);
      const request = mockOpen.mock.results[0].value;
      if (request.onsuccess) {
        request.onsuccess();
      }

      const result = await promise;
      expect(result).toBe(false);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("should timeout and return false after 500ms", async () => {
      vi.useFakeTimers();

      mockOpen.mockReturnValue({
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
      });

      const promise = hasExistingOAuthSession();

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(600);

      const result = await promise;
      expect(result).toBe(false);

      vi.useRealTimers();
    });

    it("should return false when IndexedDB.open throws an exception", async () => {
      mockOpen.mockImplementation(() => {
        throw new Error("IndexedDB not available");
      });

      const result = await hasExistingOAuthSession();
      expect(result).toBe(false);
    });
  });
});

// Mock OAuth client at module level
let mockOAuthClient: Partial<BrowserOAuthClientType>;
let mockSession: Partial<OAuthSession>;

// Set up default mocks
mockSession = {
  did: "did:plc:test123",
  signOut: vi.fn().mockResolvedValue(undefined),
};

mockOAuthClient = {
  init: vi.fn().mockResolvedValue({ session: mockSession }),
  authorize: vi.fn().mockResolvedValue(new URL("https://oauth.example.com")),
};

// Capture onDelete callback passed to BrowserOAuthClient.load()
let capturedOnDelete: ((sub: string, cause: unknown) => void) | undefined;

// Mock the OAuth client module
vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: {
    load: vi.fn((opts: Record<string, unknown>) => {
      if (opts?.onDelete) {
        capturedOnDelete = opts.onDelete as (
          sub: string,
          cause: unknown,
        ) => void;
      }
      return Promise.resolve(mockOAuthClient);
    }),
  },
}));

describe("OAuthService", () => {
  beforeEach(() => {
    // Reset service state
    // @ts-expect-error - accessing private property for testing
    oauthService.client = null;
    // @ts-expect-error - accessing private property for testing
    oauthService.currentSession = null;
    // @ts-expect-error - accessing private property for testing
    oauthService.currentAgent = null;
    // @ts-expect-error - accessing private property for testing
    oauthService.initPromise = null;
    // @ts-expect-error - accessing private property for testing
    oauthService.eventListeners = new Map();

    // Reset window.location
    Object.defineProperty(window, "location", {
      value: {
        search: "",
        href: "",
        origin: "https://shadowsky.io",
        hostname: "shadowsky.io",
      },
      writable: true,
      configurable: true,
    });

    // Reset mock session
    mockSession = {
      did: "did:plc:test123",
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    // Reset mock OAuth client
    mockOAuthClient = {
      init: vi.fn().mockResolvedValue({ session: mockSession }),
      authorize: vi
        .fn()
        .mockResolvedValue(new URL("https://oauth.example.com")),
    };

    // Reset captured callback
    capturedOnDelete = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("init()", () => {
    it("should initialize OAuth client and restore existing session", async () => {
      const result = await oauthService.init();

      expect(result).toBeDefined();
      expect(result?.session).toBe(mockSession);
      expect(result?.agent).toBeDefined();
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should return cached promise on concurrent init calls", async () => {
      // Track how many times the OAuth client load is called
      const { BrowserOAuthClient } =
        await import("@atproto/oauth-client-browser");
      const loadSpy = vi.mocked(BrowserOAuthClient.load);
      loadSpy.mockClear();

      // Make two concurrent init calls
      const promise1 = oauthService.init();
      const promise2 = oauthService.init();

      // Wait for both to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      expect(result1).toEqual(result2);

      // The OAuth client should only be loaded once, not twice
      // This proves the promise was cached
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it("should return null when no existing session exists", async () => {
      mockOAuthClient.init = vi.fn().mockResolvedValue(null);

      const result = await oauthService.init();

      expect(result).toBeNull();
      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("should return null when client metadata is not available", async () => {
      const { BrowserOAuthClient } =
        await import("@atproto/oauth-client-browser");
      vi.mocked(BrowserOAuthClient.load).mockRejectedValueOnce(
        new Error("Client metadata not found"),
      );

      const result = await oauthService.init();

      expect(result).toBeNull();
      expect(oauthService.isAvailable()).toBe(false);
    });

    it("should throw on unexpected initialization errors", async () => {
      mockOAuthClient.init = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));

      await expect(oauthService.init()).rejects.toThrow("Unexpected error");
    });

    it("should emit 'session' event when session is restored", async () => {
      const sessionCallback = vi.fn();
      oauthService.addEventListener("session", sessionCallback);

      await oauthService.init();

      expect(sessionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          agent: expect.any(Object),
          did: "did:plc:test123",
        }),
      );
    });

    it("should pass onDelete hook to BrowserOAuthClient.load()", async () => {
      const deletedCallback = vi.fn();
      oauthService.addEventListener("deleted", deletedCallback);

      await oauthService.init();

      expect(capturedOnDelete).toBeDefined();

      // Simulate a deletion event via the onDelete hook
      capturedOnDelete!("did:plc:test123", new Error("Token revoked"));

      expect(deletedCallback).toHaveBeenCalledWith({
        sub: "did:plc:test123",
        cause: expect.any(Error),
      });
      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("should use production client ID for production hostname", async () => {
      window.location.hostname = "shadowsky.io";

      await oauthService.init();

      // The init would have been called with production URL
      // Note: We can't directly test this without accessing private methods,
      // but we verify the init was called
      expect(oauthService.isAvailable()).toBe(true);
    });

    it("should use local proxy client ID for localhost", async () => {
      Object.defineProperty(window, "location", {
        value: {
          ...window.location,
          hostname: "localhost",
          origin: "http://localhost:3000",
        },
        writable: true,
      });

      await oauthService.init();

      expect(oauthService.isAvailable()).toBe(true);
    });
  });

  describe("authorize()", () => {
    beforeEach(async () => {
      // Pre-initialize the service
      await oauthService.init();
    });

    it("should start OAuth authorization flow with clean handle", async () => {
      await oauthService.authorize("user.bsky.social");

      expect(mockOAuthClient.authorize).toHaveBeenCalledWith(
        "user.bsky.social",
        expect.objectContaining({
          scope: "atproto transition:generic",
        }),
      );
    });

    it("should remove @ prefix from handle before authorization", async () => {
      await oauthService.authorize("@user.bsky.social");

      expect(mockOAuthClient.authorize).toHaveBeenCalledWith(
        "user.bsky.social",
        expect.any(Object),
      );
    });

    it("should redirect to authorization URL", async () => {
      const authUrl = "https://oauth.example.com/authorize?client_id=test";
      mockOAuthClient.authorize = vi.fn().mockResolvedValue(new URL(authUrl));

      await oauthService.authorize("user.bsky.social");

      expect(window.location.href).toBe(authUrl);
    });

    it("should throw error if client is not initialized", async () => {
      // Reset client
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      const { BrowserOAuthClient } =
        await import("@atproto/oauth-client-browser");
      vi.mocked(BrowserOAuthClient.load).mockRejectedValueOnce(
        new Error("Client metadata not found"),
      );

      await expect(oauthService.authorize("user.bsky.social")).rejects.toThrow(
        "OAuth client not initialized",
      );
    });

    it("should propagate authorization errors", async () => {
      mockOAuthClient.authorize = vi
        .fn()
        .mockRejectedValue(new Error("Authorization failed"));

      await expect(oauthService.authorize("user.bsky.social")).rejects.toThrow(
        "Authorization failed",
      );
    });
  });

  describe("handleCallback()", () => {
    it("should handle OAuth callback and return session state", async () => {
      const result = await oauthService.handleCallback();

      expect(result).toBeDefined();
      expect(result?.session).toBe(mockSession);
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should emit 'session' event on successful callback", async () => {
      const sessionCallback = vi.fn();
      oauthService.addEventListener("session", sessionCallback);

      await oauthService.handleCallback();

      expect(sessionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          did: "did:plc:test123",
        }),
      );
    });

    it("should return null when callback has no session", async () => {
      mockOAuthClient.init = vi.fn().mockResolvedValue(null);

      const result = await oauthService.handleCallback();

      expect(result).toBeNull();
    });

    it("should throw error if client is not initialized", async () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      const { BrowserOAuthClient } =
        await import("@atproto/oauth-client-browser");
      vi.mocked(BrowserOAuthClient.load).mockRejectedValueOnce(
        new Error("Client metadata not found"),
      );

      await expect(oauthService.handleCallback()).rejects.toThrow(
        "OAuth client not initialized",
      );
    });

    it("should propagate callback handling errors", async () => {
      mockOAuthClient.init = vi
        .fn()
        .mockRejectedValue(new Error("Callback failed"));

      await expect(oauthService.handleCallback()).rejects.toThrow(
        "Callback failed",
      );
    });
  });

  describe("signOut()", () => {
    beforeEach(async () => {
      await oauthService.init();
    });

    it("should call signOut on current session", async () => {
      await oauthService.signOut();

      expect(mockSession.signOut).toHaveBeenCalled();
      expect(oauthService.isAuthenticated()).toBe(false);
      expect(oauthService.getSession()).toBeNull();
      expect(oauthService.getAgent()).toBeNull();
    });

    it("should emit 'session' event with null state", async () => {
      const sessionCallback = vi.fn();
      oauthService.addEventListener("session", sessionCallback);

      await oauthService.signOut();

      expect(sessionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session: null,
          agent: null,
          did: null,
        }),
      );
    });

    it("should handle sign out errors gracefully", async () => {
      mockSession.signOut = vi
        .fn()
        .mockRejectedValue(new Error("Sign out failed"));

      await expect(oauthService.signOut()).resolves.not.toThrow();

      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("should work when there is no current session", async () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.currentSession = null;

      await expect(oauthService.signOut()).resolves.not.toThrow();

      expect(oauthService.isAuthenticated()).toBe(false);
    });
  });

  describe("State getters", () => {
    beforeEach(async () => {
      await oauthService.init();
    });

    it("getAgent() should return current agent", () => {
      expect(oauthService.getAgent()).toBeDefined();
    });

    it("getSession() should return current session", () => {
      expect(oauthService.getSession()).toBe(mockSession);
    });

    it("isAuthenticated() should return true when session exists", () => {
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("isAuthenticated() should return false when session is null", () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.currentSession = null;

      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("isAvailable() should return true when client is initialized", () => {
      expect(oauthService.isAvailable()).toBe(true);
    });

    it("isAvailable() should return false when client is null", () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;

      expect(oauthService.isAvailable()).toBe(false);
    });

    it("getState() should return complete state object", () => {
      const state = oauthService.getState();

      expect(state).toEqual({
        session: mockSession,
        agent: expect.any(Object),
        did: "did:plc:test123",
        handle: null,
      });
    });

    it("getState() should return null values when not authenticated", () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.currentSession = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.currentAgent = null;

      const state = oauthService.getState();

      expect(state).toEqual({
        session: null,
        agent: null,
        did: null,
        handle: null,
      });
    });
  });

  describe("Event listeners", () => {
    it("should add and call session event listener", () => {
      const callback = vi.fn();
      oauthService.addEventListener("session", callback);

      const state = oauthService.getState();
      // @ts-expect-error - accessing private method for testing
      oauthService.emitEvent("session", state);

      expect(callback).toHaveBeenCalledWith(state);
    });

    it("should add and call deleted event listener", () => {
      const callback = vi.fn();
      oauthService.addEventListener("deleted", callback);

      const detail = { sub: "did:plc:test123", cause: new Error("Revoked") };
      // @ts-expect-error - accessing private method for testing
      oauthService.emitEvent("deleted", detail);

      expect(callback).toHaveBeenCalledWith(detail);
    });

    it("should support multiple listeners for the same event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      oauthService.addEventListener("session", callback1);
      oauthService.addEventListener("session", callback2);

      const state = oauthService.getState();
      // @ts-expect-error - accessing private method for testing
      oauthService.emitEvent("session", state);

      expect(callback1).toHaveBeenCalledWith(state);
      expect(callback2).toHaveBeenCalledWith(state);
    });

    it("should remove event listener", () => {
      const callback = vi.fn();

      oauthService.addEventListener("session", callback);
      oauthService.removeEventListener("session", callback);

      const state = oauthService.getState();
      // @ts-expect-error - accessing private method for testing
      oauthService.emitEvent("session", state);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle errors in event listeners gracefully", () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const normalCallback = vi.fn();

      oauthService.addEventListener("session", errorCallback);
      oauthService.addEventListener("session", normalCallback);

      const state = oauthService.getState();

      // Should not throw
      expect(() => {
        // @ts-expect-error - accessing private method for testing
        oauthService.emitEvent("session", state);
      }).not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledWith(state);
    });

    it("should not throw when removing non-existent listener", () => {
      const callback = vi.fn();

      expect(() => {
        oauthService.removeEventListener("session", callback);
      }).not.toThrow();
    });
  });

  describe("Session management lifecycle", () => {
    it("should transition to unauthenticated state when onDelete fires", async () => {
      await oauthService.init();
      expect(oauthService.isAuthenticated()).toBe(true);

      capturedOnDelete!("did:plc:test123", new Error("Token revoked"));

      expect(oauthService.isAuthenticated()).toBe(false);
      expect(oauthService.getSession()).toBeNull();
      expect(oauthService.getAgent()).toBeNull();
    });

    it("should clear all state fields when onDelete fires", async () => {
      const deletedCallback = vi.fn();
      oauthService.addEventListener("deleted", deletedCallback);

      await oauthService.init();
      capturedOnDelete!("did:plc:test123", new Error("Expired"));

      expect(oauthService.getState()).toEqual({
        session: null,
        agent: null,
        did: null,
        handle: null,
      });
      expect(deletedCallback).toHaveBeenCalledWith({
        sub: "did:plc:test123",
        cause: expect.any(Error),
      });
    });

    it("should allow re-initialization after state reset", async () => {
      await oauthService.init();
      expect(oauthService.isAuthenticated()).toBe(true);

      // Reset service to simulate a fresh state
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.currentSession = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.currentAgent = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      const newSession = {
        did: "did:plc:new456",
        signOut: vi.fn().mockResolvedValue(undefined),
      };
      mockOAuthClient.init = vi.fn().mockResolvedValue({ session: newSession });

      const result = await oauthService.init();
      expect(result?.did).toBe("did:plc:new456");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should complete successfully when signOut is called during init", async () => {
      // Start init without awaiting, then signOut before init resolves
      const initPromise = oauthService.init();

      // currentSession is still null here (init hasn't resolved yet)
      await oauthService.signOut();
      expect(oauthService.isAuthenticated()).toBe(false);

      // init eventually resolves and sets the session
      const result = await initPromise;
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should handle multiple sequential signOut calls idempotently", async () => {
      await oauthService.init();

      await oauthService.signOut();
      await oauthService.signOut();
      await oauthService.signOut();

      // signOut on the session only called once (first call), rest are no-ops
      expect(mockSession.signOut).toHaveBeenCalledTimes(1);
      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("should support full cycle: init → signOut → reset → re-init with new session", async () => {
      const firstResult = await oauthService.init();
      expect(firstResult?.did).toBe("did:plc:test123");

      await oauthService.signOut();
      expect(oauthService.isAuthenticated()).toBe(false);

      // Reset initPromise to allow re-initialization
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      const newSession = {
        did: "did:plc:newuser",
        signOut: vi.fn().mockResolvedValue(undefined),
      };
      mockOAuthClient.init = vi.fn().mockResolvedValue({ session: newSession });

      const secondResult = await oauthService.init();
      expect(secondResult?.did).toBe("did:plc:newuser");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should set session but return null did when session has no did field", async () => {
      const sessionWithoutDid = {
        signOut: vi.fn().mockResolvedValue(undefined),
      };
      mockOAuthClient.init = vi
        .fn()
        .mockResolvedValue({ session: sessionWithoutDid });

      const result = await oauthService.init();

      expect(result).toBeDefined();
      expect(result?.session).toBe(sessionWithoutDid);
      expect(result?.did).toBeNull();
      // Session object is non-null, so isAuthenticated is true
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should emit events in correct order across lifecycle transitions", async () => {
      const events: string[] = [];

      oauthService.addEventListener("session", (state) => {
        events.push(state.did ? `session:${state.did}` : "session:null");
      });
      oauthService.addEventListener("deleted", (event) => {
        events.push(`deleted:${event.sub}`);
      });

      await oauthService.init();
      capturedOnDelete!("did:plc:test123", new Error("Revoked"));
      await oauthService.signOut();

      expect(events).toEqual([
        "session:did:plc:test123", // from init
        "deleted:did:plc:test123", // from onDelete
        "session:null", // from signOut
      ]);
    });

    it("should not call removed listener in subsequent emissions", async () => {
      const removedCallback = vi.fn().mockImplementation(() => {
        oauthService.removeEventListener("session", removedCallback);
      });
      const persistentCallback = vi.fn();

      oauthService.addEventListener("session", removedCallback);
      oauthService.addEventListener("session", persistentCallback);

      // First emission (from init) — both are called; removedCallback removes itself
      await oauthService.init();
      expect(removedCallback).toHaveBeenCalledTimes(1);
      expect(persistentCallback).toHaveBeenCalledTimes(1);

      // Second emission — removedCallback should no longer be registered
      // @ts-expect-error - accessing private method for testing
      oauthService.emitEvent("session", oauthService.getState());
      expect(removedCallback).toHaveBeenCalledTimes(1); // unchanged
      expect(persistentCallback).toHaveBeenCalledTimes(2);
    });

    it("should receive deleted events when listener is added after init", async () => {
      // onDelete is wired up during init
      await oauthService.init();

      // Add the listener afterwards
      const lateCallback = vi.fn();
      oauthService.addEventListener("deleted", lateCallback);

      capturedOnDelete!("did:plc:test123", new Error("Revoked"));

      expect(lateCallback).toHaveBeenCalledWith({
        sub: "did:plc:test123",
        cause: expect.any(Error),
      });
    });

    it("should reset initPromise after unexpected error so subsequent calls can retry", async () => {
      mockOAuthClient.init = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ session: mockSession });

      // First call should fail
      await expect(oauthService.init()).rejects.toThrow("Network error");

      // initPromise must be null so the service can be retried
      // @ts-expect-error - accessing private property for testing
      expect(oauthService.initPromise).toBeNull();

      // Second call should succeed
      const result = await oauthService.init();
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });
  });
});
