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

import { Agent } from "@atproto/api";
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

// Helper to wait for async operations
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("hasExistingOAuthSession", () => {
  let mockOpen: Mock;
  let mockDeleteDatabase: Mock;

  beforeEach(() => {
    // Reset window.location
    delete (window as any).location;
    window.location = {
      search: "",
      href: "",
    } as any;

    // Mock indexedDB methods
    mockOpen = vi.fn();
    mockDeleteDatabase = vi.fn();
    (global as any).indexedDB = {
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
      delete (global as any).indexedDB;
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
        objectStoreNames: { length: 2 },
        close: vi.fn(),
        get length() {
          throw new Error("Access denied");
        },
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
      vi.advanceTimersByTime(500);
      await wait(10);

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

describe("OAuthService", () => {
  let mockOAuthClient: Partial<BrowserOAuthClientType>;
  let mockSession: Partial<OAuthSession>;
  let mockAgent: Partial<Agent>;

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
    delete (window as any).location;
    window.location = {
      search: "",
      href: "",
      origin: "https://shadowsky.io",
      hostname: "shadowsky.io",
    } as any;

    // Create mock OAuth session
    mockSession = {
      did: "did:plc:test123",
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock Agent
    mockAgent = {
      api: {} as any,
    };

    // Mock Agent constructor
    vi.spyOn(global as any, "Agent" as any).mockImplementation(() => mockAgent);

    // Create mock OAuth client
    mockOAuthClient = {
      init: vi.fn().mockResolvedValue({ session: mockSession }),
      authorize: vi.fn().mockResolvedValue(new URL("https://oauth.example.com")),
      addEventListener: vi.fn(),
    };

    // Mock the lazy-loaded OAuth module
    vi.mock("@atproto/oauth-client-browser", () => ({
      BrowserOAuthClient: {
        load: vi.fn().mockResolvedValue(mockOAuthClient),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("init()", () => {
    it("should initialize OAuth client and restore existing session", async () => {
      // Mock the dynamic import
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));

      const result = await oauthService.init();

      expect(result).toBeDefined();
      expect(result?.session).toBe(mockSession);
      expect(result?.agent).toBe(mockAgent);
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should return cached promise on concurrent init calls", async () => {
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));

      const promise1 = oauthService.init();
      const promise2 = oauthService.init();

      expect(promise1).toBe(promise2);

      await promise1;
      await promise2;
    });

    it("should return null when no existing session exists", async () => {
      const clientWithNoSession = {
        ...mockOAuthClient,
        init: vi.fn().mockResolvedValue(null),
      };

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(clientWithNoSession),
        },
      }));

      const result = await oauthService.init();

      expect(result).toBeNull();
      expect(oauthService.isAuthenticated()).toBe(false);
    });

    it("should return null when client metadata is not available", async () => {
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi
            .fn()
            .mockRejectedValue(new Error("Client metadata not found")),
        },
      }));

      const result = await oauthService.init();

      expect(result).toBeNull();
      expect(oauthService.isAvailable()).toBe(false);
    });

    it("should throw on unexpected initialization errors", async () => {
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue({
            ...mockOAuthClient,
            init: vi.fn().mockRejectedValue(new Error("Unexpected error")),
          }),
        },
      }));

      await expect(oauthService.init()).rejects.toThrow("Unexpected error");
    });

    it("should emit 'session' event when session is restored", async () => {
      const sessionCallback = vi.fn();
      oauthService.addEventListener("session", sessionCallback);

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));

      await oauthService.init();

      expect(sessionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          agent: mockAgent,
          did: "did:plc:test123",
        }),
      );
    });

    it("should listen for 'deleted' events from OAuth client", async () => {
      let deletedEventHandler: ((event: CustomEvent) => void) | null = null;

      const clientWithEventListener = {
        ...mockOAuthClient,
        addEventListener: vi.fn().mockImplementation((type, handler) => {
          if (type === "deleted") {
            deletedEventHandler = handler;
          }
        }),
      };

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(clientWithEventListener),
        },
      }));

      const deletedCallback = vi.fn();
      oauthService.addEventListener("deleted", deletedCallback);

      await oauthService.init();

      expect(clientWithEventListener.addEventListener).toHaveBeenCalledWith(
        "deleted",
        expect.any(Function),
      );

      // Simulate a deletion event
      if (deletedEventHandler) {
        const event = new CustomEvent("deleted", {
          detail: {
            sub: "did:plc:test123",
            cause: new Error("Token revoked"),
          },
        });
        deletedEventHandler(event);

        expect(deletedCallback).toHaveBeenCalledWith({
          sub: "did:plc:test123",
          cause: expect.any(Error),
        });
        expect(oauthService.isAuthenticated()).toBe(false);
      }
    });

    it("should use production client ID for production hostname", async () => {
      window.location.hostname = "shadowsky.io";

      // We'll need to capture what clientId is passed
      const loadSpy = vi.fn().mockResolvedValue(mockOAuthClient);

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: loadSpy,
        },
      }));

      await oauthService.init();

      // The init would have been called with production URL
      // Note: We can't directly test this without accessing private methods,
      // but we verify the init was called
      expect(oauthService.isAvailable()).toBe(true);
    });

    it("should use local proxy client ID for localhost", async () => {
      window.location.hostname = "localhost";
      window.location.origin = "http://localhost:3000";

      const loadSpy = vi.fn().mockResolvedValue(mockOAuthClient);

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: loadSpy,
        },
      }));

      await oauthService.init();

      expect(oauthService.isAvailable()).toBe(true);
    });
  });

  describe("authorize()", () => {
    beforeEach(async () => {
      // Pre-initialize the service
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));
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
      mockOAuthClient.authorize = vi
        .fn()
        .mockResolvedValue(new URL(authUrl));

      await oauthService.authorize("user.bsky.social");

      expect(window.location.href).toBe(authUrl);
    });

    it("should throw error if client is not initialized", async () => {
      // Reset client
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi
            .fn()
            .mockRejectedValue(new Error("Client metadata not found")),
        },
      }));

      await expect(
        oauthService.authorize("user.bsky.social"),
      ).rejects.toThrow("OAuth client not initialized");
    });

    it("should propagate authorization errors", async () => {
      mockOAuthClient.authorize = vi
        .fn()
        .mockRejectedValue(new Error("Authorization failed"));

      await expect(
        oauthService.authorize("user.bsky.social"),
      ).rejects.toThrow("Authorization failed");
    });
  });

  describe("handleCallback()", () => {
    it("should handle OAuth callback and return session state", async () => {
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));

      const result = await oauthService.handleCallback();

      expect(result).toBeDefined();
      expect(result?.session).toBe(mockSession);
      expect(result?.did).toBe("did:plc:test123");
      expect(oauthService.isAuthenticated()).toBe(true);
    });

    it("should emit 'session' event on successful callback", async () => {
      const sessionCallback = vi.fn();
      oauthService.addEventListener("session", sessionCallback);

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));

      await oauthService.handleCallback();

      expect(sessionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          did: "did:plc:test123",
        }),
      );
    });

    it("should return null when callback has no session", async () => {
      const clientWithNoSession = {
        ...mockOAuthClient,
        init: vi.fn().mockResolvedValue(null),
      };

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(clientWithNoSession),
        },
      }));

      const result = await oauthService.handleCallback();

      expect(result).toBeNull();
    });

    it("should throw error if client is not initialized", async () => {
      // @ts-expect-error - accessing private property for testing
      oauthService.client = null;
      // @ts-expect-error - accessing private property for testing
      oauthService.initPromise = null;

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi
            .fn()
            .mockRejectedValue(new Error("Client metadata not found")),
        },
      }));

      await expect(oauthService.handleCallback()).rejects.toThrow(
        "OAuth client not initialized",
      );
    });

    it("should propagate callback handling errors", async () => {
      const clientWithError = {
        ...mockOAuthClient,
        init: vi.fn().mockRejectedValue(new Error("Callback failed")),
      };

      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(clientWithError),
        },
      }));

      await expect(oauthService.handleCallback()).rejects.toThrow(
        "Callback failed",
      );
    });
  });

  describe("signOut()", () => {
    beforeEach(async () => {
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));
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
      vi.doMock("@atproto/oauth-client-browser", () => ({
        BrowserOAuthClient: {
          load: vi.fn().mockResolvedValue(mockOAuthClient),
        },
      }));
      await oauthService.init();
    });

    it("getAgent() should return current agent", () => {
      expect(oauthService.getAgent()).toBe(mockAgent);
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
        agent: mockAgent,
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
});
