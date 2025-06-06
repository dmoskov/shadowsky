import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { atProtoClient, ATProtoClient } from '../services/atproto'
import type { Session } from '../types/atproto'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<boolean>
  logout: () => void
  session: Session | null
  client: ATProtoClient
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  const logout = useCallback(() => {
    atProtoClient.logout()
    setIsAuthenticated(false)
    setSession(null)
  }, [])

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedSession = ATProtoClient.loadSavedSession()
        if (savedSession) {
          const resumedSession = await atProtoClient.resumeSession(savedSession)
          setIsAuthenticated(true)
          setSession(resumedSession)
        }
      } catch (error) {
        // Session invalid, clear it
        console.error('Failed to resume session:', error)
        atProtoClient.logout()
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
      console.error('Login error:', error)
      return false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading,
      login, 
      logout, 
      session,
      client: atProtoClient
    }}>
      {children}
    </AuthContext.Provider>
  )
}