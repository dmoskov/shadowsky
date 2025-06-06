import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './components/Login'
import { Feed } from './components/Feed'
import { Header } from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'
import { queryClient } from './lib/query-client'
import './App.css'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <div className="app-layout">
      <Header />
      <main className="main-content">
        <Feed />
      </main>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
