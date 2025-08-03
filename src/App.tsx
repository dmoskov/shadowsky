import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { LandingPage } from './components/LandingPage'
import { VisualTimeline } from './components/VisualTimeline'
import { NotificationsAnalytics } from './components/NotificationsAnalytics'
import { RateLimitStatus } from './components/RateLimitStatus'
import { ConversationsSimple as Conversations } from './components/ConversationsSimple'
import { Composer } from './components/Composer'
import { Search } from './components/Search'
import { CompressionTest } from './components/CompressionTest'
import { DebugConsole } from './components/DebugConsole'
import SkyDeck from './components/SkyDeck'
import { Notifications } from './components/Notifications'
import { NotificationStorageDB } from './services/notification-storage-db'
import { cleanupLocalStorage } from './utils/cleanupLocalStorage'
import { BackgroundNotificationLoader } from './components/BackgroundNotificationLoader'
import { debug } from '@bsky/shared'
import { analytics } from './services/analytics'
import { usePageTracking, useErrorTracking } from './hooks/useAnalytics'
import './utils/debug-control' // Initialize debug controls

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes - increased to prevent frequent refetches
      gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep data in cache much longer
      retry: (failureCount, error: any) => {
        if (error?.status === 429) return false // Don't retry rate limits
        if (error?.status === 401) return false // Don't retry auth errors
        return failureCount < 3
      },
      // Keep previous data while fetching new data
      placeholderData: (previousData: any) => previousData,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data exists
      refetchOnMount: false,
      // Prevent UI flicker by using structural sharing
      structuralSharing: true
    }
  }
})

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Initialize analytics tracking
  usePageTracking()
  useErrorTracking()
  
  // Run one-time migration on app load
  useEffect(() => {
    const runMigration = async () => {
      try {
        const db = NotificationStorageDB.getInstance()
        await db.init()
        const migrated = await db.migrateFromLocalStorage()
        if (migrated) {
          debug.log('✅ Successfully migrated notifications from localStorage to IndexedDB')
          // Clean up remaining localStorage keys
          cleanupLocalStorage()
        }
      } catch (error) {
        debug.error('Failed to run migration:', error)
      }
    }
    
    runMigration()
  }, [])

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
    return <LandingPage />
  }

  return (
    <div className="min-h-screen bsky-font" style={{ background: 'var(--bsky-bg-primary)' }}>
      <BackgroundNotificationLoader />
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 mt-16 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-y-auto">
          <Routes>
            <Route path="/home" element={<SkyDeck />} />
            <Route path="/" element={<SkyDeck />} />
            <Route path="/timeline" element={
              <div className="h-full overflow-y-auto">
                <VisualTimeline />
              </div>
            } />
            <Route path="/analytics" element={<NotificationsAnalytics />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/compose" element={<Composer />} />
            <Route path="/search" element={<Search />} />
            <Route path="/compression-test" element={<CompressionTest />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
      <RateLimitStatus />
      <DebugConsole />
    </div>
  )
}

function App() {
  // Initialize Google Analytics
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
    if (measurementId) {
      analytics.initialize(measurementId)
      debug.log('Google Analytics initialized')
    } else {
      debug.log('Google Analytics not configured (no measurement ID)')
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter 
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App