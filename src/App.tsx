import { useState, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
// import { performanceTracker, setPerformanceContext } from './lib/performance-tracking'
import { 
  Login,
  Feed,
  Header,
  Sidebar,
  ErrorBoundary,
  ComposeModal,
  ThreadView,
  Profile,
  Notifications,
  Search,
  KeyboardShortcutsModal,
  ToastProvider,
  ToastContainer,
  ScrollProgress,
  MobileNav
} from './components'
// Import directly since they're not in the index
import { Settings } from './components/settings/Settings'
import { Analytics } from './components/analytics/Analytics'
// These components are not in the index export
import { MobileMenu } from './components/core/MobileMenu'
import { MobileTabBar } from './components/core/MobileTabBar'
import { ErrorBadge } from './components/common/ErrorBadge'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { queryClient } from './lib/query-client'
import { PenSquare } from 'lucide-react'
import './App.css'

function ThreadViewWrapper() {
  const { uri } = useParams<{ uri: string }>()
  const navigate = useNavigate()
  
  console.log('ThreadViewWrapper - raw URI from params:', uri);
  
  if (!uri) return null
  
  const decodedUri = decodeURIComponent(uri);
  console.log('ThreadViewWrapper - decoded URI:', decodedUri);
  
  return (
    <ThreadView 
      key={decodedUri}
      postUri={decodedUri}
      onBack={() => navigate('/')}
    />
  )
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [composeTemplate, setComposeTemplate] = useState<string | undefined>()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  
  // Enable keyboard navigation
  useKeyboardNavigation()
  
  // Track route changes for performance monitoring
  // useEffect(() => {
  //   setPerformanceContext({ route: location.pathname })
  // }, [location.pathname])
  
  // Add global performance command for developers
  // useEffect(() => {
  //   // @ts-ignore - Adding to window for dev access
  //   window.showPerformance = () => performanceTracker.getSummary()
  //   console.log('💡 Tip: Type showPerformance() in console to see performance metrics')
  // }, [])
  
  // Listen for compose modal events
  useEffect(() => {
    const handleOpenCompose = (event: CustomEvent) => {
      setComposeTemplate(event.detail?.template)
      setIsComposeOpen(true)
    }
    
    window.addEventListener('openComposeModal', handleOpenCompose as EventListener)
    return () => {
      window.removeEventListener('openComposeModal', handleOpenCompose as EventListener)
    }
  }, [])

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
      <ScrollProgress />
      <div className="app-layout app-container">
        <Header onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <div className="app-body">
          <Sidebar onCompose={() => setIsComposeOpen(true)} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={
                <Feed onViewThread={(uri) => navigate(`/thread/${encodeURIComponent(uri)}`)} />
              } />
              <Route path="/thread/:uri" element={<ThreadViewWrapper />} />
              <Route path="/profile/:handle" element={<Profile />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/search" element={<Search />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/analytics/:handle" element={<Analytics />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
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
        onClose={() => {
          setIsComposeOpen(false)
          setComposeTemplate(undefined)
        }}
        template={composeTemplate}
      />
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal />
      
      {/* Mobile Navigation */}
      <MobileTabBar />
      <MobileNav />
      
      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      {/* Toast Notifications */}
      <ToastContainer />
      {import.meta.env.DEV && <ErrorBadge />}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
