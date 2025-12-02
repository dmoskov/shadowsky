import { debug } from "@bsky/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { MobileTabBar } from "./components/MobileTabBar";
import { OAuthCallback } from "./components/OAuthCallback";
import { StorageErrorProvider } from "./components/providers/StorageErrorProvider";
import { Sidebar } from "./components/Sidebar";
import { AriaLiveProvider } from "./components/ui/AriaLiveRegion";
import { PageLoader } from "./components/ui/PageLoader";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HiddenPostsProvider } from "./contexts/HiddenPostsContext";
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
} from "./contexts/KeyboardShortcutsContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ModerationProvider } from "./contexts/ModerationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { useErrorTracking, usePageTracking } from "./hooks/useAnalytics";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { analytics } from "./services/analytics";
import { appPreferencesService } from "./services/app-preferences-service";
import { initializeCoreStorage } from "./services/data-services-initializer";
import { NotificationStorageDB } from "./services/notification-storage-db";
import { cleanupLocalStorage } from "./utils/cleanupLocalStorage";
import "./utils/debug-control"; // Initialize debug controls
import { removeTrailingSlash } from "./utils/removeTrailingSlash";

// Lazy load non-critical components that are conditionally rendered
const BackgroundNotificationLoader = lazy(() =>
  import("./components/BackgroundNotificationLoader").then((m) => ({
    default: m.BackgroundNotificationLoader,
  })),
);
const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
const DebugConsole = lazy(() =>
  import("./components/DebugConsole").then((m) => ({
    default: m.DebugConsole,
  })),
);
const KeyboardShortcutsHelp = lazy(() =>
  import("./components/KeyboardShortcutsHelp").then((m) => ({
    default: m.KeyboardShortcutsHelp,
  })),
);
const NotificationPermissionPrompt = lazy(() =>
  import("./components/NotificationPermissionPrompt").then((m) => ({
    default: m.NotificationPermissionPrompt,
  })),
);
const RateLimitStatus = lazy(() =>
  import("./components/RateLimitStatus").then((m) => ({
    default: m.RateLimitStatus,
  })),
);
const ServiceWorkerUpdatePrompt = lazy(() =>
  import("./components/ServiceWorkerUpdatePrompt").then((m) => ({
    default: m.ServiceWorkerUpdatePrompt,
  })),
);
const SwipeIndicator = lazy(() =>
  import("./components/SwipeIndicator").then((m) => ({
    default: m.SwipeIndicator,
  })),
);
const FloatingActionButton = lazy(() =>
  import("./components/ui/FloatingActionButton").then((m) => ({
    default: m.FloatingActionButton,
  })),
);
const WebSocketStatus = lazy(() =>
  import("./components/WebSocketStatus").then((m) => ({
    default: m.WebSocketStatus,
  })),
);
const MutationQueueStatus = lazy(() =>
  import("./components/MutationQueueStatus").then((m) => ({
    default: m.MutationQueueStatus,
  })),
);

// Lazy load route components for better performance
const Bookmarks = lazy(() =>
  import("./components/Bookmarks").then((m) => ({ default: m.Bookmarks })),
);
const ColumnMigrationNotice = lazy(() =>
  import("./components/ColumnMigrationNotice").then((m) => ({
    default: m.ColumnMigrationNotice,
  })),
);
const Composer = lazy(() =>
  import("./components/Composer").then((m) => ({ default: m.Composer })),
);
const CompressionTest = lazy(() =>
  import("./components/CompressionTest").then((m) => ({
    default: m.CompressionTest,
  })),
);
const DirectMessages = lazy(() =>
  import("./components/DirectMessages").then((m) => ({
    default: m.DirectMessages,
  })),
);
const Lists = lazy(() =>
  import("./components/Lists").then((m) => ({ default: m.Lists })),
);
const ListTimeline = lazy(() =>
  import("./components/ListTimeline").then((m) => ({
    default: m.ListTimeline,
  })),
);
const Notifications = lazy(() =>
  import("./components/Notifications").then((m) => ({
    default: m.Notifications,
  })),
);
const NotificationsAnalytics = lazy(() =>
  import("./components/NotificationsAnalytics").then((m) => ({
    default: m.NotificationsAnalytics,
  })),
);
const Search = lazy(() =>
  import("./components/SearchTabbed").then((m) => ({
    default: m.SearchTabbed,
  })),
);
const ScheduledPosts = lazy(() =>
  import("./components/ScheduledPosts").then((m) => ({
    default: m.ScheduledPosts,
  })),
);
const SkyDeck = lazy(() => import("./components/SkyDeck"));
const VisualTimeline = lazy(() =>
  import("./components/VisualTimeline").then((m) => ({
    default: m.VisualTimeline,
  })),
);
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ThreadPage = lazy(() => import("./pages/ThreadPage"));
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const UserAnalytics = lazy(() =>
  import("./pages/UserAnalytics").then((m) => ({ default: m.UserAnalytics })),
);

// Wrapper components that use route params as keys to force remount on navigation
// This ensures all component state resets when navigating between different items
function ProfilePageWithKey() {
  const { handle } = useParams<{ handle: string }>();
  return <ProfilePage key={handle} />;
}

function ThreadPageWithKey() {
  const { handle, postId } = useParams<{ handle: string; postId: string }>();
  return <ThreadPage key={`${handle}/${postId}`} />;
}

function ListTimelineWithKey() {
  const { listId } = useParams<{ listId: string }>();
  return <ListTimeline key={listId} />;
}

// Mobile-optimized query client settings
const isMobile = window.innerWidth < 768;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // More aggressive cleanup for mobile to prevent memory issues
      staleTime: isMobile ? 15 * 60 * 1000 : 30 * 60 * 1000, // 15/30 minutes
      gcTime: isMobile ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000, // 30 mins/2 hours
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status === 429) return false; // Don't retry rate limits
        if (err?.status === 401) return false; // Don't retry auth errors
        // Fewer retries on mobile to save battery/data
        return failureCount < (isMobile ? 1 : 3);
      },
      // Keep previous data while fetching new data
      placeholderData: <T,>(previousData: T) => previousData,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data exists
      refetchOnMount: false,
      // Prevent UI flicker by using structural sharing
      structuralSharing: true,
    },
    mutations: {
      // Reduce retry attempts on mobile
      retry: isMobile ? 0 : 2,
    },
  },
});

function AppContent() {
  const { isAuthenticated, isLoading, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isShortcutsHelpOpen, setIsShortcutsHelpOpen } =
    useKeyboardShortcutsContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Check if we're on the home route
  const isHomeRoute =
    location.pathname === "/" || location.pathname === "/home";

  // Initialize swipe navigation for mobile
  const swipeHandlers = useSwipeNavigation();

  // Initialize analytics tracking
  usePageTracking();
  useErrorTracking();

  // Set up global keyboard shortcuts
  useKeyboardShortcuts(
    [
      // Command palette
      {
        key: "k",
        meta: true,
        description: "Open command palette",
        category: "General",
        action: () => setIsCommandPaletteOpen(true),
      },
      // Help - Shift+? opens shortcuts help (/ without shift focuses search, handled in KeyboardShortcutsContext)
      {
        key: "?",
        shift: true,
        description: "Show keyboard shortcuts",
        category: "General",
        action: () => setIsShortcutsHelpOpen(true),
      },
      // Navigation shortcuts
      {
        key: "h",
        meta: true,
        description: "Go to home",
        category: "Navigation",
        action: () => navigate("/home"),
      },
      {
        key: "n",
        meta: true,
        description: "Go to notifications",
        category: "Navigation",
        action: () => navigate("/notifications"),
      },
      {
        key: "m",
        meta: true,
        description: "Go to messages",
        category: "Navigation",
        action: () => navigate("/messages"),
      },
      {
        key: "b",
        meta: true,
        description: "Go to bookmarks",
        category: "Navigation",
        action: () => navigate("/bookmarks"),
      },
      {
        key: "p",
        meta: true,
        description: "Go to profile",
        category: "Navigation",
        action: () => {
          if (session?.handle) {
            navigate(`/profile/${session.handle}`);
          }
        },
      },
      {
        key: "/",
        meta: true,
        description: "Go to search",
        category: "Navigation",
        action: () => navigate("/search"),
      },
      {
        key: ",",
        meta: true,
        description: "Open settings",
        category: "Navigation",
        action: () => navigate("/settings"),
      },
      // Single key shortcuts (vim-style)
      {
        key: "c",
        description: "Compose new post",
        category: "Actions",
        action: () => navigate("/compose"),
      },
    ],
    isAuthenticated,
  );

  // Auto-collapse sidebar when viewport is too narrow for 3 columns
  useEffect(() => {
    const checkViewportWidth = async () => {
      // Get column width from preferences
      if (isAuthenticated) {
        const prefs = await appPreferencesService.getPreferences();
        const columnWidth = prefs?.columnWidth || 320;

        // Sidebar: 256px, 3 columns: 3*columnWidth + 2*12px gap + 24px padding
        const totalNeeded = 256 + 3 * columnWidth + 2 * 12 + 24;
        const shouldCollapse =
          window.innerWidth < totalNeeded && window.innerWidth >= 1024; // Only on desktop
        setIsSidebarCollapsed(shouldCollapse);
      } else {
        // Default calculation if not authenticated
        const shouldCollapse =
          window.innerWidth < 1280 && window.innerWidth >= 1024;
        setIsSidebarCollapsed(shouldCollapse);
      }
    };

    checkViewportWidth();
    window.addEventListener("resize", checkViewportWidth);
    return () => window.removeEventListener("resize", checkViewportWidth);
  }, [isAuthenticated]);

  // Initialize core storage backends and run one-time migration on app load
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // Initialize core storage via StorageManager (api-cache, offline-storage, notification-storage)
        // This replaces scattered individual initializations with coordinated error handling
        await initializeCoreStorage();
        debug.log("✅ Core storage backends initialized");

        // Run notification migration after core storage is ready
        const db = NotificationStorageDB.getInstance();
        const migrated = await db.migrateFromLocalStorage();
        if (migrated) {
          debug.log(
            "✅ Successfully migrated notifications from localStorage to IndexedDB",
          );
          // Clean up remaining localStorage keys
          cleanupLocalStorage();
        }
      } catch (error) {
        debug.error("Failed to initialize core storage:", error);
      }
    };

    initializeStorage();
  }, []);

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
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Skip to main content
      </a>
      <Suspense fallback={null}>
        <BackgroundNotificationLoader />
      </Suspense>
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/home" element={<SkyDeck />} />
              <Route path="/" element={<SkyDeck />} />
              <Route path="/timeline" element={<VisualTimeline />} />
              <Route path="/analytics" element={<UserAnalytics />} />
              <Route
                path="/analytics/notifications"
                element={<NotificationsAnalytics />}
              />
              <Route path="/notifications" element={<Notifications />} />
              <Route
                path="/messages"
                element={
                  <ErrorBoundary
                    componentName="Direct Messages"
                    onError={(error) => {
                      analytics.trackError(error, "DirectMessages");
                    }}
                  >
                    <DirectMessages />
                  </ErrorBoundary>
                }
              />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route
                path="/lists"
                element={
                  <ErrorBoundary
                    componentName="Lists"
                    onError={(error) => {
                      analytics.trackError(error, "Lists");
                    }}
                  >
                    <Lists />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/lists/:listId"
                element={
                  <ErrorBoundary
                    componentName="List Timeline"
                    onError={(error) => {
                      analytics.trackError(error, "ListTimeline");
                    }}
                  >
                    <ListTimelineWithKey />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/compose"
                element={
                  <ErrorBoundary
                    componentName="Composer"
                    onError={(error) => {
                      analytics.trackError(error, "Composer");
                    }}
                  >
                    <Composer />
                  </ErrorBoundary>
                }
              />
              <Route path="/search" element={<Search />} />
              <Route
                path="/scheduled"
                element={
                  <ErrorBoundary
                    componentName="Scheduled Posts"
                    onError={(error) => {
                      analytics.trackError(error, "ScheduledPosts");
                    }}
                  >
                    <ScheduledPosts />
                  </ErrorBoundary>
                }
              />
              <Route path="/profile/:handle" element={<ProfilePageWithKey />} />
              <Route
                path="/thread/:handle/:postId"
                element={<ThreadPageWithKey />}
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/:section" element={<Settings />} />
              <Route path="/compression-test" element={<CompressionTest />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <MobileTabBar />
      {/* Lazy loaded UI components */}
      <Suspense fallback={null}>
        <FloatingActionButton />
        <SwipeIndicator />
        <RateLimitStatus />
        <WebSocketStatus />
        <MutationQueueStatus />
        <NotificationPermissionPrompt />
        <DebugConsole />
        <ColumnMigrationNotice />
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <KeyboardShortcutsHelp
          isOpen={isShortcutsHelpOpen}
          onClose={() => setIsShortcutsHelpOpen(false)}
        />
        <ServiceWorkerUpdatePrompt />
      </Suspense>
    </div>
  );
}

function App() {
  // Remove trailing slashes on initial load
  useEffect(() => {
    removeTrailingSlash();
  }, []);

  // Initialize Google Analytics
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (measurementId) {
      analytics.initialize(measurementId);
      debug.log("Google Analytics initialized");
    } else {
      debug.log("Google Analytics not configured (no measurement ID)");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AccessibilityProvider>
            <AriaLiveProvider>
              <AuthProvider>
                <KeyboardShortcutsProvider>
                  <WebSocketProvider>
                    <ModalProvider>
                      <HiddenPostsProvider>
                        <ModerationProvider>
                          <StorageErrorProvider>
                            <ErrorBoundary
                              componentName="Application"
                              onError={(error) => {
                                analytics.trackError(error, "App");
                              }}
                            >
                              <AppContent />
                            </ErrorBoundary>
                          </StorageErrorProvider>
                        </ModerationProvider>
                      </HiddenPostsProvider>
                    </ModalProvider>
                  </WebSocketProvider>
                </KeyboardShortcutsProvider>
              </AuthProvider>
            </AriaLiveProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
