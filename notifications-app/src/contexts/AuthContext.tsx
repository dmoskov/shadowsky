import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AtpAgent, AtpSessionData, AtpSessionEvent } from '@atproto/api'

interface AuthContextType {
  agent: AtpAgent | null
  session: AtpSessionData | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'bsky_notifications_session'

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [agent] = useState(() => new AtpAgent({ service: 'https://bsky.social' }))
  const [session, setSession] = useState<AtpSessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load saved session
    const savedSession = localStorage.getItem(STORAGE_KEY)
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        agent.resumeSession(parsed).then(() => {
          setSession(parsed)
        }).catch(() => {
          localStorage.removeItem(STORAGE_KEY)
        }).finally(() => {
          setIsLoading(false)
        })
      } catch {
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }

    // Handle session events
    const handleSessionEvent = (event: AtpSessionEvent) => {
      if (event === 'create' || event === 'update') {
        const currentSession = agent.session
        if (currentSession) {
          setSession(currentSession)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession))
        }
      } else if (event === 'expired' || event === 'close') {
        setSession(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    agent.addListener('session', handleSessionEvent)
    return () => {
      agent.removeListener('session', handleSessionEvent)
    }
  }, [agent])

  const login = async (identifier: string, password: string) => {
    await agent.login({ identifier, password })
  }

  const logout = () => {
    agent.logout()
    setSession(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{
      agent,
      session,
      isAuthenticated: !!session,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}