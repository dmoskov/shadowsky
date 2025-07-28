import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { atProtoClient } from '../services/atproto'
import { ATProtoClient } from '@bsky/shared'
import type { Session } from '@bsky/shared'
import { SessionExpiredError, AuthenticationError, NetworkError } from '@bsky/shared'
import { queryClient } from '@bsky/shared'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<boolean>
  logout: () => void
  session: Session | null
  client: ATProtoClient
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

// Use the configured client instance from services

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const initAttempts = useRef(0)
  const maxRetries = 3

  const logout = useCallback(() => {
    // Clear all auth state
    atProtoClient.logout()
    setIsAuthenticated(false)
    setSession(null)
    
    // Clear React Query cache
    queryClient.clear()
    
    // Force a page reload to ensure all state is cleared
    window.location.href = '/'
  }, [])
  
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const newSession = await atProtoClient.refreshSession()
      if (newSession) {
        setSession(newSession)
        return true
      }
      return false
    } catch (error) {
      debug.error('Failed to refresh session:', error)
      if (error instanceof SessionExpiredError || 
          error instanceof AuthenticationError) {
        logout()
      }
      return false
    }
  }, [logout])

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedSession = ATProtoClient.loadSavedSession('main_')
        if (savedSession) {
          initAttempts.current++
          
          try {
            const resumedSession = await atProtoClient.resumeSession(savedSession)
            setIsAuthenticated(true)
            setSession(resumedSession)
            initAttempts.current = 0 // Reset on success
          } catch (error) {
            debug.error('Failed to resume session:', error)
            
            // Only clear session for authentication errors
            if (error instanceof SessionExpiredError || 
                error instanceof AuthenticationError ||
                (error as Error & { status?: number })?.status === 401) {
              debug.log('Session invalid, clearing...')
              atProtoClient.logout()
            } else if (error instanceof NetworkError || 
                      ((error as Error & { status?: number })?.status ?? 0) >= 500 ||
                      !navigator.onLine) {
              // For network errors, keep the session and retry
              debug.log('Network error during session resume, will retry...')
              
              if (initAttempts.current < maxRetries && navigator.onLine) {
                setTimeout(() => {
                  initializeAuth() // Retry
                }, 2000 * initAttempts.current) // Exponential backoff
                return // Don't set loading to false yet
              } else {
                debug.error('Max retries reached or offline, continuing without session')
                // Don't clear the session, user might come back online
              }
            } else {
              // Unknown error, log but don't clear session
              debug.error('Unknown error during session resume:', error)
            }
          }
        }
      } catch (error) {
        // Error loading from localStorage
        debug.error('Failed to load saved session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    try {
      const newSession = await atProtoClient.login(identifier, password)
      setIsAuthenticated(true)
      setSession(newSession)
      return true
    } catch (error) {
      debug.error('Login error:', error)
      // Re-throw the error so the Login component can handle it
      throw error
    }
  }, [])

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading,
      login, 
      logout, 
      session,
      client: atProtoClient,
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  )
}