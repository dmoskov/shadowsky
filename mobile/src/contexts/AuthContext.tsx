import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthSession {
  handle: string;
  did: string;
  accessJwt: string;
  refreshJwt: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: AuthSession | null;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@shadowsky/auth_session';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({children}: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        setSession(parsed);
      }
    } catch (error) {
      console.error('Failed to load auth session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (newSession: AuthSession) => {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (error) {
      console.error('Failed to save auth session:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setSession(null);
    } catch (error) {
      console.error('Failed to clear auth session:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: session !== null,
    isLoading,
    session,
    signIn,
    signOut,
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
