import React, { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './components/Login'
import { Feed } from './components/Feed'
import { Header } from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ComposeModal } from './components/ComposeModal'
import { ThreadView } from './components/ThreadView'
import { queryClient } from './lib/query-client'
import { PenSquare } from 'lucide-react'
import './App.css'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)

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
    <>
      <div className="app-layout">
        <Header />
        <main className="main-content">
          {selectedThread ? (
            <ThreadView 
              postUri={selectedThread}
              onBack={() => setSelectedThread(null)}
            />
          ) : (
            <Feed onViewThread={(uri) => setSelectedThread(uri)} />
          )}
        </main>
      </div>
      
      {/* Floating Action Button */}
      <button 
        className="compose-fab"
        onClick={() => setIsComposeOpen(true)}
        aria-label="Compose new post"
      >
        <PenSquare size={24} />
      </button>
      
      {/* Compose Modal */}
      <ComposeModal 
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </>
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
