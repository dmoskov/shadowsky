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
const SESSION_REFRESH_INTERVAL = 50 * 60 * 1000;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

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

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      clearTimers();
      await authSignOut();
      setSession(null);
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
        await refreshSession();
      } catch {
        await signOut();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      refreshSession().catch(() => {});
    }, SESSION_REFRESH_INTERVAL);

    checkTimerRef.current = setInterval(() => {
      checkSessionValidity().catch(() => {});
    }, SESSION_CHECK_INTERVAL);
  }, [clearTimers, refreshSession, checkSessionValidity]);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
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

  const signIn = async (identifier: string, password: string) => {
    try {
      setIsLoading(true);
      const newSession = await signInWithPassword(identifier, password);
      setSession(newSession);
      await loadAccounts();
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
