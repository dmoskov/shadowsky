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
import { addBreadcrumb, setUser, clearUser } from "../utils/error-reporting";


import { createLogger } from '../utils/logger';

const logger = createLogger('Authcontextx');
const AUTH_STORAGE_KEY = "@shadowsky/auth_session";
const SESSION_REFRESH_INTERVAL = 50 * 60 * 1000;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: StoredSession | null;
  account: AuthAccount | null;
  signIn: (identifier: string, password: string, pdsUrl?: string) => Promise<void>;
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

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const consecutiveRefreshFailures = useRef<number>(0);
  const consecutiveValidityFailures = useRef<number>(0);
  // Refs to hold latest callbacks to avoid stale closures
  const refreshSessionRef = useRef<() => Promise<void>>(undefined);
  const checkSessionValidityRef = useRef<() => Promise<void>>(undefined);
  const setupSessionRefreshRef = useRef<() => void>(undefined);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (checkTimerRef.current) {
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = null;
    }
    // Reset failure counters when clearing timers
    consecutiveRefreshFailures.current = 0;
    consecutiveValidityFailures.current = 0;
  }, []);

  const signOut = useCallback(async () => {
    try {
      addBreadcrumb("auth", "User signed out");
      clearTimers();
      await authSignOut();
      setSession(null);
      clearUser();
    } catch (error) {
      throw error;
    }
  }, [clearTimers]);

  const checkSessionValidity = useCallback(async () => {
    if (!session) return;

    try {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      await agent.getProfile({ actor: session.did });
    } catch {
      try {
        // Use ref to get latest refreshSession to avoid stale closures
        await refreshSessionRef.current?.();
      } catch {
        await signOut();
      }
    }
  }, [session, signOut]);

  const refreshSession = useCallback(async () => {
    if (!session) return;

    try {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      const currentSession = agent.session;

      if (currentSession) {
        const updatedSession: StoredSession = {
          ...session,
          accessJwt: currentSession.accessJwt,
          refreshJwt: currentSession.refreshJwt,
        };

        if (
          updatedSession.accessJwt !== session.accessJwt ||
          updatedSession.refreshJwt !== session.refreshJwt
        ) {
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(updatedSession),
          );
          setSession(updatedSession);
        }
      }
    } catch (error) {
      await signOut();
      throw error;
    }
  }, [session, signOut]);

  const setupSessionRefresh = useCallback(() => {
    clearTimers();

    refreshTimerRef.current = setInterval(() => {
      // Use refs to get latest callbacks and avoid stale closures
      refreshSessionRef.current?.()
        .then(() => {
          // Reset failure counter on success
          consecutiveRefreshFailures.current = 0;
        })
        .catch((error) => {
          consecutiveRefreshFailures.current += 1;
          logger.error(`Session refresh failed (${consecutiveRefreshFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`,
            error,
          );

          if (
            consecutiveRefreshFailures.current >= MAX_CONSECUTIVE_FAILURES
          ) {
            logger.error('Max consecutive session refresh failures reached, forcing sign out',
            );
            clearTimers();
            signOut().catch((signOutError) =>
              logger.error('Error during forced sign out:', signOutError),
            );
          }
        });
    }, SESSION_REFRESH_INTERVAL);

    checkTimerRef.current = setInterval(() => {
      // Use refs to get latest callbacks and avoid stale closures
      checkSessionValidityRef.current?.()
        .then(() => {
          // Reset failure counter on success
          consecutiveValidityFailures.current = 0;
        })
        .catch((error) => {
          consecutiveValidityFailures.current += 1;
          logger.error(`Session validity check failed (${consecutiveValidityFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`,
            error,
          );

          if (
            consecutiveValidityFailures.current >= MAX_CONSECUTIVE_FAILURES
          ) {
            logger.error('Max consecutive session validity failures reached, forcing sign out',
            );
            clearTimers();
            signOut().catch((signOutError) =>
              logger.error('Error during forced sign out:', signOutError),
            );
          }
        });
    }, SESSION_CHECK_INTERVAL);
  }, [clearTimers, signOut]);

  // Update refs with latest callbacks to avoid stale closures
  useEffect(() => {
    refreshSessionRef.current = refreshSession;
    checkSessionValidityRef.current = checkSessionValidity;
    setupSessionRefreshRef.current = setupSessionRefresh;
  }, [refreshSession, checkSessionValidity, setupSessionRefresh]);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        session
      ) {
        // Use ref to get latest callback and avoid stale closures
        checkSessionValidityRef.current?.();
      }
      appStateRef.current = nextAppState;
    },
    [session],
  );

  useEffect(() => {
    loadSession();
    loadAccounts();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, [handleAppStateChange, clearTimers]);

  useEffect(() => {
    if (session && !isLoading) {
      // Use ref to call setupSessionRefresh to avoid dependency on the callback itself
      setupSessionRefreshRef.current?.();
    } else {
      clearTimers();
    }

    return () => {
      clearTimers();
    };
  }, [session, isLoading, clearTimers]);

  const loadSession = async () => {
    try {
      const restoredSession = await resumeSession();
      if (restoredSession) {
        setSession(restoredSession);
        // Set user context for error tracking (fire-and-forget — don't
        // block the loading gate on a non-critical side-effect)
        setUser(restoredSession.did).catch(() => {});
        addBreadcrumb("auth", "Session restored on app start");
      }
    } catch {
      // Session restore failed
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const loadedAccounts = await getAccounts();
      setAccounts(loadedAccounts);
    } catch {
      // Accounts load failed
    }
  };

  const signIn = async (identifier: string, password: string, pdsUrl?: string) => {
    try {
      setIsLoading(true);
      const newSession = await signInWithPassword(identifier, password, pdsUrl);
      setSession(newSession);
      await loadAccounts();

      // Set user context for error tracking
      await setUser(newSession.did);
      addBreadcrumb("auth", "User signed in with password");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithOAuth = async () => {
    try {
      setIsLoading(true);
      await OAuthService.startOAuthFlow();
      addBreadcrumb("auth", "User signed in with OAuth");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const switchAccount = async (did: string) => {
    try {
      setIsLoading(true);
      const targetAccount = accounts.find((acc) => acc.did === did);
      if (!targetAccount) {
        throw new Error("Account not found");
      }

      const newSession = await switchToAccount(did);
      setSession(newSession);

      // Update user context for error tracking
      await setUser(newSession.did);
      addBreadcrumb("auth", "User switched account");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeAccount = async (did: string) => {
    try {
      await removeAccountFromStorage(did);
      await loadAccounts();

      const currentSession = await getCurrentSession();
      if (!currentSession || currentSession.did === did) {
        setSession(null);
      }
    } catch (error) {
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
