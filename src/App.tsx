import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { MobileTabBar } from "./components/MobileTabBar";
import { OAuthCallback } from "./components/OAuthCallback";
import { ProviderComposer } from "./components/providers/ProviderComposer";
import { StorageErrorProvider } from "./components/providers/StorageErrorProvider";
import { Sidebar } from "./components/Sidebar";
import { AriaLiveProvider } from "./components/ui/AriaLiveRegion";
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
import { useSidebarManagement } from "./hooks/useSidebarManagement";
import { useStorageInitialization } from "./hooks/useStorageInitialization";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import "./utils/debug-control"; // Initialize debug controls
import { removeTrailingSlash } from "./utils/removeTrailingSlash";

// Static imports for core components
import { BackgroundNotificationLoader } from "./components/BackgroundNotificationLoader";
import { ColumnMigrationNotice } from "./components/ColumnMigrationNotice";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsHelp } from "./components/KeyboardShortcutsHelp";
import { StatusBar } from "./components/StatusBar";
import { SwipeIndicator } from "./components/SwipeIndicator";
import { FloatingActionButton } from "./components/ui/FloatingActionButton";
import { getKeyboardShortcuts } from "./config/keyboardShortcuts";
import { AppRoutes } from "./config/routes";

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
const loadingStrategy = getInitialLoadingStrategy();
const isMobile = window.innerWidth < 768;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Adaptive stale/cache times based on network quality
      staleTime: loadingStrategy.queryStaleTime,
      gcTime: loadingStrategy.queryCacheTime,
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status === 429) return false; // Don't retry rate limits
        if (err?.status === 401) return false; // Don't retry auth errors
        // Fewer retries on slow connections to save battery/data
        const maxRetries =
          loadingStrategy.quality === "poor" ? 0 : isMobile ? 1 : 3;
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

function AppContent() {
  const { isAuthenticated, isLoading, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isShortcutsHelpOpen, setIsShortcutsHelpOpen } =
    useKeyboardShortcutsContext();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Use extracted hooks for cleaner code
  const { isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed } =
    useSidebarManagement(isAuthenticated);

  useStorageInitialization();

  // Check if we're on the home route
  const isHomeRoute =
    location.pathname === "/" || location.pathname === "/home";

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

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bsky-bg-primary)" }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2"
            style={{ borderColor: "var(--bsky-primary)" }}
          ></div>
          <p className="mt-4" style={{ color: "var(--bsky-text-secondary)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Handle OAuth callback route - this should work regardless of auth state
  if (location.pathname === "/oauth/callback") {
    return <OAuthCallback />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div
      className="bsky-font min-h-screen"
      style={{ background: "var(--bsky-bg-primary)" }}
      {...swipeHandlers}
    >
      {/* Skip navigation links for keyboard users - WCAG 2.4.1 Bypass Blocks */}
      <SkipLinks />
      <Suspense fallback={null}>
        <BackgroundNotificationLoader />
      </Suspense>
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      {/* Offline/reconnection status indicator */}
      <ConnectedOfflineIndicator position="top" />
      <div
        className={`relative flex ${isHomeRoute ? "" : "mx-auto 2xl:max-w-[1536px]"}`}
      >
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
        />
        <main
          id="main-content"
          role="main"
          aria-label="Main content"
          className={`mt-16 min-h-[calc(100vh-4rem)] flex-1 pb-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-0`}
        >
          <AppRoutes />
        </main>
      </div>
      <MobileTabBar />
      {/* Lazy loaded UI components */}
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

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProviderComposer providers={providers}>
          <ErrorBoundary componentName="Application">
            <AppContent />
          </ErrorBoundary>
        </ProviderComposer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
