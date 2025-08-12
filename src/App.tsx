import { debug } from "@bsky/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BackgroundNotificationLoader } from "./components/BackgroundNotificationLoader";
import { Bookmarks } from "./components/Bookmarks";
import { Composer } from "./components/Composer";
import { CompressionTest } from "./components/CompressionTest";
import { ConversationsSimple as Conversations } from "./components/ConversationsSimple";
import { DebugConsole } from "./components/DebugConsole";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { MobileTabBar } from "./components/MobileTabBar";
import { Notifications } from "./components/Notifications";
import { NotificationsAnalytics } from "./components/NotificationsAnalytics";
import { RateLimitStatus } from "./components/RateLimitStatus";
import { Search } from "./components/Search";
import { Sidebar } from "./components/Sidebar";
import SkyDeck from "./components/SkyDeck";
import { VisualTimeline } from "./components/VisualTimeline";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HiddenPostsProvider } from "./contexts/HiddenPostsContext";
import { ModerationProvider } from "./contexts/ModerationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useErrorTracking, usePageTracking } from "./hooks/useAnalytics";
import ProfilePage from "./pages/ProfilePage";
import { Settings } from "./pages/Settings";
import { analytics } from "./services/analytics";
import { bookmarkStorage } from "./services/bookmark-storage-db";
import { NotificationStorageDB } from "./services/notification-storage-db";
import { cleanupLocalStorage } from "./utils/cleanupLocalStorage";
import "./utils/debug-control"; // Initialize debug controls

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

  // Initialize analytics tracking
  usePageTracking();
  useErrorTracking();

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
    >
      <BackgroundNotificationLoader />
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="mt-16 min-h-[calc(100vh-4rem)] flex-1 pb-16 lg:ml-64 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-0">
          <Routes>
            <Route path="/home" element={<SkyDeck />} />
            <Route path="/" element={<SkyDeck />} />
            <Route path="/timeline" element={<VisualTimeline />} />
            <Route path="/analytics" element={<NotificationsAnalytics />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/compose" element={<Composer />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile/:handle" element={<ProfilePage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:section" element={<Settings />} />
            <Route path="/compression-test" element={<CompressionTest />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
      <MobileTabBar />
      <RateLimitStatus />
      <DebugConsole />
    </div>
  );
}

function App() {
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
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <HiddenPostsProvider>
              <ModerationProvider>
                <AppContent />
              </ModerationProvider>
            </HiddenPostsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
