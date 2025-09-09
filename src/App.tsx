import { debug } from "@bsky/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { BackgroundNotificationLoader } from "./components/BackgroundNotificationLoader";
import { CommandPalette } from "./components/CommandPalette";
import { DebugConsole } from "./components/DebugConsole";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { MobileTabBar } from "./components/MobileTabBar";
import { StorageErrorProvider } from "./components/providers/StorageErrorProvider";
import { RateLimitStatus } from "./components/RateLimitStatus";
import { Sidebar } from "./components/Sidebar";
import { SwipeIndicator } from "./components/SwipeIndicator";
import { FloatingActionButton } from "./components/ui/FloatingActionButton";
import { PageLoader } from "./components/ui/PageLoader";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HiddenPostsProvider } from "./contexts/HiddenPostsContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ModerationProvider } from "./contexts/ModerationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useErrorTracking, usePageTracking } from "./hooks/useAnalytics";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { analytics } from "./services/analytics";
import { bookmarkStorage } from "./services/bookmark-storage-db";
import { NotificationStorageDB } from "./services/notification-storage-db";
import { cleanupLocalStorage } from "./utils/cleanupLocalStorage";
import "./utils/debug-control"; // Initialize debug controls
import { removeTrailingSlash } from "./utils/removeTrailingSlash";

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
const Conversations = lazy(() =>
  import("./components/ConversationsSimple").then((m) => ({
    default: m.ConversationsSimple,
  })),
);
const DirectMessages = lazy(() =>
  import("./components/DirectMessages").then((m) => ({
    default: m.DirectMessages,
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
  import("./components/Search").then((m) => ({ default: m.Search })),
);
const SkyDeck = lazy(() => import("./components/SkyDeck"));
const VisualTimeline = lazy(() =>
  import("./components/VisualTimeline").then((m) => ({
    default: m.VisualTimeline,
  })),
);
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes - increased to prevent frequent refetches
      gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep data in cache much longer
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status === 429) return false; // Don't retry rate limits
        if (err?.status === 401) return false; // Don't retry auth errors
        return failureCount < 3;
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
  },
});

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Initialize swipe navigation for mobile
  const swipeHandlers = useSwipeNavigation();

  // Initialize analytics tracking
  usePageTracking();
  useErrorTracking();

  // Set up command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-collapse sidebar when viewport is too narrow for 3 columns
  useEffect(() => {
    const checkViewportWidth = () => {
      // Sidebar: 256px, 3 columns: 3*400px + 2*12px gap + 24px padding = 1248px
      // Total needed: 1504px
      const shouldCollapse =
        window.innerWidth < 1504 && window.innerWidth >= 1024; // Only on desktop
      setIsSidebarCollapsed(shouldCollapse);
    };

    checkViewportWidth();
    window.addEventListener("resize", checkViewportWidth);
    return () => window.removeEventListener("resize", checkViewportWidth);
  }, []);

  // Run one-time migration on app load
  useEffect(() => {
    const runMigration = async () => {
      try {
        // Initialize bookmark storage
        await bookmarkStorage.init();

        const db = NotificationStorageDB.getInstance();
        await db.init();
        const migrated = await db.migrateFromLocalStorage();
        if (migrated) {
          debug.log(
            "✅ Successfully migrated notifications from localStorage to IndexedDB",
          );
          // Clean up remaining localStorage keys
          cleanupLocalStorage();
        }
      } catch (error) {
        debug.error("Failed to run migration:", error);
      }
    };

    runMigration();
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

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div
      className="bsky-font min-h-screen"
      style={{ background: "var(--bsky-bg-primary)" }}
      {...swipeHandlers}
    >
      <BackgroundNotificationLoader />
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
        />
        <main
          className={`mt-16 min-h-[calc(100vh-4rem)] flex-1 pb-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-0 ${isSidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/home" element={<SkyDeck />} />
              <Route path="/" element={<SkyDeck />} />
              <Route path="/timeline" element={<VisualTimeline />} />
              <Route path="/analytics" element={<NotificationsAnalytics />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/messages" element={<DirectMessages />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/compose" element={<Composer />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile/:handle" element={<ProfilePage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/:section" element={<Settings />} />
              <Route path="/compression-test" element={<CompressionTest />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <MobileTabBar />
      <FloatingActionButton />
      <SwipeIndicator />
      <RateLimitStatus />
      <DebugConsole />
      <ColumnMigrationNotice />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
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
          <AuthProvider>
            <ModalProvider>
              <HiddenPostsProvider>
                <ModerationProvider>
                  <StorageErrorProvider>
                    <AppContent />
                  </StorageErrorProvider>
                </ModerationProvider>
              </HiddenPostsProvider>
            </ModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
