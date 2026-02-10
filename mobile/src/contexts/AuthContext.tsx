import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { getAtProtoClient } from "../services/atproto/client";
import {
  AuthAccount,
  signOut as authSignOut,
  getAccounts,
  resumeSession,
  signInWithPassword,
  StoredSession,
  switchToAccount,
  removeAccount as removeAccountFromStorage,
  getCurrentSession,
} from "../services/auth/auth-service";
import * as OAuthService from "../services/auth/oauth";

const AUTH_STORAGE_KEY = "@shadowsky/auth_session";
const SESSION_REFRESH_INTERVAL = 50 * 60 * 1000; // Refresh every 50 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check session validity every 5 minutes

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: StoredSession | null;
  account: AuthAccount | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signInWithOAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  accounts: AuthAccount[];
  switchAccount: (did: string) => Promise<void>;
  removeAccount: (did: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (checkTimerRef.current) {
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearTimers(); // Stop automatic refresh timers
      await authSignOut();
      setSession(null);
    } catch (error) {
      console.error("Failed to sign out:", error);
      throw error;
    }
  }, [clearTimers]);

  const checkSessionValidity = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      // Try to make a simple API call to verify session is valid
      await agent.getProfile({ actor: session.did });
    } catch (error) {
      console.warn("Session appears invalid, attempting refresh:", error);
      try {
        await refreshSession();
      } catch (refreshError) {
        console.error("Session refresh failed, signing out:", refreshError);
        await signOut();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, signOut]);

  const refreshSession = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      // BskyAgent handles token refresh automatically when needed
      // We just need to verify the session and update stored data
      const currentSession = agent.session;

      if (currentSession) {
        const updatedSession: StoredSession = {
          ...session,
          accessJwt: currentSession.accessJwt,
          refreshJwt: currentSession.refreshJwt,
        };

        // Only update if tokens actually changed
        if (
          updatedSession.accessJwt !== session.accessJwt ||
          updatedSession.refreshJwt !== session.refreshJwt
        ) {
          // Persist updated session
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(updatedSession),
          );
          setSession(updatedSession);
        }
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
      // If refresh fails, sign out
      await signOut();
      throw error;
    }
  }, [session, signOut]);

  const setupSessionRefresh = useCallback(() => {
    // Clear existing timers
    clearTimers();

    // Set up periodic session refresh
    refreshTimerRef.current = setInterval(() => {
      refreshSession().catch((error) => {
        console.error("Automatic session refresh failed:", error);
      });
    }, SESSION_REFRESH_INTERVAL);

    // Set up periodic session validity check
    checkTimerRef.current = setInterval(() => {
      checkSessionValidity().catch((error) => {
        console.error("Session validity check failed:", error);
      });
    }, SESSION_CHECK_INTERVAL);
  }, [clearTimers, refreshSession, checkSessionValidity]);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      // When app comes to foreground, check session validity
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        session
      ) {
        checkSessionValidity();
      }
      appStateRef.current = nextAppState;
    },
    [session, checkSessionValidity],
  );

  // Load session from storage on mount
  useEffect(() => {
    loadSession();
    loadAccounts();

    // Listen for app state changes to refresh session when app comes to foreground
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, [handleAppStateChange, clearTimers]);

  // Set up automatic session refresh when authenticated
  useEffect(() => {
    if (session && !isLoading) {
      setupSessionRefresh();
    } else {
      clearTimers();
    }

    return () => {
      clearTimers();
    };
  }, [session, isLoading, setupSessionRefresh, clearTimers]);

  const loadSession = async () => {
    try {
      const restoredSession = await resumeSession();
      if (restoredSession) {
        setSession(restoredSession);
      }
    } catch (error) {
      console.error("Failed to load auth session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const loadedAccounts = await getAccounts();
      setAccounts(loadedAccounts);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
  };

  const signIn = async (identifier: string, password: string) => {
    try {
      setIsLoading(true);
      const newSession = await signInWithPassword(identifier, password);
      setSession(newSession);
      await loadAccounts(); // Reload accounts list
    } catch (error) {
      console.error("Failed to sign in:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithOAuth = async () => {
    try {
      setIsLoading(true);
      // Start OAuth flow
      await OAuthService.startOAuthFlow();
      // The actual session creation happens in the OAuth callback handler
      // which should be implemented in OAuthCallbackScreen
    } catch (error) {
      console.error("Failed to start OAuth flow:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };


  const switchAccount = async (did: string) => {
    try {
      setIsLoading(true);

      // Find the account in the accounts list
      const targetAccount = accounts.find((acc) => acc.did === did);
      if (!targetAccount) {
        throw new Error("Account not found");
      }

      // Switch to the account using stored session
      const newSession = await switchToAccount(did);
      setSession(newSession);
    } catch (error) {
      console.error("Failed to switch account:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeAccount = async (did: string) => {
    try {
      // Remove account and its session
      await removeAccountFromStorage(did);

      // Reload accounts list
      await loadAccounts();

      // If we removed the current account, session state will be cleared by removeAccountFromStorage
      // Just need to update our local state
      const currentSession = await getCurrentSession();
      if (!currentSession || currentSession.did === did) {
        setSession(null);
      }
    } catch (error) {
      console.error("Failed to remove account:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: session !== null,
    isLoading,
    session,
    account: session?.account ?? null,
    signIn,
    signInWithOAuth,
    signOut,
    refreshSession,
    accounts,
    switchAccount,
    removeAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
