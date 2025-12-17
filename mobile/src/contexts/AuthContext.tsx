import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  signInWithPassword,
  resumeSession,
  signOut as authSignOut,
  StoredSession,
  AuthAccount,
  getAccounts,
} from '../services/auth/auth-service';
import {getAtProtoClient} from '../services/atproto/client';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: StoredSession | null;
  account: AuthAccount | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({children}: AuthProviderProps) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const restoredSession = await resumeSession();
      if (restoredSession) {
        setSession(restoredSession);
      }
    } catch (error) {
      console.error('Failed to load auth session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (identifier: string, password: string) => {
    try {
      setIsLoading(true);
      const newSession = await signInWithPassword(identifier, password);
      setSession(newSession);
    } catch (error) {
      console.error('Failed to sign in:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await authSignOut();
      setSession(null);
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  const refreshSession = async () => {
    try {
      const client = getAtProtoClient();
      const refreshedData = await client.refreshSession();

      if (session) {
        const updatedSession: StoredSession = {
          ...session,
          accessJwt: refreshedData.accessJwt,
          refreshJwt: refreshedData.refreshJwt,
        };
        setSession(updatedSession);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // If refresh fails, sign out
      await signOut();
      throw error;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: session !== null,
    isLoading,
    session,
    account: session?.account ?? null,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
