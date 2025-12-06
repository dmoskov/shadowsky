import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

// Mock dependencies
vi.mock("../services/oauth-service", () => ({
  oauthService: {
    init: vi.fn(),
    isAvailable: vi.fn(),
    authorize: vi.fn(),
    handleCallback: vi.fn(),
    signOut: vi.fn(),
  },
  hasExistingOAuthSession: vi.fn(),
}));

vi.mock("../services/atproto", () => ({
  atProtoClient: {
    login: vi.fn(),
    logout: vi.fn(),
    resumeSession: vi.fn(),
    refreshSession: vi.fn(),
    updateService: vi.fn(),
    getSessionPrefix: vi.fn(() => "notifications_"),
    agent: {
      getProfile: vi.fn(),
    },
  },
  ATProtoClient: {
    loadSavedSession: vi.fn(),
  },
}));

vi.mock("../services/account-manager", () => ({
  AccountManager: {
    addOrUpdateAccount: vi.fn(),
    switchAccount: vi.fn(),
    clearAllAccounts: vi.fn(),
  },
}));

vi.mock("../services/analytics", () => ({
  analytics: {
    trackLogin: vi.fn(),
    trackLogout: vi.fn(),
    setUserId: vi.fn(),
  },
}));

vi.mock("../services/bookmark-service-wrapper", () => ({
  bookmarkService: {
    setAgent: vi.fn(),
  },
  initializeBookmarkService: vi.fn(),
}));

vi.mock("../services/column-service", () => ({
  columnService: {
    setAgent: vi.fn(),
  },
}));

vi.mock("../services/data-services-initializer", () => ({
  initializeDataServices: vi.fn(),
}));

vi.mock("../services/dm-service", () => ({
  dmService: {
    setAgent: vi.fn(),
  },
}));

vi.mock("../services/draft-service", () => ({
  draftService: {
    setAgent: vi.fn(),
  },
}));

vi.mock("../services/app-preferences-service", () => ({
  appPreferencesService: {
    setAgent: vi.fn(),
  },
}));

vi.mock("@bsky/shared", () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn(),
  },
  queryClient: {
    clear: vi.fn(),
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message = "Authentication failed") {
      super(message);
      this.name = "AuthenticationError";
    }
  },
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor(message = "Session expired") {
      super(message);
      this.name = "SessionExpiredError";
    }
  },
  NetworkError: class NetworkError extends Error {
    constructor(message = "Network error") {
      super(message);
      this.name = "NetworkError";
    }
  },
}));

// Import mocked modules for assertions
import {
  AuthenticationError,
  NetworkError,
  queryClient,
  SessionExpiredError,
} from "@bsky/shared";
import { AccountManager } from "../services/account-manager";
import { analytics } from "../services/analytics";
import { atProtoClient, ATProtoClient } from "../services/atproto";
import {
  bookmarkService,
  initializeBookmarkService,
} from "../services/bookmark-service-wrapper";
import { columnService } from "../services/column-service";
import { initializeDataServices } from "../services/data-services-initializer";
import { dmService } from "../services/dm-service";
import { draftService } from "../services/draft-service";
import {
  hasExistingOAuthSession,
  oauthService,
} from "../services/oauth-service";

// Test wrapper
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

// Mock session data
const mockSession = {
  did: "did:plc:test123",
  handle: "test.bsky.social",
  accessJwt: "mock-access-jwt",
  refreshJwt: "mock-refresh-jwt",
  active: true,
};

// Mock OAuth state - using type assertion since we're mocking the interface
const mockOAuthState = {
  agent: {
    getProfile: vi.fn().mockResolvedValue({
      data: { handle: "oauth.test.bsky.social", displayName: "OAuth User" },
    }),
  },
  did: "did:plc:oauth123",
  handle: "oauth.test.bsky.social",
  session: { did: "did:plc:oauth123" },
} as any;

// Store original location
const originalLocationHref = window.location.href;

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock implementations to default
    vi.mocked(hasExistingOAuthSession).mockResolvedValue(false);
    vi.mocked(oauthService.init).mockResolvedValue(null);
    vi.mocked(oauthService.isAvailable).mockReturnValue(false);
    vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(null);

    // Mock window.location.href setter - replaceProperty doesn't work well with location
    // so we just set it directly since we're in jsdom
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        href: "/",
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Reset location
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        href: originalLocationHref,
      },
      writable: true,
    });
  });

  describe("useAuth hook", () => {
    it("should throw error when used outside AuthProvider", () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth must be used within AuthProvider");
    });
  });

  describe("Initial State", () => {
    it("should start with loading state", async () => {
      // Delay the init to observe loading state
      vi.mocked(oauthService.init).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100)),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
    });

    it("should complete initialization with no session", async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
      expect(result.current.authMethod).toBeNull();
    });
  });

  describe("OAuth Callback Processing", () => {
    it("should handle successful OAuth callback", async () => {
      vi.mocked(oauthService.handleCallback).mockResolvedValue(mockOAuthState);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.handleOAuthCallback();
      });

      expect(success!).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.authMethod).toBe("oauth");
      expect(result.current.session?.did).toBe("did:plc:oauth123");

      // Verify services were initialized
      expect(initializeBookmarkService).toHaveBeenCalled();
      expect(initializeDataServices).toHaveBeenCalled();
      expect(dmService.setAgent).toHaveBeenCalled();

      // Verify analytics tracked login
      expect(analytics.trackLogin).toHaveBeenCalledWith("oauth");
      expect(analytics.setUserId).toHaveBeenCalledWith("did:plc:oauth123");
    });

    it("should handle OAuth callback when no session is returned", async () => {
      vi.mocked(oauthService.handleCallback).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.handleOAuthCallback();
      });

      expect(success!).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should throw error on OAuth callback failure", async () => {
      const callbackError = new Error("OAuth callback failed");
      vi.mocked(oauthService.handleCallback).mockRejectedValue(callbackError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.handleOAuthCallback()).rejects.toThrow(
        "OAuth callback failed",
      );
    });

    it("should fetch handle from profile when not provided by OAuth state", async () => {
      const mockGetProfile = vi.fn().mockResolvedValue({
        data: { handle: "oauth.test.bsky.social", displayName: "OAuth User" },
      });
      const stateWithoutHandle = {
        agent: { getProfile: mockGetProfile },
        did: "did:plc:oauth123",
        handle: undefined,
        session: { did: "did:plc:oauth123" },
      } as any;
      vi.mocked(oauthService.handleCallback).mockResolvedValue(
        stateWithoutHandle,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleOAuthCallback();
      });

      expect(mockGetProfile).toHaveBeenCalledWith({
        actor: "did:plc:oauth123",
      });
      expect(result.current.session?.handle).toBe("oauth.test.bsky.social");
    });
  });

  describe("Session Restore from localStorage", () => {
    it("should restore session from localStorage on init", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.authMethod).toBe("app-password");
      expect(result.current.session).toEqual(mockSession);
      expect(atProtoClient.resumeSession).toHaveBeenCalledWith(mockSession);
    });

    it("should prioritize OAuth session over localStorage session", async () => {
      vi.mocked(hasExistingOAuthSession).mockResolvedValue(true);
      vi.mocked(oauthService.init).mockResolvedValue(mockOAuthState);
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.authMethod).toBe("oauth");
      expect(result.current.session?.did).toBe("did:plc:oauth123");

      // App password session should not be resumed if OAuth session exists
      expect(atProtoClient.resumeSession).not.toHaveBeenCalled();
    });

    it("should clear session on authentication error during restore", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(
        new AuthenticationError("Invalid credentials"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(atProtoClient.logout).toHaveBeenCalled();
    });

    it("should clear session on 401 status error during restore", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      const error = new Error("Unauthorized");
      (error as any).status = 401;
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(atProtoClient.logout).toHaveBeenCalled();
    });
  });

  describe("Token Refresh Flow", () => {
    it("should refresh session successfully", async () => {
      const refreshedSession = {
        ...mockSession,
        accessJwt: "new-access-jwt",
      };
      vi.mocked(atProtoClient.refreshSession).mockResolvedValue(
        refreshedSession,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.refreshSession();
      });

      expect(success!).toBe(true);
      expect(result.current.session).toEqual(refreshedSession);
    });

    it("should return false when refresh returns null", async () => {
      vi.mocked(atProtoClient.refreshSession).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.refreshSession();
      });

      expect(success!).toBe(false);
    });

    it("should logout on session expired error during refresh", async () => {
      // First, establish a session
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Now mock the refresh to fail
      vi.mocked(atProtoClient.refreshSession).mockRejectedValue(
        new SessionExpiredError(),
      );

      await act(async () => {
        await result.current.refreshSession();
      });

      // logout triggers a page redirect, so we verify state was cleared
      expect(analytics.trackLogout).toHaveBeenCalled();
    });

    it("should logout on authentication error during refresh", async () => {
      // First, establish a session
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      vi.mocked(atProtoClient.refreshSession).mockRejectedValue(
        new AuthenticationError(),
      );

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(analytics.trackLogout).toHaveBeenCalled();
    });
  });

  describe("Session Expiration Handling", () => {
    it("should clear session on SessionExpiredError during restore", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(
        new SessionExpiredError("Session expired"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(atProtoClient.logout).toHaveBeenCalled();
    });

    it("should handle network errors during session restore without clearing session", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(
        new NetworkError("Network error"),
      );

      // Mock navigator.onLine
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial attempt and retries
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 },
      );

      // Session should not be cleared on network errors
      expect(atProtoClient.logout).not.toHaveBeenCalled();
    });

    it("should handle 5xx server errors without clearing session", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      const serverError = new Error("Internal Server Error");
      (serverError as any).status = 500;
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(serverError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 },
      );

      // Should not clear session on 5xx errors
      expect(atProtoClient.logout).not.toHaveBeenCalled();
    });
  });

  describe("Multi-Account Switching", () => {
    it("should switch account successfully", async () => {
      const secondAccount = {
        did: "did:plc:second",
        handle: "second.bsky.social",
        session: {
          did: "did:plc:second",
          handle: "second.bsky.social",
          accessJwt: "second-access-jwt",
          refreshJwt: "second-refresh-jwt",
          active: true,
        },
        lastUsed: Date.now(),
      };

      vi.mocked(AccountManager.switchAccount).mockReturnValue(secondAccount);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(
        secondAccount.session,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.switchAccount("did:plc:second");
      });

      expect(success!).toBe(true);
      expect(AccountManager.switchAccount).toHaveBeenCalledWith(
        "did:plc:second",
      );
      expect(atProtoClient.resumeSession).toHaveBeenCalledWith(
        secondAccount.session,
      );
      expect(queryClient.clear).toHaveBeenCalled();
      expect(analytics.setUserId).toHaveBeenCalledWith("did:plc:second");
    });

    it("should return false when account not found", async () => {
      vi.mocked(AccountManager.switchAccount).mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.switchAccount("did:plc:unknown");
      });

      expect(success!).toBe(false);
      expect(atProtoClient.resumeSession).not.toHaveBeenCalled();
    });

    it("should return false when session resume fails", async () => {
      const secondAccount = {
        did: "did:plc:second",
        handle: "second.bsky.social",
        session: {
          did: "did:plc:second",
          handle: "second.bsky.social",
          accessJwt: "second-access-jwt",
          refreshJwt: "second-refresh-jwt",
          active: true,
        },
        lastUsed: Date.now(),
      };

      vi.mocked(AccountManager.switchAccount).mockReturnValue(secondAccount);
      vi.mocked(atProtoClient.resumeSession).mockRejectedValue(
        new Error("Session resume failed"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.switchAccount("did:plc:second");
      });

      expect(success!).toBe(false);
    });
  });

  describe("App Password Login", () => {
    it("should login with app password successfully", async () => {
      vi.mocked(atProtoClient.login).mockResolvedValue(mockSession);
      vi.mocked(atProtoClient.agent.getProfile).mockResolvedValue({
        data: {
          displayName: "Test User",
          avatar: "https://example.com/avatar.jpg",
        },
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.login(
          "test.bsky.social",
          "app-password-123",
        );
      });

      expect(success!).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.authMethod).toBe("app-password");
      expect(result.current.session).toEqual(mockSession);

      expect(atProtoClient.login).toHaveBeenCalledWith(
        "test.bsky.social",
        "app-password-123",
        undefined,
      );
      expect(analytics.trackLogin).toHaveBeenCalledWith("bluesky");
    });

    it("should login with custom PDS URL", async () => {
      vi.mocked(atProtoClient.login).mockResolvedValue(mockSession);
      vi.mocked(atProtoClient.agent.getProfile).mockResolvedValue({
        data: { displayName: "Test User" },
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(
          "test.custom.pds",
          "password",
          "https://custom.pds.com",
        );
      });

      expect(atProtoClient.updateService).toHaveBeenCalledWith(
        "https://custom.pds.com",
      );
      expect(analytics.trackLogin).toHaveBeenCalledWith("custom_pds");
    });

    it("should strip @ from identifier", async () => {
      vi.mocked(atProtoClient.login).mockResolvedValue(mockSession);
      vi.mocked(atProtoClient.agent.getProfile).mockResolvedValue({
        data: {},
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login("@test.bsky.social", "password");
      });

      expect(atProtoClient.login).toHaveBeenCalledWith(
        "test.bsky.social",
        "password",
        undefined,
      );
    });

    it("should pass auth factor token for 2FA", async () => {
      vi.mocked(atProtoClient.login).mockResolvedValue(mockSession);
      vi.mocked(atProtoClient.agent.getProfile).mockResolvedValue({
        data: {},
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(
          "test.bsky.social",
          "password",
          undefined,
          "123456",
        );
      });

      expect(atProtoClient.login).toHaveBeenCalledWith(
        "test.bsky.social",
        "password",
        "123456",
      );
    });

    it("should throw on login failure", async () => {
      const loginError = new Error("Invalid credentials");
      vi.mocked(atProtoClient.login).mockRejectedValue(loginError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.login("test.bsky.social", "wrong-password"),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("OAuth Login", () => {
    it("should initiate OAuth authorization", async () => {
      vi.mocked(oauthService.authorize).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.loginWithOAuth("test.bsky.social");
      });

      expect(oauthService.authorize).toHaveBeenCalledWith("test.bsky.social");
    });

    it("should throw on OAuth authorization failure", async () => {
      const oauthError = new Error("OAuth authorization failed");
      vi.mocked(oauthService.authorize).mockRejectedValue(oauthError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.loginWithOAuth("test.bsky.social"),
      ).rejects.toThrow("OAuth authorization failed");
    });

    it("should expose OAuth availability status", async () => {
      vi.mocked(oauthService.isAvailable).mockReturnValue(true);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOAuthAvailable).toBe(true);
    });
  });

  describe("Logout", () => {
    it("should logout and clear all state for app-password auth", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout();
      });

      expect(analytics.trackLogout).toHaveBeenCalled();
      expect(atProtoClient.logout).toHaveBeenCalled();
      expect(bookmarkService.setAgent).toHaveBeenCalledWith(null);
      expect(dmService.setAgent).toHaveBeenCalledWith(null);
      expect(columnService.setAgent).toHaveBeenCalledWith(null);
      expect(draftService.setAgent).toHaveBeenCalledWith(null);
      expect(queryClient.clear).toHaveBeenCalled();
    });

    it("should call OAuth signOut for OAuth auth", async () => {
      vi.mocked(oauthService.init).mockResolvedValue(mockOAuthState);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.authMethod).toBe("oauth");
      });

      act(() => {
        result.current.logout();
      });

      expect(oauthService.signOut).toHaveBeenCalled();
    });

    it("should clear all accounts when logoutAllAccounts is true", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout(true);
      });

      expect(AccountManager.clearAllAccounts).toHaveBeenCalled();
    });

    it("should handle OAuth signOut error gracefully", async () => {
      vi.mocked(oauthService.init).mockResolvedValue(mockOAuthState);
      vi.mocked(oauthService.signOut).mockRejectedValue(
        new Error("Sign out failed"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Should not throw even if signOut fails
      await act(async () => {
        result.current.logout();
        // Wait for the async logout to complete
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // The logout flow still attempts signOut even if it errors
      expect(oauthService.signOut).toHaveBeenCalled();
      expect(atProtoClient.logout).toHaveBeenCalled();
    });
  });

  describe("Agent Exposure", () => {
    it("should expose OAuth agent when using OAuth auth", async () => {
      vi.mocked(oauthService.init).mockResolvedValue(mockOAuthState);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.agent).toBe(mockOAuthState.agent);
    });

    it("should expose atProtoClient agent when using app-password auth", async () => {
      vi.mocked(ATProtoClient.loadSavedSession).mockReturnValue(mockSession);
      vi.mocked(atProtoClient.resumeSession).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.agent).toBe(atProtoClient.agent);
    });

    it("should return null agent when not authenticated", async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agent).toBeNull();
    });
  });
});
