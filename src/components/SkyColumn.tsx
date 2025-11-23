import { ArrowUp, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useErrorTracking } from "../hooks/useErrorTracking";
import { columnService } from "../services/column-service";
import { useStorageErrorManager } from "../services/storage/storage-error-manager";
import { BookmarksColumn } from "./BookmarksColumn";
import { ColumnHeader } from "./ColumnHeader";
import { DirectMessagesColumn } from "./DirectMessagesColumn";
import { ErrorBoundary } from "./ErrorBoundary";
import { Home } from "./Home";
import { NotificationsFeed } from "./NotificationsFeed";
import type { Column } from "./SkyDeck";
import { VisualTimeline } from "./VisualTimeline";

interface SkyColumnProps {
  column: Column;
  onClose: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  chromeless?: boolean;
  isFocused?: boolean;
}

export default function SkyColumn({
  column,
  onClose,
  onMoveLeft,
  onMoveRight,
  chromeless = false,
  isFocused = false,
}: SkyColumnProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const checkScroll = () => {
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      // Check the column's scroll container first
      if (scrollContainerRef.current) {
        scrollTop = scrollContainerRef.current.scrollTop;
        scrollHeight = scrollContainerRef.current.scrollHeight;
        clientHeight = scrollContainerRef.current.clientHeight;
      }

      // In mobile view, check window scroll
      if (scrollTop === 0 && window.innerWidth < 768) {
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      }

      setHasScrollTop(scrollTop > 10);
      setHasScrollBottom(scrollTop < scrollHeight - clientHeight - 10);
      // Show scroll button when scrolled down more than 200px
      setShowScrollButton(scrollTop > 200);
    };

    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", checkScroll);
    }

    // Also listen to window scroll in mobile view
    window.addEventListener("scroll", checkScroll);

    checkScroll(); // Initial check

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("scroll", checkScroll);
    };
  }, [column.type]);

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
  const scrollToTop = () => {
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
  };

  // Combined scroll to top and refresh function
  const scrollToTopAndRefresh = async () => {
    if (column.type === "feed") {
      setIsRefreshing(true);
      scrollToTop();
      setRefreshCounter((prev) => prev + 1);
      // Add a small delay to show the refresh animation
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  };

  // Render different components based on column type
  const renderContent = () => {
    switch (column.type) {
      case "notifications":
        return (
          <ErrorBoundary
            componentName="Notifications"
            onError={(error, errorInfo) =>
              logError(error, errorInfo, "NotificationsFeed")
            }
          >
            <NotificationsFeed />
          </ErrorBoundary>
        );

      case "timeline":
        return (
          <ErrorBoundary
            componentName="Timeline"
            onError={(error, errorInfo) =>
              logError(error, errorInfo, "VisualTimeline")
            }
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
            onError={(error, errorInfo) =>
              logError(error, errorInfo, "DirectMessagesColumn")
            }
          >
            <DirectMessagesColumn />
          </ErrorBoundary>
        );

      case "bookmarks":
        return (
          <ErrorBoundary
            componentName="Bookmarks"
            onError={(error, errorInfo) =>
              logError(error, errorInfo, "BookmarksColumn")
            }
          >
            <BookmarksColumn isFocused={isFocused} />
          </ErrorBoundary>
        );

      case "feed":
        return (
          <ErrorBoundary
            componentName="Feed"
            onError={(error, errorInfo) => logError(error, errorInfo, "Home")}
          >
            <Home
              initialFeedUri={selectedFeedUri || column.data}
              isFocused={isFocused}
              columnId={column.id}
              onFeedChange={(_, label, options) => {
                setCurrentFeedLabel(label);
                setFeedOptions(options);
              }}
              onRefreshRequest={refreshCounter}
              showFeedDiscovery={showFeedDiscovery}
              onCloseFeedDiscovery={() => setShowFeedDiscovery(false)}
            />
          </ErrorBoundary>
        );

      default:
        return (
          <div className="py-8 text-center">
            <p className="text-gray-500 dark:text-gray-300">
              Column type "{column.type}" coming soon
            </p>
          </div>
        );
    }
  };

  // Render content with header
  const renderContentWithHeader = () => {
    return (
      <div className="flex h-full flex-col">
        <ColumnHeader
          column={column}
          onRemove={() => onClose()}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          onRefresh={
            column.type === "feed"
              ? () => setRefreshCounter((prev) => prev + 1)
              : undefined
          }
          onFeedChange={
            column.type === "feed"
              ? async (feedUri: string) => {
                  // Optimistic update
                  const previousFeedUri = selectedFeedUri;
                  setSelectedFeedUri(feedUri);
                  setRefreshCounter((prev) => prev + 1);

                  // Save to column-specific preferences if columnId exists
                  if (column.id) {
                    try {
                      await columnService.updateColumnFeedPreference(
                        column.id,
                        feedUri,
                      );
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
                }
              : undefined
          }
          currentFeedLabel={
            column.type === "feed" ? currentFeedLabel : undefined
          }
          feedOptions={column.type === "feed" ? feedOptions : undefined}
          onDiscoverFeeds={
            column.type === "feed"
              ? () => setShowFeedDiscovery(true)
              : undefined
          }
        />
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="bsky-scrollbar h-full overflow-y-auto overflow-x-hidden"
          >
            {renderContent()}
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
                className={`bg-primary hover:bg-primary/90 group relative rounded-full p-3 text-white shadow-lg transition-all hover:shadow-xl ${
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
                className="bg-primary hover:bg-primary/90 group relative rounded-full p-3 text-white shadow-lg transition-all hover:shadow-xl"
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
          document.documentElement.classList.contains("dark") ? "dark" : "light"
        }
      >
        {renderContent()}
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
}
