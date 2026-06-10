import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorInfo, lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalErrorFallback } from "./components/GlobalErrorFallback";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { MobileTabBar } from "./components/MobileTabBar";
import { OAuthCallback } from "./components/OAuthCallback";
import { ProviderComposer } from "./components/providers/ProviderComposer";
import { StorageErrorProvider } from "./components/providers/StorageErrorProvider";
import { Sidebar } from "./components/Sidebar";
import { AriaLiveProvider } from "./components/ui/AriaLiveRegion";
import { InlineErrorBoundary } from "./components/ui/InlineErrorBoundary";
import { ConnectedOfflineIndicator } from "./components/ui/OfflineIndicator";
import { SkipLinks } from "./components/ui/SkipLinks";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { ActionSyncProvider } from "./contexts/ActionSyncContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HiddenPostsProvider } from "./contexts/HiddenPostsContext";
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
} from "./contexts/KeyboardShortcutsContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ModerationProvider } from "./contexts/ModerationContext";
import { StatusBarProvider } from "./contexts/StatusBarContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { getInitialLoadingStrategy } from "./hooks/useNetworkAwareLoading";
import { usePendingMutationsWarning } from "./hooks/usePendingMutationsWarning";
import { useSidebarManagement } from "./hooks/useSidebarManagement";
import { useStorageInitialization } from "./hooks/useStorageInitialization";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { useViewTransitionNavigate } from "./hooks/useViewTransitionNavigate";
import "./utils/debug-control"; // Initialize debug controls
import { removeTrailingSlash } from "./utils/removeTrailingSlash";

// Static imports for core components
import { BackgroundNotificationLoader } from "./components/BackgroundNotificationLoader";
import { RealtimeUpdatesLoader } from "./components/RealtimeUpdatesLoader";
import { ColumnMigrationNotice } from "./components/ColumnMigrationNotice";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsHelp } from "./components/KeyboardShortcutsHelp";
import { NetworkWeatherBackground } from "./components/NetworkWeatherBackground";
import { OnboardingFlow } from "./components/onboarding";
import { StatusBar } from "./components/StatusBar";
import { SwipeIndicator } from "./components/SwipeIndicator";
import { FloatingActionButton } from "./components/ui/FloatingActionButton";
import { WeatherBar } from "./components/WeatherBar";
import { getKeyboardShortcuts } from "./config/keyboardShortcuts";
import { AppRoutes } from "./config/routes";
import { useNetworkWeather } from "./hooks/useNetworkWeather";
import { onboardingService } from "./services/onboarding-service";

// Keep lazy loading only for rarely-used dev/debug tools
const DebugConsole = lazy(() =>
  import("./components/DebugConsole").then((m) => ({
    default: m.DebugConsole,
  })),
);
const DevPerformanceOverlay = lazy(() =>
  import("./components/DevPerformanceOverlay").then((m) => ({
    default: m.DevPerformanceOverlay,
  })),
);
const WebSocketStressPanel = lazy(() =>
  import("./components/dev/WebSocketStressPanel").then((m) => ({
    default: m.WebSocketStressPanel,
  })),
);

// Network and device-aware query client settings
// Adapts caching and retry behavior based on connection quality
// Note: These are captured once at startup. For dynamic updates, the query
// client's retry functions read live values where possible.
function createAppQueryClient(): QueryClient {
  const loadingStrategy = getInitialLoadingStrategy();
  const isMobile = window.innerWidth < 768;
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Adaptive stale/cache times based on network quality
        staleTime: loadingStrategy.queryStaleTime,
        gcTime: loadingStrategy.queryCacheTime,
        retry: (failureCount, error: unknown) => {
          const err = error as { status?: number };
          // Client errors (4xx) won't succeed on retry: bad/deleted records
          // (400), auth (401), forbidden (403), missing (404), rate limits
          // (429). Retrying just multiplies console noise and load.
          if (err?.status && err.status >= 400 && err.status < 500) {
            return false;
          }
          // Fewer retries on slow connections to save battery/data
          const currentIsMobile = window.innerWidth < 768;
          const maxRetries =
            loadingStrategy.quality === "poor" ? 0 : currentIsMobile ? 1 : 3;
          return failureCount < maxRetries;
        },
        // Keep previous data while fetching new data
        placeholderData: <T,>(previousData: T) => previousData,
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false,
        // Don't refetch on mount if data exists
        refetchOnMount: false,
        // Prevent UI flicker by using structural sharing
        structuralSharing: true,
        // Disable network requests when offline
        networkMode:
          loadingStrategy.quality === "offline" ? "offlineFirst" : "online",
      },
      mutations: {
        // Reduce retry attempts on slow connections
        retry: loadingStrategy.quality === "poor" ? 0 : isMobile ? 0 : 2,
        // Queue mutations when offline
        networkMode:
          loadingStrategy.quality === "offline" ? "offlineFirst" : "online",
      },
    },
  });
}

const queryClient = createAppQueryClient();

function AppContent() {
  const { isAuthenticated, isLoading, session, agent } = useAuth();
  const location = useLocation();
  const navigate = useViewTransitionNavigate();
  const { isShortcutsHelpOpen, setIsShortcutsHelpOpen } =
    useKeyboardShortcutsContext();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Use extracted hooks for cleaner code
  const { isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed } =
    useSidebarManagement(isAuthenticated);

  useStorageInitialization();

  // Warn before closing tab/window if there are unsynced offline mutations
  usePendingMutationsWarning();

  // Check if user needs onboarding (user-specific)
  useEffect(() => {
    if (isAuthenticated && agent && session?.did) {
      onboardingService.setAgent(agent);
      onboardingService.setCurrentUser(session.did);

      // If already marked complete in local storage, skip
      if (onboardingService.isCompleted()) {
        setNeedsOnboarding(false);
        return;
      }

      // For users with no saved state, check if they're existing users
      // (already following people) to avoid showing onboarding to returning users
      onboardingService.isExistingUser().then((isExisting) => {
        if (isExisting) {
          // Auto-complete onboarding for existing users
          onboardingService.markCompleted();
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      });
    }
  }, [isAuthenticated, agent, session?.did]);

  // Check if we're on the home route
  const { data: networkWeather } = useNetworkWeather();

  // Initialize swipe navigation for mobile
  const swipeHandlers = useSwipeNavigation();

  // Set up global keyboard shortcuts using extracted configuration
  const shortcuts = getKeyboardShortcuts(
    navigate,
    session,
    setIsCommandPaletteOpen,
    setIsShortcutsHelpOpen,
  );
  useKeyboardShortcuts(shortcuts, isAuthenticated);

  // Listen for keyboard-navigate custom events from KeyboardShortcutsContext
  // This handles the g+key navigation sequences (g+h, g+n, g+m, etc.)
  useEffect(() => {
    const handleKeyboardNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ to: string }>;
      const destination = customEvent.detail.to;

      // Handle profile navigation specially since it needs the user's handle
      if (destination === "/profile" && session?.handle) {
        navigate(`/profile/${session.handle}`);
      } else if (destination !== "/profile") {
        navigate(destination);
      }
    };

    window.addEventListener(
      "keyboard-navigate",
      handleKeyboardNavigate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "keyboard-navigate",
        handleKeyboardNavigate as EventListener,
      );
    };
  }, [navigate, session?.handle]);

  // Handle OAuth callback route BEFORE loading check — the callback must
  // process immediately so initializeAuth doesn't discard the pending session.
  if (location.pathname === "/oauth/callback") {
    return <OAuthCallback />;
  }

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--asph-bg-primary)" }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2"
            style={{ borderColor: "var(--asph-primary)" }}
          ></div>
          <p className="mt-4" style={{ color: "var(--asph-text-secondary)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Show onboarding flow for new users
  if (needsOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setNeedsOnboarding(false);
          navigate("/home");
        }}
      />
    );
  }

  return (
    <div
      className="asph-font min-h-screen"
      style={{ background: "var(--asph-bg-primary)" }}
      {...swipeHandlers}
    >
      {/* Skip navigation links for keyboard users - WCAG 2.4.1 Bypass Blocks */}
      <SkipLinks />
      <InlineErrorBoundary componentName="BackgroundNotificationLoader" silent>
        <Suspense fallback={null}>
          <BackgroundNotificationLoader />
        </Suspense>
      </InlineErrorBoundary>
      <InlineErrorBoundary componentName="RealtimeUpdatesLoader" silent>
        <Suspense fallback={null}>
          <RealtimeUpdatesLoader />
        </Suspense>
      </InlineErrorBoundary>
      <InlineErrorBoundary componentName="Header">
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      </InlineErrorBoundary>
      {/* Offline/reconnection status indicator */}
      <ConnectedOfflineIndicator position="top" />
      <WeatherBar weather={networkWeather} />
      <div className="relative flex mx-auto 2xl:max-w-[1536px]">
        <InlineErrorBoundary componentName="Sidebar">
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
          />
        </InlineErrorBoundary>
        <NetworkWeatherBackground weather={networkWeather} />
        <main
          id="main-content"
          role="main"
          aria-label="Main content"
          className={`mt-16 min-h-[calc(100vh-4rem)] flex-1 pb-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-0`}
        >
          <AppRoutes />
        </main>
      </div>
      <InlineErrorBoundary componentName="MobileTabBar" silent>
        <MobileTabBar />
      </InlineErrorBoundary>
      {/* Lazy loaded UI components — wrapped so overlay failures don't crash the app */}
      <InlineErrorBoundary componentName="Overlays" silent>
        <Suspense fallback={null}>
          <FloatingActionButton />
          <SwipeIndicator />
          <StatusBar />
          <DebugConsole />
          <DevPerformanceOverlay />
          <WebSocketStressPanel />
          <ColumnMigrationNotice />
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
          <KeyboardShortcutsHelp
            isOpen={isShortcutsHelpOpen}
            onClose={() => setIsShortcutsHelpOpen(false)}
          />
        </Suspense>
      </InlineErrorBoundary>
    </div>
  );
}

function App() {
  // Remove trailing slashes on initial load
  useEffect(() => {
    removeTrailingSlash();
  }, []);

  // Define provider stack for clean composition
  const providers = [
    ThemeProvider,
    AccessibilityProvider,
    AriaLiveProvider,
    AuthProvider,
    KeyboardShortcutsProvider,
    WebSocketProvider,
    ModalProvider,
    ToastProvider,
    HiddenPostsProvider,
    ModerationProvider,
    ActionSyncProvider,
    StorageErrorProvider,
    StatusBarProvider,
  ];

  // Global error handler for the entire app
  const handleGlobalError = (error: Error, errorInfo: ErrorInfo) => {
    // Log to console for immediate visibility
    console.error("Global error caught:", error, errorInfo);

    // Store error in localStorage for tracking
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        context: "global",
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      const errors = JSON.parse(localStorage.getItem("app_errors") || "[]");
      errors.push(errorData);
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.shift();
      }
      localStorage.setItem("app_errors", JSON.stringify(errors));
    } catch (e) {
      console.error("Failed to store global error:", e);
    }
  };

  return (
    <ErrorBoundary
      componentName="App"
      fallback={<GlobalErrorFallback />}
      onError={handleGlobalError}
      showGoBack={false}
      showReportLink={true}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ProviderComposer providers={providers}>
            <AppContent />
          </ProviderComposer>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
