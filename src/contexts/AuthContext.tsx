import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { atProtoService } from '../services/atproto'

interface AuthContextType {
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<boolean>
  logout: () => void
  session: any
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
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const savedSession = localStorage.getItem('bsky_session')
    if (savedSession) {
      const sessionData = JSON.parse(savedSession)
      atProtoService.resume(sessionData).then(result => {
        if (result.success) {
          setIsAuthenticated(true)
          setSession(sessionData)
        } else {
          localStorage.removeItem('bsky_session')
        }
      })
    }
  }, [])

  const login = async (identifier: string, password: string): Promise<boolean> => {
    const result = await atProtoService.login(identifier, password)
    if (result.success) {
      setIsAuthenticated(true)
      const session = atProtoService.getSession()
      setSession(session)
      localStorage.setItem('bsky_session', JSON.stringify(session))
      return true
    }
    return false
  }

  const logout = () => {
    atProtoService.logout()
    setIsAuthenticated(false)
    setSession(null)
    localStorage.removeItem('bsky_session')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, session }}>
      {children}
    </AuthContext.Provider>
  )
}