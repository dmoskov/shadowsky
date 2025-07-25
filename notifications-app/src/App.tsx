import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Login } from './components/Login'
import { NotificationsDashboard } from './components/NotificationsDashboard'
import { NotificationsFeed } from './components/NotificationsFeed'
import { NotificationsTimeline } from './components/NotificationsTimeline'
import { VisualTimeline } from './components/VisualTimeline'
import { NotificationsAnalytics } from './components/NotificationsAnalytics'
import { NotificationsSettings } from './components/NotificationsSettings'
import { Profile } from './components/Profile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 429) return false // Don't retry rate limits
        if (error?.status === 401) return false // Don't retry auth errors
        return failureCount < 3
      }
    }
  }
})

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--bsky-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--bsky-text-secondary)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <div className="min-h-screen bsky-font" style={{ background: 'var(--bsky-bg-primary)' }}>
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 mt-16">
          <Routes>
            <Route path="/" element={<NotificationsDashboard />} />
            <Route path="/notifications" element={<NotificationsFeed />} />
            <Route path="/timeline" element={<VisualTimeline />} />
            <Route path="/analytics" element={<NotificationsAnalytics />} />
            <Route path="/settings" element={<NotificationsSettings />} />
            <Route path="/profile/:handle" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App