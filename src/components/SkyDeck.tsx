import {
  Bell,
  Bookmark,
  Clock,
  Rss,
  Loader2,
  Mail,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { useColumnSwipe } from "../hooks/useColumnSwipe";
import { useHasBeenVisible } from "../hooks/useHasBeenVisible";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  DEFAULT_COLUMN_WIDTH,
  appPreferencesService,
} from "../services/app-preferences-service";
import { columnService } from "../services/column-service";
import type { Column, ColumnType } from "../types/column";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { createLogger } from "../utils/logger";
import SkyColumn from "./SkyColumn";
import { useDeckFeeds } from "./useDeckFeeds";

// Re-export types for backwards compatibility
export type { Column, ColumnType } from "../types/column";

const logger = createLogger("SkyDeck");

const FeedDiscovery = lazyWithRetry(() =>
  import("./FeedDiscovery").then((m) => ({ default: m.FeedDiscovery })),
);

/**
 * Column types you can add by hand. Feeds are not on this list: feed columns
 * come from your Bluesky saved feeds (see useDeckFeeds), so the way to add one
 * is to save the feed, not to add a column.
 */
const columnOptions = [
  {
    type: "notifications" as ColumnType,
    label: "Notifications",
    icon: Bell,
    description: "All your notifications",
  },
  {
    type: "timeline" as ColumnType,
    label: "Visual Timeline",
    icon: Clock,
    description: "Timeline visualization",
  },
  {
    type: "messages" as ColumnType,
    label: "Messages",
    icon: Mail,
    description: "Direct messages",
  },
  {
    type: "bookmarks" as ColumnType,
    label: "Bookmarks",
    icon: Bookmark,
    description: "Your saved posts",
  },
  {
    type: "search" as ColumnType,
    label: "Search",
    icon: Search,
    description: "Search posts on Bluesky",
  },
  {
    type: "trending" as ColumnType,
    label: "Trending",
    icon: TrendingUp,
    description: "Live trending topics",
  },
];

/**
 * One deck column, which only loads once it has been scrolled near.
 *
 * A wide deck derives one column per saved feed, and every feed column used to
 * fire its own timeline request on mount — a dozen saved feeds meant a dozen
 * parallel fetches of 30 posts each before the reader had scrolled anywhere.
 * The observer lives here, per column, because hooks can't be called from
 * inside the map above.
 */
function DeckColumn({
  column,
  width,
  isFocused,
  onFocus,
  onClose,
}: {
  column: Column;
  width: number;
  isFocused: boolean;
  onFocus: () => void;
  onClose?: (columnId: string) => void;
}) {
  const { ref, hasBeenVisible } = useHasBeenVisible<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`h-full shrink-0 rounded-lg border border-asph-border-primary bg-asph-bg-secondary shadow-md transition-all duration-300 ease-out ${
        isFocused
          ? "shadow-xl ring-2 ring-blue-500/30"
          : "hover:shadow-lg dark:hover:shadow-black/30"
      }`}
      style={{ width: `${width}px` }}
      onClickCapture={(e) => {
        // Don't focus column if clicking the remove button
        const target = e.target as HTMLElement;
        if (!target.closest('button[title="Remove column"]')) {
          onFocus();
        }
      }}
    >
      <SkyColumn
        column={column}
        onClose={onClose}
        isFocused={isFocused}
        isVisible={hasBeenVisible}
      />
    </div>
  );
}

export default function SkyDeck() {
  const { agent } = useAuth();
  // Columns the user added by hand. Feed columns are derived, not stored.
  const [extraColumns, setExtraColumns] = useState<Column[]>([]);
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [showFeedDiscovery, setShowFeedDiscovery] = useState(false);
  // Narrow view for screens below tailwind's md breakpoint (768px). Driven by
  // matchMedia (via useMediaQuery) so it only updates when the breakpoint flips,
  // not on every resize event — keeps the resize gesture smooth.
  const isNarrowView = useMediaQuery("(max-width: 767px)");
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  // 0 = full-width single column (the default). A saved non-zero width from
  // Settings > Appearance opts into multi-column deck mode.
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH);
  // How many saved feeds to show. Undefined means all of them.
  const [feedColumnLimit, setFeedColumnLimit] = useState<number | undefined>(
    undefined,
  );
  const columnsContainerRef = useRef<HTMLDivElement>(null);
  const columnSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extrasLoadedRef = useRef(false);

  const { feeds: feedColumns, isLoading: feedsLoading } =
    useDeckFeeds(feedColumnLimit);

  const columns = useMemo(
    () => [...feedColumns, ...extraColumns],
    [feedColumns, extraColumns],
  );

  // Handle keyboard navigation between columns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields or when modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        document.body.classList.contains("thread-modal-open") ||
        document.body.classList.contains("conversation-modal-open")
      ) {
        return;
      }

      // Column navigation with arrows and h/l (vim-style)
      if (e.key === "ArrowLeft" || e.key === "h") {
        e.preventDefault();
        setFocusedColumnIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        setFocusedColumnIndex((prev) => Math.min(columns.length - 1, prev + 1));
      }
      // Space bar to scroll within focused column
      else if (e.key === " " && !e.shiftKey) {
        e.preventDefault();
        // Find the focused column's scroll container
        const columnElements =
          columnsContainerRef.current?.querySelectorAll(".column-wrapper");
        const focusedColumn = columnElements?.[focusedColumnIndex];
        const scrollContainer = focusedColumn?.querySelector(".asph-scrollbar");
        if (scrollContainer) {
          scrollContainer.scrollBy({
            top: scrollContainer.clientHeight * 0.8,
            behavior: "smooth",
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [columns.length, focusedColumnIndex]);

  // Keep the focused index inside the deck as feeds come and go
  useEffect(() => {
    if (columns.length > 0 && focusedColumnIndex > columns.length - 1) {
      setFocusedColumnIndex(columns.length - 1);
    }
    if (columns.length > 0 && mobileColumnIndex > columns.length - 1) {
      setMobileColumnIndex(columns.length - 1);
    }
  }, [columns.length, focusedColumnIndex, mobileColumnIndex]);

  // Scroll focused column into view
  useEffect(() => {
    if (columnsContainerRef.current && columns.length > 0) {
      const container = columnsContainerRef.current;
      const columnElements = container.querySelectorAll(".column-wrapper");
      const focusedElement = columnElements[focusedColumnIndex] as HTMLElement;

      if (focusedElement) {
        focusedElement.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }, [focusedColumnIndex, columns.length]);

  // Handle searchTopic events from TrendingColumn
  useEffect(() => {
    const handleSearchTopic = (event: CustomEvent<{ topic: string }>) => {
      const topic = event.detail.topic;
      if (!topic) return;

      // Add a new search column with the topic as the initial query
      const newColumn: Column = {
        id: Date.now().toString(),
        type: "search",
        title: `Search: ${topic}`,
        data: topic,
      };

      setExtraColumns((prev) => [...prev, newColumn]);
    };

    window.addEventListener("searchTopic", handleSearchTopic as EventListener);
    return () => {
      window.removeEventListener(
        "searchTopic",
        handleSearchTopic as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const loadExtras = async () => {
      if (!agent || extrasLoadedRef.current) return;
      extrasLoadedRef.current = true;

      // Initialize column service with the current storage type from preferences
      appPreferencesService.setAgent(agent);
      const appPreferences = await appPreferencesService.getPreferences();
      const storageType = appPreferences?.columnStorageType || "local";
      await columnService.initialize(agent, storageType);

      // Set column width from preferences (0 = full width)
      if (appPreferences && appPreferences.columnWidth != null) {
        setColumnWidth(appPreferences.columnWidth);
      }
      if (appPreferences && appPreferences.columnCount != null) {
        setFeedColumnLimit(appPreferences.columnCount);
      }

      // Drop stored feed columns, including the old hardcoded "home" column.
      // Feeds are derived from saved feeds now, so anything left over here is
      // a stale snapshot from the previous layout model.
      const savedColumns = await columnService.getColumns();
      setExtraColumns(
        (savedColumns || []).filter(
          (col: Column) => col.type !== "feed" && col.id !== "home",
        ),
      );
      setExtrasLoaded(true);
    };

    loadExtras();
  }, [agent]);

  // Save extra columns using column service - only after initial load, debounced.
  // Runs even when the list is empty so a layout left over from the snapshot
  // model gets cleaned out of storage.
  useEffect(() => {
    if (agent && extrasLoaded) {
      if (columnSaveTimerRef.current) {
        clearTimeout(columnSaveTimerRef.current);
      }
      columnSaveTimerRef.current = setTimeout(() => {
        columnService.importColumns(extraColumns).catch((error) => {
          logger.error("Failed to save columns:", error);
        });
      }, 500);
    }
    return () => {
      if (columnSaveTimerRef.current) {
        clearTimeout(columnSaveTimerRef.current);
      }
    };
  }, [extraColumns, agent, extrasLoaded]);

  const handleAddColumn = useCallback((type: ColumnType) => {
    const newColumn: Column = {
      id: Date.now().toString(),
      type: type,
      title: columnOptions.find((opt) => opt.type === type)?.label || type,
    };

    setExtraColumns((prev) => [...prev, newColumn]);
    setIsAddingColumn(false);
  }, []);

  const handleRemoveColumn = useCallback((id: string) => {
    setExtraColumns((prev) => {
      const columnToRemove = prev.find((col) => col.id === id);
      if (!columnToRemove) return prev;

      columnService.deleteColumn(columnToRemove.id).catch((error) => {
        logger.error("Failed to delete column:", error);
      });
      return prev.filter((col) => col.id !== id);
    });
  }, []);

  const handleOpenFeedDiscovery = useCallback(() => {
    setIsAddingColumn(false);
    setShowFeedDiscovery(true);
  }, []);

  // Mobile swipe handlers
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const { swipeHandlers } = useColumnSwipe({
    totalColumns: columns.length,
    currentIndex: mobileColumnIndex,
    onIndexChange: setMobileColumnIndex,
    containerRef: mobileContainerRef,
  });

  const isFullWidth = columnWidth === 0;

  // Helper to get icon for a column type
  const getColumnIcon = (type: ColumnType) => {
    const option = columnOptions.find((opt) => opt.type === type);
    return option?.icon || Rss;
  };

  // Feed columns are derived, so only the extras can be closed from the column
  // itself. Feeds are removed by unsaving them.
  const closeHandlerFor = (column: Column) =>
    column.savedFeedId ? undefined : handleRemoveColumn;

  const feedDiscoveryModal = showFeedDiscovery ? (
    <Suspense fallback={null}>
      <FeedDiscovery
        isOpen={showFeedDiscovery}
        onClose={() => setShowFeedDiscovery(false)}
      />
    </Suspense>
  ) : null;

  const addColumnOptions = (
    <div className="grid gap-2">
      {columnOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.type}
            onClick={() => handleAddColumn(option.type)}
            className="touch-target flex items-start gap-3 rounded-md border border-asph-border-primary p-3 text-left transition-colors hover:bg-asph-bg-hover"
          >
            <Icon className="mt-0.5 h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium text-asph-text-primary">
                {option.label}
              </div>
              <div className="whitespace-normal text-sm text-asph-text-tertiary">
                {option.description}
              </div>
            </div>
          </button>
        );
      })}

      <div className="mt-2 border-t border-asph-border-primary pt-3">
        <p className="mb-2 px-1 text-sm text-asph-text-tertiary">
          Feed columns come from your saved feeds, in the order you saved them.
        </p>
        <button
          onClick={handleOpenFeedDiscovery}
          className="touch-target flex w-full items-center gap-3 rounded-md border border-asph-border-primary p-3 text-left transition-colors hover:bg-asph-bg-hover"
        >
          <Rss className="h-5 w-5 text-blue-500" />
          <span className="font-medium text-asph-text-primary">
            Manage feeds
          </span>
        </button>
      </div>
    </div>
  );

  if (!extrasLoaded || (feedsLoading && columns.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center bg-asph-bg-primary">
        <Loader2
          className="h-6 w-6 animate-spin text-asph-text-tertiary"
          aria-label="Loading feeds"
        />
      </div>
    );
  }

  // Reachable only if preferences failed to load — every account has at least
  // the Following feed saved. Without this, full-width mode would render a
  // zero-width add button and strand the user on a blank page.
  if (columns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-asph-bg-primary px-6 text-center">
        <p className="text-sm text-asph-text-secondary">
          Your feeds could not be loaded.
        </p>
        <button
          onClick={handleOpenFeedDiscovery}
          className="touch-target-sm rounded-md border border-asph-border-primary px-3 py-1.5 text-sm text-asph-text-secondary transition-colors hover:bg-asph-bg-hover"
        >
          Manage feeds
        </button>
        {feedDiscoveryModal}
      </div>
    );
  }

  // In narrow view, show columns with swipe navigation
  if (isNarrowView && columns.length > 0) {
    const currentColumn = columns[mobileColumnIndex] || columns[0];

    return (
      <div className="h-full overflow-hidden bg-asph-bg-primary">
        <div
          ref={mobileContainerRef}
          {...swipeHandlers}
          className="relative h-full"
        >
          <SkyColumn
            column={currentColumn}
            onClose={closeHandlerFor(currentColumn)}
            onMoveLeft={
              mobileColumnIndex > 0
                ? () => setMobileColumnIndex(mobileColumnIndex - 1)
                : undefined
            }
            onMoveRight={
              mobileColumnIndex < columns.length - 1
                ? () => setMobileColumnIndex(mobileColumnIndex + 1)
                : undefined
            }
            chromeless={false}
          />
          {/* Column dots indicator */}
          {columns.length > 1 && (
            <div className="pointer-events-none absolute bottom-20 left-0 right-0 flex justify-center gap-1.5 pb-2">
              <div className="pointer-events-auto flex gap-1.5 rounded-full bg-black/20 px-3 py-2 dark:bg-white/20">
                {columns.map((col, index) => (
                  <button
                    key={`column-dot-${col.id}-${index}`}
                    onClick={() => setMobileColumnIndex(index)}
                    className={`touch-target h-2 w-2 rounded-full transition-all ${
                      index === mobileColumnIndex
                        ? "w-6 bg-blue-500"
                        : "bg-asph-text-tertiary"
                    }`}
                    aria-label={`Go to ${col.title || `column ${index + 1}`}`}
                    aria-current={
                      index === mobileColumnIndex ? "true" : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {feedDiscoveryModal}
      </div>
    );
  }

  // Full-width single-column view (like the real Bluesky app)
  if (isFullWidth && columns.length > 0) {
    const currentColumn = columns[focusedColumnIndex] || columns[0];

    return (
      <div className="flex h-full flex-col overflow-hidden bg-asph-bg-primary">
        {/* Column tab bar. Rendered even with a single column, because this bar
            holds the only "add column" affordance in full-width mode — gating it
            on columns.length > 1 left users with no saved feeds unable to add
            a second column at all. */}
        <div className="flex items-center gap-1 border-b border-asph-border-primary bg-asph-bg-secondary px-2">
          <div className="asph-scrollbar flex flex-1 items-center gap-1 overflow-x-auto py-1">
            {columns.map((col, index) => {
              const Icon = getColumnIcon(col.type);
              return (
                <button
                  key={`tab-${col.id}`}
                  onClick={() => setFocusedColumnIndex(index)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    focusedColumnIndex === index
                      ? "bg-asph-bg-active font-medium text-asph-text-primary"
                      : "text-asph-text-secondary hover:bg-asph-bg-hover hover:text-asph-text-primary"
                  }`}
                  aria-current={
                    focusedColumnIndex === index ? "true" : undefined
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="max-w-[120px] truncate">
                    {col.title || col.type}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setIsAddingColumn(true)}
            className="shrink-0 rounded-md p-1.5 text-asph-text-tertiary transition-colors hover:bg-asph-bg-hover hover:text-asph-text-primary"
            aria-label="Add column"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Full-width column content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="mx-auto h-full w-full max-w-2xl">
            <SkyColumn
              key={currentColumn.id}
              column={currentColumn}
              onClose={closeHandlerFor(currentColumn)}
              isFocused={true}
            />
          </div>
        </div>

        {/* Add column panel (full-width mode) */}
        {isAddingColumn && (
          <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 pt-16">
            <div className="asph-scrollbar mx-4 max-h-[80vh] w-full max-w-md animate-fade-in overflow-y-auto rounded-lg border border-asph-border-primary bg-asph-bg-secondary p-4 shadow-xl">
              <h3 className="mb-3 text-sm font-medium text-asph-text-primary">
                Add Column
              </h3>
              {addColumnOptions}
              <button
                onClick={() => setIsAddingColumn(false)}
                className="mt-3 w-full rounded-md bg-asph-bg-tertiary px-4 py-2 text-asph-text-secondary transition-colors hover:bg-asph-bg-active"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {feedDiscoveryModal}
      </div>
    );
  }

  // Multi-column deck view for wider screens
  return (
    <div className="flex h-full flex-col overflow-hidden bg-asph-bg-primary">
      <div className="skydeck-columns-scrollbar flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div ref={columnsContainerRef} className="flex h-full min-w-min gap-3">
          {columns.map((column, index) => (
            <DeckColumn
              key={column.id}
              column={column}
              width={columnWidth}
              isFocused={focusedColumnIndex === index}
              onFocus={() => setFocusedColumnIndex(index)}
              onClose={closeHandlerFor(column)}
            />
          ))}

          <div
            className="h-full shrink-0"
            style={{ width: `${columnWidth}px` }}
          >
            {isAddingColumn ? (
              <div className="flex h-full animate-fade-in flex-col rounded-lg border border-asph-border-primary bg-asph-bg-secondary shadow-md">
                <div className="asph-scrollbar flex-1 overflow-y-auto p-3">
                  {addColumnOptions}
                </div>
                <div className="p-3 pt-0">
                  <button
                    onClick={() => setIsAddingColumn(false)}
                    className="touch-target-list-item w-full rounded-md bg-asph-bg-tertiary px-4 py-2 text-asph-text-secondary transition-colors hover:bg-asph-bg-active"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="touch-target group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-asph-border-secondary bg-asph-bg-secondary shadow-md transition-all duration-300 hover:border-blue-400 hover:bg-asph-bg-hover hover:shadow-lg dark:hover:border-blue-500"
                aria-label="Add new column"
              >
                <Plus
                  className="h-12 w-12 text-asph-text-tertiary group-hover:text-asph-text-secondary"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
      </div>
      {feedDiscoveryModal}
    </div>
  );
}
