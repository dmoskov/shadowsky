import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import {
  AuthenticationError,
  debug,
  NetworkError,
  queryClient,
  SessionExpiredError,
} from "@bsky/shared";
import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccountManager } from "../services/account-manager";
import { appPreferencesService } from "../services/app-preferences-service";
import { atProtoClient, ATProtoClient } from "../services/atproto";
import { multiClientManager } from "../services/multi-client-manager";
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
import { routePrefetchService } from "../services/route-prefetch-service";
import { setApiAuthSession } from "../utils/api-auth";

type AuthMethod = "oauth" | "app-password" | null;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  isOAuthAvailable: boolean;
  // OAuth methods
  loginWithOAuth: (handle: string) => Promise<void>;
  handleOAuthCallback: () => Promise<boolean>;
  // Legacy app password login (kept for backwards compatibility)
  login: (
    identifier: string,
    password: string,
    pdsUrl?: string,
    authFactorToken?: string,
  ) => Promise<boolean>;
  logout: (logoutAllAccounts?: boolean) => void;
  session: Session | null;
  client: ATProtoClient;
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

/**
 * Validates that a PDS URL is safe to use for authentication.
 * Only allows official Bluesky domains to prevent credential theft via malicious servers.
 *
 * @param url - The PDS URL to validate
 * @returns true if the URL is valid and safe, false otherwise
 */
function isValidPDSUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS protocol for security
    if (parsed.protocol !== "https:") {
      return false;
    }

    // Allowlist of official Bluesky domains
    const allowedDomains = ["bsky.social", "bsky.app", "blueskyweb.xyz"];

    // Check if hostname exactly matches or is a subdomain of allowed domains
    return allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    // Invalid URL format
    return false;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [oauthAgent, setOauthAgent] = useState<BskyAgent | null>(null);
  const [isOAuthAvailable, setIsOAuthAvailable] = useState(false);
  const initAttempts = useRef(0);
  const maxRetries = 3;

  const logout = useCallback(
    async (logoutAllAccounts = false) => {
      // Clear OAuth session if using OAuth
      if (authMethod === "oauth") {
        try {
          await oauthService.signOut();
        } catch (error) {
          debug.error("Error signing out of OAuth:", error);
        }
      }

      // Clear all auth state
      atProtoClient.logout();
      setIsAuthenticated(false);
      setSession(null);
      setApiAuthSession(null);
      setAuthMethod(null);
      setOauthAgent(null);

      // Clear agent from services
      bookmarkService.setAgent(null);
      dmService.setAgent(null);
      appPreferencesService.setAgent(null);
      columnService.setAgent(null);
      draftService.setAgent(null);

      // Clear React Query cache
      queryClient.clear();

      // Clear all accounts if specified
      if (logoutAllAccounts) {
        AccountManager.clearAllAccounts();
        multiClientManager.clearAll();
      } else if (session?.did) {
        // Just remove the current account's client
        multiClientManager.removeClient(session.did);
      }

      // Force a page reload to ensure all state is cleared
      window.location.href = "/";
    },
    [authMethod, session],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // Use the active managed client's agent for refreshing
      const activeClient = multiClientManager.getActiveClient();
      if (activeClient && activeClient.agent.session) {
        // BskyAgent handles token refresh automatically, but we can force it
        await activeClient.agent.resumeSession(activeClient.agent.session);
        const newSession: Session = {
          did: activeClient.did,
          handle: activeClient.handle,
          accessJwt: activeClient.agent.session?.accessJwt || "",
          refreshJwt: activeClient.agent.session?.refreshJwt || "",
          active: true,
        };
        setSession(newSession);
        setApiAuthSession(newSession);
        return true;
      }

      // Fallback to legacy behavior for backward compatibility
      const newSession = await atProtoClient.refreshSession();
      if (newSession) {
        setSession(newSession);
        setApiAuthSession(newSession);
        return true;
      }
      return false;
    } catch (error) {
      debug.error("Failed to refresh session:", error);
      if (
        error instanceof SessionExpiredError ||
        error instanceof AuthenticationError
      ) {
        logout();
      }
      return false;
    }
  }, [logout]);

  useEffect(() => {
    // Safety timeout to prevent infinite spinner - if auth takes more than 10s, stop loading
    const safetyTimeout = setTimeout(() => {
      setIsLoading((current) => {
        if (current) {
          debug.error("Auth initialization timeout - forcing loading to false");
        }
        return false;
      });
    }, 10000);

    const initializeAuth = async () => {
      try {
        // Start prefetching the home route chunk in parallel with auth
        // This loads SkyDeck.js while we're checking session status
        routePrefetchService.prefetchRoute("home");

        // First, do a lightweight check for existing OAuth session
        // This avoids loading the ~328KB OAuth client for users who don't use OAuth
        const mayHaveOAuthSession = await hasExistingOAuthSession();

        if (mayHaveOAuthSession) {
          // Only load the full OAuth client if we might have a session to restore
          debug.log("Checking for OAuth session...");
          const oauthState = await oauthService.init();

          // Check if OAuth is available (client metadata loaded)
          setIsOAuthAvailable(oauthService.isAvailable());

          if (oauthState?.agent && oauthState.did) {
            debug.log("OAuth session found, using OAuth authentication");

            // Cast OAuth Agent to BskyAgent - they share the same API interface
            const agent = oauthState.agent as unknown as BskyAgent;

            // Set agent for DM service immediately (doesn't need handle)
            dmService.setAgent(agent);

            // Validate OAuth session by fetching profile
            // This verifies the session is actually usable (refresh token not expired)
            let sessionValid = true;
            let handle = oauthState.handle || "";
            let profileData: { displayName?: string; avatar?: string } = {};
            try {
              const { data: profile } = await agent.getProfile({
                actor: oauthState.did,
              });
              handle = profile.handle;
              profileData = {
                displayName: profile.displayName,
                avatar: profile.avatar,
              };
            } catch (err) {
              // Check if this is an auth error (401/400) indicating expired session
              // AT Protocol errors can have status in different locations
              const error = err as Error & {
                status?: number;
                statusCode?: number;
                response?: { status?: number };
              };
              const status =
                error.status ||
                error.statusCode ||
                error.response?.status ||
                (error.message?.includes("401") ? 401 : undefined) ||
                (error.message?.includes("Unauthorized") ? 401 : undefined) ||
                (error.message?.includes("Authentication Required")
                  ? 401
                  : undefined);

              debug.log("OAuth validation error:", {
                status,
                message: error.message,
                name: error.name,
              });

              if (status === 401 || status === 400) {
                debug.error(
                  "OAuth session expired/invalid, clearing and requiring re-auth",
                );
                sessionValid = false;
                // Clear the invalid OAuth session
                try {
                  await oauthService.signOut();
                } catch {
                  // Ignore signOut errors
                }
                // Fall through to check for app-password session
              } else {
                // Non-auth error (network, etc.) - try to continue with cached handle
                debug.error("Failed to fetch handle for OAuth session:", err);
              }
            }

            // If session validation failed, don't continue with OAuth
            if (!sessionValid) {
              debug.log(
                "OAuth session validation failed, checking for app-password session",
              );
              // Fall through to app-password check below
            } else {
              // Add session property for compatibility with code expecting agent.session.did
              // OAuth Agent has .did directly, but BskyAgent has .session.did
              // IMPORTANT: This must be done BEFORE initializing services, as they need session.did
              const sessionCompat = {
                did: oauthState.did,
                handle,
                accessJwt: "",
                refreshJwt: "",
                active: true,
              };
              Object.defineProperty(agent, "session", {
                get: () => sessionCompat,
                configurable: true,
              });

              // Session is valid, initialize services in parallel
              await Promise.all([
                initializeBookmarkService(agent),
                initializeDataServices(agent),
              ]);

              setIsAuthenticated(true);
              setAuthMethod("oauth");
              setOauthAgent(agent);

              // Create a minimal session object for compatibility
              const oauthSession: Session = {
                did: oauthState.did,
                handle,
                accessJwt: "", // OAuth doesn't expose raw JWTs
                refreshJwt: "",
                active: true,
              };
              setSession(oauthSession);
              setApiAuthSession(oauthSession);

              // Store account in AccountManager for multi-account support
              AccountManager.addOrUpdateAccount(
                oauthSession,
                profileData,
                "oauth",
              );

              setIsLoading(false);
              return;
            }
          }
        }

        // Fall back to legacy app password session
        debug.log("No OAuth session, checking for app password session...");
        const savedSession = ATProtoClient.loadSavedSession(
          atProtoClient.getSessionPrefix(),
        );
        if (savedSession) {
          initAttempts.current++;

          try {
            // Get the active account from AccountManager or create one from saved session
            const activeAccount = AccountManager.getActiveAccount();
            const accountToResume = activeAccount || {
              did: savedSession.did,
              handle: savedSession.handle,
              session: savedSession,
              authMethod: "app-password" as const,
              isActive: true,
              lastUsed: Date.now(),
            };

            // Use multiClientManager to resume session - creates dedicated agent
            const managedClient =
              await multiClientManager.resumeSession(accountToResume);

            const resumedSession: Session = {
              did: managedClient.did,
              handle: managedClient.handle,
              accessJwt: managedClient.agent.session?.accessJwt || "",
              refreshJwt: managedClient.agent.session?.refreshJwt || "",
              active: true,
            };

            setIsAuthenticated(true);
            setAuthMethod("app-password");
            setSession(resumedSession);
            setApiAuthSession(resumedSession);
            initAttempts.current = 0; // Reset on success

            // Initialize services in parallel for faster startup
            dmService.setAgent(managedClient.agent);
            await Promise.all([
              initializeBookmarkService(managedClient.agent),
              initializeDataServices(managedClient.agent),
            ]);

            // Store account in AccountManager for multi-account support
            try {
              const { data: profile } = await managedClient.agent.getProfile({
                actor: resumedSession.did,
              });
              AccountManager.addOrUpdateAccount(
                resumedSession,
                {
                  displayName: profile.displayName,
                  avatar: profile.avatar,
                },
                "app-password",
              );
            } catch {
              // Still add account even if profile fetch fails
              AccountManager.addOrUpdateAccount(
                resumedSession,
                undefined,
                "app-password",
              );
            }
          } catch (error) {
            const status = (error as Error & { status?: number })?.status;

            // 400 errors are expected when session is invalid/expired - don't log as error
            if (status === 400) {
              debug.log("Session expired or invalid, clearing stored session");
              atProtoClient.logout();
            } else if (
              error instanceof SessionExpiredError ||
              error instanceof AuthenticationError ||
              status === 401
            ) {
              debug.log("Session invalid, clearing...");
              atProtoClient.logout();
            } else if (
              error instanceof NetworkError ||
              ((error as Error & { status?: number })?.status ?? 0) >= 500 ||
              !navigator.onLine
            ) {
              // For network errors, keep the session and retry
              debug.log("Network error during session resume, will retry...");

              if (initAttempts.current < maxRetries && navigator.onLine) {
                setTimeout(() => {
                  initializeAuth(); // Retry
                }, 2000 * initAttempts.current); // Exponential backoff
                return; // Don't set loading to false yet
              } else {
                debug.error(
                  "Max retries reached or offline, continuing without session",
                );
                // Don't clear the session, user might come back online
              }
            } else {
              // Unknown error, log but don't clear session
              debug.error("Unknown error during session resume:", error);
            }
          }
        }
      } catch (error) {
        // Error during auth initialization
        debug.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = useCallback(
    async (
      identifier: string,
      password: string,
      pdsUrl?: string,
      authFactorToken?: string,
    ): Promise<boolean> => {
      try {
        // Validate PDS URL for security - prevent credential theft via malicious servers
        const serviceUrl = pdsUrl || "https://bsky.social";
        if (serviceUrl !== "https://bsky.social") {
          if (!isValidPDSUrl(serviceUrl)) {
            throw new Error(
              "Invalid PDS URL. Only official Bluesky servers (bsky.social, bsky.app) are supported.",
            );
          }
        }

        // Use multiClientManager for login - this creates a dedicated agent per account
        const managedClient = await multiClientManager.login(
          identifier,
          password,
          serviceUrl,
          authFactorToken,
        );

        const newSession: Session = {
          did: managedClient.did,
          handle: managedClient.handle,
          accessJwt: managedClient.agent.session?.accessJwt || "",
          refreshJwt: managedClient.agent.session?.refreshJwt || "",
          active: true,
        };

        setIsAuthenticated(true);
        setAuthMethod("app-password");
        setSession(newSession);
        setApiAuthSession(newSession);

        // Initialize services with the managed client's agent
        await initializeBookmarkService(managedClient.agent);
        await initializeDataServices(managedClient.agent);
        dmService.setAgent(managedClient.agent);

        // Fetch profile data and store account
        try {
          const { data: profile } = await managedClient.agent.getProfile({
            actor: newSession.did,
          });
          AccountManager.addOrUpdateAccount(
            newSession,
            {
              displayName: profile.displayName,
              avatar: profile.avatar,
            },
            "app-password",
          );
        } catch (error) {
          debug.error("Failed to fetch profile for account storage:", error);
          AccountManager.addOrUpdateAccount(
            newSession,
            undefined,
            "app-password",
          );
        }

        return true;
      } catch (error) {
        debug.error("Login error:", error);
        // Re-throw the error so the Login component can handle it
        throw error;
      }
    },
    [],
  );

  // OAuth login - redirects to authorization server
  const loginWithOAuth = useCallback(async (handle: string): Promise<void> => {
    try {
      await oauthService.authorize(handle);
      // This will redirect, so we won't reach here
    } catch (error) {
      debug.error("OAuth login error:", error);
      throw error;
    }
  }, []);

  // Handle OAuth callback after redirect
  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    try {
      const state = await oauthService.handleCallback();

      if (state?.agent && state.did) {
        // Cast OAuth Agent to BskyAgent - they share the same API interface
        const agent = state.agent as unknown as BskyAgent;

        // Fetch handle from profile since OAuth session doesn't include it
        let handle = state.handle || "";
        let profileData: { displayName?: string; avatar?: string } = {};
        try {
          const { data: profile } = await agent.getProfile({
            actor: state.did,
          });
          handle = profile.handle;
          profileData = {
            displayName: profile.displayName,
            avatar: profile.avatar,
          };
        } catch (err) {
          debug.error("Failed to fetch handle for OAuth session:", err);
        }

        // Add session property for compatibility with code expecting agent.session.did
        // OAuth Agent has .did directly, but BskyAgent has .session.did
        const sessionCompat = {
          did: state.did,
          handle,
          accessJwt: "",
          refreshJwt: "",
          active: true,
        };
        Object.defineProperty(agent, "session", {
          get: () => sessionCompat,
          configurable: true,
        });

        setIsAuthenticated(true);
        setAuthMethod("oauth");
        setOauthAgent(agent);

        // Create a minimal session object for compatibility
        const oauthSession: Session = {
          did: state.did,
          handle,
          accessJwt: "",
          refreshJwt: "",
          active: true,
        };
        setSession(oauthSession);
        setApiAuthSession(oauthSession);

        // Store account in AccountManager for multi-account support
        AccountManager.addOrUpdateAccount(oauthSession, profileData, "oauth");

        // Initialize services with OAuth agent
        await initializeBookmarkService(agent);
        await initializeDataServices(agent);
        dmService.setAgent(agent);

        return true;
      }

      return false;
    } catch (error) {
      debug.error("OAuth callback error:", error);
      throw error;
    }
  }, []);

  const switchAccount = useCallback(async (did: string): Promise<boolean> => {
    try {
      const account = AccountManager.switchAccount(did);
      if (!account) {
        return false;
      }

      // OAuth accounts need re-authentication (can't restore session)
      if (account.authMethod === "oauth") {
        // Redirect to add-account page for re-auth
        window.location.href = "/add-account";
        return false;
      }

      // Use multiClientManager to switch - this preserves sessions per account
      const managedClient = await multiClientManager.switchTo(did);
      const resumedSession: Session = {
        did: managedClient.did,
        handle: managedClient.handle,
        accessJwt: managedClient.agent.session?.accessJwt || "",
        refreshJwt: managedClient.agent.session?.refreshJwt || "",
        active: true,
      };

      setIsAuthenticated(true);
      setAuthMethod("app-password");
      setSession(resumedSession);
      setApiAuthSession(resumedSession);

      // Use the managed client's agent for services
      await initializeBookmarkService(managedClient.agent);
      await initializeDataServices(managedClient.agent);
      dmService.setAgent(managedClient.agent);

      queryClient.clear();

      window.location.href = "/";
      return true;
    } catch (error) {
      debug.error("Failed to switch account:", error);

      // Session expired or invalid - remove the account and prompt re-auth
      const status = (error as Error & { status?: number })?.status;
      if (status === 400 || status === 401) {
        AccountManager.removeAccount(did);
        multiClientManager.removeClient(did);
        alert("Session expired. Please sign in again.");
        window.location.href = "/add-account";
      }

      return false;
    }
  }, []);

  // Determine which agent to expose based on auth method
  // For app-password, use multiClientManager's active client for per-account sessions
  const currentAgent = useMemo(() => {
    if (authMethod === "oauth") {
      return oauthAgent;
    }
    // Use the active managed client's agent if available
    const activeClient = multiClientManager.getActiveClient();
    return activeClient?.agent || atProtoClient.agent;
  }, [authMethod, oauthAgent, session]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
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
      agent: isAuthenticated ? currentAgent : null,
      refreshSession,
      switchAccount,
    }),
    [
      isAuthenticated,
      isLoading,
      authMethod,
      isOAuthAvailable,
      loginWithOAuth,
      handleOAuthCallback,
      login,
      logout,
      session,
      currentAgent,
      refreshSession,
      switchAccount,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
