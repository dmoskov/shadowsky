import { useEffect, useRef, useState } from "react";
import { columnFeedPrefs } from "../utils/cookies";
import { BookmarksColumn } from "./BookmarksColumn";
import { ColumnHeader } from "./ColumnHeader";
import { ConversationsSimple as Conversations } from "./ConversationsSimple";
import { DirectMessages } from "./DirectMessages";
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
  const [hasScrollTop, setHasScrollTop] = useState(false);
  const [hasScrollBottom, setHasScrollBottom] = useState(false);
  const [currentFeedLabel, setCurrentFeedLabel] = useState<string>("");
  const [feedOptions, setFeedOptions] = useState<any[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [showFeedDiscovery, setShowFeedDiscovery] = useState(false);
  const [selectedFeedUri, setSelectedFeedUri] = useState<string | undefined>(
    () => {
      // For feed columns, check saved preferences first
      if (column.type === "feed" && column.id) {
        const savedFeed = columnFeedPrefs.getFeedForColumn(column.id);
        if (savedFeed) {
          return savedFeed;
        }
      }
      // Fall back to column's data
      return column.data;
    },
  );

  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          scrollContainerRef.current;
        setHasScrollTop(scrollTop > 10);
        setHasScrollBottom(scrollTop < scrollHeight - clientHeight - 10);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", checkScroll);
      checkScroll(); // Initial check
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", checkScroll);
      }
    };
  }, []);

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

  // Render different components based on column type
  const renderContent = () => {
    switch (column.type) {
      case "notifications":
        return <NotificationsFeed />;

      case "timeline":
        return (
          <VisualTimeline
            hideTimeLabels={true}
            isInSkyDeck={true}
            isFocused={isFocused}
          />
        );

      case "conversations":
        return <Conversations isFocused={isFocused} />;

      case "messages":
        return <DirectMessages />;

      case "bookmarks":
        return <BookmarksColumn isFocused={isFocused} />;

      case "feed":
        // Use the Home component for all feed columns
        return (
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
              ? (feedUri: string) => {
                  setSelectedFeedUri(feedUri);
                  // Save to column-specific preferences if columnId exists
                  if (column.id) {
                    columnFeedPrefs.setFeedForColumn(column.id, feedUri);
                  }
                  setRefreshCounter((prev) => prev + 1);
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
            className="bsky-scrollbar h-full overflow-y-auto"
          >
            {renderContent()}
          </div>
          {/* Fade overlays positioned outside the scroll container */}
          <div
            className={`scroll-shadow-overlay pointer-events-none absolute inset-0 ${
              hasScrollTop ? "has-scroll-top" : ""
            } ${hasScrollBottom ? "has-scroll-bottom" : ""}`}
          />
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
