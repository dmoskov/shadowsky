import { ArrowUp, RefreshCw } from "lucide-react";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useErrorTracking } from "../hooks/useErrorTracking";
import { useScrollContainerGPU } from "../hooks/useGPUAcceleration";
import { useRAFScroll } from "../hooks/useRAFScroll";
import { columnService } from "../services/column-service";
import type { ScrollState } from "../services/scroll-batching-service";
import { useStorageErrorManager } from "../services/storage/storage-error-manager";
import type { Column } from "../types/column";
import { BookmarksColumn } from "./BookmarksColumn";
import { ColumnHeader } from "./ColumnHeader";
import { DirectMessagesColumn } from "./DirectMessagesColumn";
import { ErrorBoundary } from "./ErrorBoundary";
import { Home } from "./Home";
import { NotificationsFeed } from "./NotificationsFeed";
import { SearchColumn } from "./SearchColumn";
import { TrendingColumn } from "./TrendingColumn";
import { VisualTimeline } from "./VisualTimeline";

interface SkyColumnProps {
  column: Column;
  onClose: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  chromeless?: boolean;
  isFocused?: boolean;
}

const SkyColumn = memo(
  function SkyColumn({
    column,
    onClose,
    onMoveLeft,
    onMoveRight,
    chromeless = false,
    isFocused = false,
  }: SkyColumnProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const gpuScrollRef = useScrollContainerGPU();
    const { handleStorageError } = useStorageErrorManager();
    const { logError } = useErrorTracking();
    const [hasScrollTop, setHasScrollTop] = useState(false);
    const [hasScrollBottom, setHasScrollBottom] = useState(false);
    const [currentFeedLabel, setCurrentFeedLabel] = useState<string>("");
    const [feedOptions, setFeedOptions] = useState<any[]>([]);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [showFeedDiscovery, setShowFeedDiscovery] = useState(false);
    const [selectedFeedUri, setSelectedFeedUri] = useState<string | undefined>(
      () => {
        // The column.data already contains the selected feed from storage
        return column.data;
      },
    );
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Use RAF-batched scroll handling for both element and window
    const handleScrollUpdate = useCallback((state: ScrollState) => {
      // Get scroll dimensions based on source
      let scrollTop: number;
      let scrollHeight: number;
      let clientHeight: number;

      if (state.source === "element" && scrollContainerRef.current) {
        scrollTop = scrollContainerRef.current.scrollTop;
        scrollHeight = scrollContainerRef.current.scrollHeight;
        clientHeight = scrollContainerRef.current.clientHeight;
      } else {
        // Window scroll - used on mobile
        scrollTop = state.scrollY;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      }

      setHasScrollTop(scrollTop > 10);
      setHasScrollBottom(scrollTop < scrollHeight - clientHeight - 10);
      setShowScrollButton(scrollTop > 200);
    }, []);

    // Subscribe to element scroll (for desktop column view)
    useRAFScroll(handleScrollUpdate, {
      element: scrollContainerRef.current,
    });

    // Subscribe to window scroll (for mobile view)
    useRAFScroll(handleScrollUpdate);

    // Initial check on mount
    useEffect(() => {
      handleScrollUpdate({
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        previousScrollY: 0,
        direction: 0,
        velocity: 0,
        timestamp: performance.now(),
        isScrolling: false,
        source: "window",
      });
    }, [handleScrollUpdate, column.type]);

    // Listen for refresh feed events (from mobile tab bar double tap)
    useEffect(() => {
      const handleRefreshFeed = () => {
        // Only refresh if this is a feed column and it's focused (on mobile, there's only one visible column)
        if (column.type === "feed") {
          setRefreshCounter((prev) => prev + 1);
        }
      };

      window.addEventListener("refreshFeed", handleRefreshFeed);
      return () => {
        window.removeEventListener("refreshFeed", handleRefreshFeed);
      };
    }, [column.type]);

    // Scroll to top function with smooth animation
    const scrollToTop = useCallback(() => {
      // Try the column's scroll container first
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.scrollTop > 0
      ) {
        scrollContainerRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } else if (window.innerWidth < 768) {
        // In mobile view, scroll the window
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, []);

    // Combined scroll to top and refresh function
    const scrollToTopAndRefresh = useCallback(async () => {
      if (column.type === "feed") {
        setIsRefreshing(true);
        scrollToTop();
        setRefreshCounter((prev) => prev + 1);
        // Add a small delay to show the refresh animation
        setTimeout(() => {
          setIsRefreshing(false);
        }, 1000);
      }
    }, [column.type, scrollToTop]);

    // Memoized callbacks for Home component
    const handleFeedChange = useCallback(
      (_: unknown, label: string, options: unknown[]) => {
        setCurrentFeedLabel(label);
        setFeedOptions(options);
      },
      [],
    );

    const handleCloseFeedDiscovery = useCallback(() => {
      setShowFeedDiscovery(false);
    }, []);

    // Memoized error handlers for ErrorBoundary components
    const handleNotificationsError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "NotificationsFeed");
      },
      [logError],
    );

    const handleTimelineError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "VisualTimeline");
      },
      [logError],
    );

    const handleMessagesError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "DirectMessagesColumn");
      },
      [logError],
    );

    const handleBookmarksError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "BookmarksColumn");
      },
      [logError],
    );

    const handleSearchError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "SearchColumn");
      },
      [logError],
    );

    const handleHomeError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "Home");
      },
      [logError],
    );

    const handleTrendingError = useCallback(
      (error: Error, errorInfo: React.ErrorInfo) => {
        logError(error, errorInfo, "TrendingColumn");
      },
      [logError],
    );

    // Render different components based on column type
    const content = useMemo(() => {
      switch (column.type) {
        case "notifications":
          return (
            <ErrorBoundary
              componentName="Notifications"
              onError={handleNotificationsError}
            >
              <NotificationsFeed />
            </ErrorBoundary>
          );

        case "timeline":
          return (
            <ErrorBoundary
              componentName="Timeline"
              onError={handleTimelineError}
            >
              <VisualTimeline
                hideTimeLabels={true}
                isInSkyDeck={true}
                isFocused={isFocused}
              />
            </ErrorBoundary>
          );

        case "messages":
          return (
            <ErrorBoundary
              componentName="Direct Messages"
              onError={handleMessagesError}
            >
              <DirectMessagesColumn />
            </ErrorBoundary>
          );

        case "bookmarks":
          return (
            <ErrorBoundary
              componentName="Bookmarks"
              onError={handleBookmarksError}
            >
              <BookmarksColumn isFocused={isFocused} />
            </ErrorBoundary>
          );

        case "search":
          return (
            <ErrorBoundary componentName="Search" onError={handleSearchError}>
              <SearchColumn isFocused={isFocused} initialQuery={column.data} />
            </ErrorBoundary>
          );

        case "feed":
          return (
            <ErrorBoundary componentName="Feed" onError={handleHomeError}>
              <Home
                initialFeedUri={selectedFeedUri || column.data}
                isFocused={isFocused}
                columnId={column.id}
                onFeedChange={handleFeedChange}
                onRefreshRequest={refreshCounter}
                showFeedDiscovery={showFeedDiscovery}
                onCloseFeedDiscovery={handleCloseFeedDiscovery}
              />
            </ErrorBoundary>
          );

        case "trending":
          return (
            <ErrorBoundary
              componentName="Trending"
              onError={handleTrendingError}
            >
              <TrendingColumn isFocused={isFocused} />
            </ErrorBoundary>
          );

        default:
          return (
            <div className="py-8 text-center">
              <p className="text-asph-text-tertiary">
                Column type "{column.type}" coming soon
              </p>
            </div>
          );
      }
    }, [
      column.type,
      column.data,
      column.id,
      isFocused,
      selectedFeedUri,
      refreshCounter,
      showFeedDiscovery,
      handleFeedChange,
      handleCloseFeedDiscovery,
      handleNotificationsError,
      handleTimelineError,
      handleMessagesError,
      handleBookmarksError,
      handleSearchError,
      handleHomeError,
      handleTrendingError,
    ]);

    // Memoized event handlers for ColumnHeader
    const handleRemove = useCallback(() => {
      onClose();
    }, [onClose]);

    const handleRefresh = useCallback(() => {
      setRefreshCounter((prev) => prev + 1);
    }, []);

    const handleHeaderFeedChange = useCallback(
      async (feedUri: string) => {
        // Optimistic update
        const previousFeedUri = selectedFeedUri;
        setSelectedFeedUri(feedUri);
        setRefreshCounter((prev) => prev + 1);

        // Save to column-specific preferences if columnId exists
        if (column.id) {
          try {
            await columnService.updateColumnFeedPreference(column.id, feedUri);
          } catch (error) {
            // Revert on error
            setSelectedFeedUri(previousFeedUri);
            setRefreshCounter((prev) => prev + 1);

            // Show error to user
            handleStorageError(
              error instanceof Error
                ? error
                : new Error("Failed to save feed preference"),
              "update feed preference",
            );
          }
        }
      },
      [column.id, selectedFeedUri, handleStorageError],
    );

    const handleDiscoverFeeds = useCallback(() => {
      setShowFeedDiscovery(true);
    }, []);

    // Render content with header
    const renderContentWithHeader = () => {
      return (
        <div className="flex h-full flex-col">
          <ColumnHeader
            column={column}
            onRemove={handleRemove}
            onMoveLeft={onMoveLeft}
            onMoveRight={onMoveRight}
            onRefresh={column.type === "feed" ? handleRefresh : undefined}
            onFeedChange={
              column.type === "feed" ? handleHeaderFeedChange : undefined
            }
            currentFeedLabel={
              column.type === "feed" ? currentFeedLabel : undefined
            }
            feedOptions={column.type === "feed" ? feedOptions : undefined}
            onDiscoverFeeds={
              column.type === "feed" ? handleDiscoverFeeds : undefined
            }
          />
          <div className="relative flex-1 overflow-hidden">
            <div
              ref={(el) => {
                // Combine refs: scrollContainerRef for local state, gpuScrollRef for GPU acceleration
                (
                  scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
                ).current = el;
                gpuScrollRef(el);
              }}
              className="gpu-scroll-container asph-scrollbar h-full overflow-y-auto overflow-x-hidden"
            >
              {column.type === "feed" && (
                <WeatherBar weather={networkWeather} />
              )}
              {content}
            </div>
            {/* Fade overlays positioned outside the scroll container */}
            <div
              className={`scroll-shadow-overlay pointer-events-none absolute inset-0 ${
                hasScrollTop ? "has-scroll-top" : ""
              } ${hasScrollBottom ? "has-scroll-bottom" : ""}`}
            />
            {/* Floating scroll-to-top button with refresh option */}
            {column.type === "feed" && showScrollButton && (
              <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 pb-16 sm:pb-0">
                {/* Refresh button */}
                <button
                  onClick={scrollToTopAndRefresh}
                  className={`touch-target bg-primary hover:bg-primary/90 group relative rounded-full p-3 text-white shadow-lg transition-all hover:shadow-xl ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                  title="Refresh feed"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span className="absolute -left-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                    Refresh
                  </span>
                </button>
                {/* Scroll to top button */}
                <button
                  onClick={scrollToTop}
                  className="touch-target bg-primary hover:bg-primary/90 group relative rounded-full p-3 text-white shadow-lg transition-all hover:shadow-xl"
                  title="Scroll to top"
                >
                  <ArrowUp className="h-5 w-5" />
                  <span className="absolute -left-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                    Back to top
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    };

    if (chromeless) {
      // In chromeless mode, render content directly without wrapper
      return (
        <div
          data-theme={
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light"
          }
        >
          {content}
        </div>
      );
    }

    return (
      <div
        className="relative flex h-full flex-col overflow-hidden"
        data-theme={
          document.documentElement.classList.contains("dark") ? "dark" : "light"
        }
      >
        {renderContentWithHeader()}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if these specific props change
    return (
      prevProps.column.id === nextProps.column.id &&
      prevProps.column.type === nextProps.column.type &&
      prevProps.column.data === nextProps.column.data &&
      prevProps.chromeless === nextProps.chromeless &&
      prevProps.isFocused === nextProps.isFocused &&
      // For callbacks, we compare by reference
      // Since parent components should memoize these, reference equality is sufficient
      prevProps.onClose === nextProps.onClose &&
      prevProps.onMoveLeft === nextProps.onMoveLeft &&
      prevProps.onMoveRight === nextProps.onMoveRight
    );
  },
);

export default SkyColumn;
