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

const AuthContext = createContext<AuthContextType | null>(null);

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
      }

      // Force a page reload to ensure all state is cleared
      window.location.href = "/";
    },
    [authMethod],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
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

            // Fetch handle from profile since OAuth session doesn't include it
            let handle = oauthState.handle || "";
            try {
              const { data: profile } = await agent.getProfile({
                actor: oauthState.did,
              });
              handle = profile.handle;
            } catch (err) {
              debug.error("Failed to fetch handle for OAuth session:", err);
            }

            // Add session property for compatibility with code expecting agent.session.did
            // OAuth Agent has .did directly, but BskyAgent has .session.did
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

            // Initialize services with OAuth agent
            await initializeBookmarkService(agent);
            await initializeDataServices(agent);
            dmService.setAgent(agent);

            setIsLoading(false);
            return;
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
            const resumedSession =
              await atProtoClient.resumeSession(savedSession);
            setIsAuthenticated(true);
            setAuthMethod("app-password");
            setSession(resumedSession);
            setApiAuthSession(resumedSession);
            initAttempts.current = 0; // Reset on success
            // Initialize services with user preferences
            await initializeBookmarkService(atProtoClient.agent);
            await initializeDataServices(atProtoClient.agent);
            dmService.setAgent(atProtoClient.agent);
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
        // If a custom PDS URL is provided, we need to create a new client
        if (pdsUrl && pdsUrl !== "https://bsky.social") {
          // Update the client's service URL
          atProtoClient.updateService(pdsUrl);
        }

        const trimAt = (s: string) =>
          s.length > 0 && s[0] === "@" ? s.slice(1) : s;

        const newSession = await atProtoClient.login(
          trimAt(identifier),
          password,
          authFactorToken,
        );
        setIsAuthenticated(true);
        setAuthMethod("app-password");
        setSession(newSession);
        setApiAuthSession(newSession);

        // Initialize services with user preferences
        await initializeBookmarkService(atProtoClient.agent);
        await initializeDataServices(atProtoClient.agent);
        dmService.setAgent(atProtoClient.agent);

        // Fetch profile data and store account
        try {
          const { data: profile } = await atProtoClient.agent.getProfile({
            actor: newSession.did,
          });
          AccountManager.addOrUpdateAccount(newSession, {
            displayName: profile.displayName,
            avatar: profile.avatar,
          });
        } catch (error) {
          debug.error("Failed to fetch profile for account storage:", error);
          AccountManager.addOrUpdateAccount(newSession);
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
        try {
          const { data: profile } = await agent.getProfile({
            actor: state.did,
          });
          handle = profile.handle;
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

      const resumedSession = await atProtoClient.resumeSession(account.session);
      setIsAuthenticated(true);
      setAuthMethod("app-password");
      setSession(resumedSession);
      setApiAuthSession(resumedSession);

      await initializeBookmarkService(atProtoClient.agent);
      await initializeDataServices(atProtoClient.agent);
      dmService.setAgent(atProtoClient.agent);

      queryClient.clear();

      window.location.href = "/";
      return true;
    } catch (error) {
      debug.error("Failed to switch account:", error);
      return false;
    }
  }, []);

  // Determine which agent to expose based on auth method
  const currentAgent =
    authMethod === "oauth" ? oauthAgent : atProtoClient.agent;

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
