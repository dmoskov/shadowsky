import React, { createContext, useContext, useState, useCallback } from 'react'

interface LoadingState {
  feed: boolean
  notifications: boolean
  search: boolean
  profile: boolean
}

interface LoadingContextType {
  loading: LoadingState
  setLoading: (key: keyof LoadingState, value: boolean) => void
  isAnyLoading: boolean
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoadingState] = useState<LoadingState>({
    feed: false,
    notifications: false,
    search: false,
    profile: false
  })

  const setLoading = useCallback((key: keyof LoadingState, value: boolean) => {
    setLoadingState(prev => ({ ...prev, [key]: value }))
  }, [])

  const isAnyLoading = Object.values(loading).some(v => v)

  return (
    <LoadingContext.Provider value={{ loading, setLoading, isAnyLoading }}>
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider')
  }
  return context
}