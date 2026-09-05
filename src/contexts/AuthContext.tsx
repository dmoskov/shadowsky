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
import { PAN_LABELER_DID } from "../config/pan-labeler";
import { AccountManager } from "../services/account-manager";
import { appPreferencesService } from "../services/app-preferences-service";
import { atProtoClient, ATProtoClient } from "../services/atproto";
import { subscribeToLabeler } from "../services/atproto/labelers";
import {
  bookmarkService,
  initializeBookmarkService,
} from "../services/bookmark-service-wrapper";
import { columnService } from "../services/column-service";
import { initializeDataServices } from "../services/data-services-initializer";
import { dmService } from "../services/dm-service";
import { draftService } from "../services/draft-service";
import { multiClientManager } from "../services/multi-client-manager";
import {
  hasExistingOAuthSession,
  oauthService,
} from "../services/oauth-service";
import { routePrefetchService } from "../services/route-prefetch-service";
import { setApiAuthAgentProvider, setApiAuthSession } from "../utils/api-auth";

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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRetries = 3;
  // Guard against concurrent initializeAuth calls (React strict mode, fast refresh)
  const initInProgressRef = useRef(false);
  // Keep a ref to session so logout always reads the current value, not a stale closure
  const sessionRef = useRef<Session | null>(null);

  // Keep sessionRef in sync with session state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
      } else {
        // Read session.did at call time via ref, not the stale closure value
        const did = sessionRef.current?.did;
        if (did) {
          multiClientManager.removeClient(did);
        }
      }

      // Force a page reload to ensure all state is cleared
      window.location.href = "/";
    },
    [authMethod],
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

    // AbortController lets us cancel in-flight async work on cleanup
    // (unmount, strict-mode re-run, or fast refresh)
    const abortController = new AbortController();
    const { signal } = abortController;

    /** Throw if the effect has been cleaned up so we bail out of initializeAuth. */
    const throwIfAborted = () => {
      if (signal.aborted) {
        throw new DOMException("Auth init aborted", "AbortError");
      }
    };

    const initializeAuth = async () => {
      // Prevent concurrent init calls (React strict mode, fast refresh, retry overlap)
      if (initInProgressRef.current) {
        return;
      }
      initInProgressRef.current = true;

      try {
        // Start prefetching the home route chunk in parallel with auth
        // This loads SkyDeck.js while we're checking session status
        routePrefetchService.prefetchRoute("home");

        // First, do a lightweight check for existing OAuth session
        // This avoids loading the ~328KB OAuth client for users who don't use OAuth
        const mayHaveOAuthSession = await hasExistingOAuthSession();
        throwIfAborted();

        if (mayHaveOAuthSession) {
          // Only load the full OAuth client if we might have a session to restore
          debug.log("Checking for OAuth session...");
          const oauthState = await oauthService.init();
          throwIfAborted();

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
              throwIfAborted();
              handle = profile.handle;
              profileData = {
                displayName: profile.displayName,
                avatar: profile.avatar,
              };
            } catch (err) {
              // Re-throw AbortError so the outer catch handles cleanup
              if (err instanceof DOMException && err.name === "AbortError") {
                throw err;
              }
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
                throwIfAborted();
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
                subscribeToLabeler(agent, PAN_LABELER_DID).catch(() => {}),
              ]);
              throwIfAborted();

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
        } else {
          // No existing OAuth session, but still check if OAuth is available
          // so the login UI can enable the OAuth button. Loads the ~328KB client
          // in the background without blocking the auth flow.
          oauthService
            .init()
            .then(() => {
              if (!signal.aborted) {
                setIsOAuthAvailable(oauthService.isAvailable());
              }
            })
            .catch(() => {});
        }

        // Fall back to legacy app password session
        debug.log("No OAuth session, checking for app password session...");
        const savedSession = ATProtoClient.loadSavedSession(
          atProtoClient.getSessionPrefix(),
        );
        // Also check AccountManager as fallback — multiClientManager login
        // stores sessions there but may not write to the legacy session key
        const activeAccount = AccountManager.getActiveAccount();
        if (
          savedSession ||
          (activeAccount && activeAccount.authMethod !== "oauth")
        ) {
          initAttempts.current++;

          try {
            const accountToResume = activeAccount || {
              did: savedSession!.did,
              handle: savedSession!.handle,
              session: savedSession!,
              authMethod: "app-password" as const,
              isActive: true,
              lastUsed: Date.now(),
            };

            // Use multiClientManager to resume session - creates dedicated agent
            const managedClient =
              await multiClientManager.resumeSession(accountToResume);
            throwIfAborted();

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
              subscribeToLabeler(managedClient.agent, PAN_LABELER_DID).catch(
                () => {},
              ),
            ]);
            throwIfAborted();

            // Store account in AccountManager for multi-account support
            try {
              const { data: profile } = await managedClient.agent.getProfile({
                actor: resumedSession.did,
              });
              throwIfAborted();
              AccountManager.addOrUpdateAccount(
                resumedSession,
                {
                  displayName: profile.displayName,
                  avatar: profile.avatar,
                },
                "app-password",
              );
            } catch (err) {
              // Re-throw AbortError so we don't swallow cancellation
              if (err instanceof DOMException && err.name === "AbortError") {
                throw err;
              }
              // Still add account even if profile fetch fails
              AccountManager.addOrUpdateAccount(
                resumedSession,
                undefined,
                "app-password",
              );
            }
          } catch (error) {
            // Re-throw AbortError — cleanup is handled in the outer catch
            if (error instanceof DOMException && error.name === "AbortError") {
              throw error;
            }

            const status = (error as Error & { status?: number })?.status;

            // 400 errors are expected when session is invalid/expired - don't log as error
            if (status === 400) {
              debug.log("Session expired or invalid, clearing stored session");
              atProtoClient.logout();
              // Also remove from multi-client manager
              if (savedSession) {
                multiClientManager.removeClient(savedSession.did);
              }
            } else if (
              error instanceof SessionExpiredError ||
              error instanceof AuthenticationError ||
              status === 401
            ) {
              debug.log("Session invalid, clearing...");
              atProtoClient.logout();
              // Also remove from multi-client manager
              if (savedSession) {
                multiClientManager.removeClient(savedSession.did);
              }
            } else if (
              error instanceof NetworkError ||
              ((error as Error & { status?: number })?.status ?? 0) >= 500 ||
              !navigator.onLine
            ) {
              // For network errors, keep the session and retry
              debug.log("Network error during session resume, will retry...");

              if (
                initAttempts.current < maxRetries &&
                navigator.onLine &&
                !signal.aborted
              ) {
                // Reset in-progress flag before scheduling retry
                initInProgressRef.current = false;
                retryTimerRef.current = setTimeout(() => {
                  retryTimerRef.current = null;
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
        // Silently swallow AbortError — expected when effect is cleaned up
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // Error during auth initialization
        debug.error("Failed to initialize auth:", error);
      } finally {
        initInProgressRef.current = false;
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      abortController.abort();
      initInProgressRef.current = false;
      clearTimeout(safetyTimeout);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
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

        if (!managedClient || !managedClient.agent.session) {
          throw new Error("Invalid identifier or password");
        }

        const newSession: Session = {
          did: managedClient.did,
          handle: managedClient.handle,
          accessJwt: managedClient.agent.session?.accessJwt || "",
          refreshJwt: managedClient.agent.session?.refreshJwt || "",
          active: true,
        };

        // Check if this is adding a secondary account (already authenticated)
        // If so, skip service initialization - the page reload will handle it
        const isAddingSecondaryAccount = isAuthenticated;

        setIsAuthenticated(true);
        setAuthMethod("app-password");
        setSession(newSession);
        setApiAuthSession(newSession);

        // Only initialize services for first login, not when adding accounts
        // AddAccountPage does a full page reload after login which will re-initialize services
        if (!isAddingSecondaryAccount) {
          await initializeBookmarkService(managedClient.agent);
          await initializeDataServices(managedClient.agent);
          dmService.setAgent(managedClient.agent);
        }

        // Auto-subscribe to pan engagement labeler (fire-and-forget)
        subscribeToLabeler(managedClient.agent, PAN_LABELER_DID).catch(
          () => {},
        );

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

        // Persist session to legacy key so initializeAuth can restore on refresh
        AccountManager.switchAccount(newSession.did);

        return true;
      } catch (error) {
        debug.error("Login error:", error);
        // Re-throw the error so the Login component can handle it
        throw error;
      }
    },
    [isAuthenticated],
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

  // The API auth helper mints service-auth tokens with whichever agent is
  // active, so it can prove the caller's DID to our API server.
  useEffect(() => {
    setApiAuthAgentProvider(() => (isAuthenticated ? currentAgent : null));
  }, [isAuthenticated, currentAgent]);

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
