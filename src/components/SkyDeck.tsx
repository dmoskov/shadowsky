import type {
  AppBskyActorDefs,
  AppBskyGraphDefs,
  BskyAgent,
} from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Clock,
  Hash,
  Mail,
  Plus,
  Search,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useModal } from "../contexts/ModalContext";
import { useColumnSwipe } from "../hooks/useColumnSwipe";
import { appPreferencesService } from "../services/app-preferences-service";
import { columnService } from "../services/column-service";
import { LOCAL_STORAGE_KEYS } from "../services/storage/storage-constants";
import type { Column, ColumnType } from "../types/column";
import { createLogger } from "../utils/logger";
import SkyColumn from "./SkyColumn";

// Re-export types for backwards compatibility
export type { Column, ColumnType } from "../types/column";

const logger = createLogger("SkyDeck");

interface FeedGenerator {
  uri: string;
  displayName: string;
  description?: string;
  avatar?: string;
}

/**
 * Build initial columns from the user's Bluesky pinned feeds.
 * Called when no saved column layout exists (first use or data loss).
 */
async function buildColumnsFromPinnedFeeds(
  agent: BskyAgent,
  homeColumn: Column,
): Promise<Column[]> {
  try {
    const prefs = await agent.getPreferences();

    // Get all pinned feeds (feed generators, lists, and timelines)
    const allPinnedFeeds =
      prefs.savedFeeds?.filter((f: AppBskyActorDefs.SavedFeed) => f.pinned) ||
      [];

    // Separate feed generators (need API lookup) from other types
    const feedGeneratorFeeds = allPinnedFeeds.filter((f) => f.type === "feed");
    const listFeeds = allPinnedFeeds.filter((f) => f.type === "list");

    if (allPinnedFeeds.length === 0) {
      return [homeColumn];
    }

    const columns: Column[] = [homeColumn];
    const now = Date.now();
    let colIndex = 0;

    // Add feed generator columns (need display names from API)
    if (feedGeneratorFeeds.length > 0) {
      const feedUris = feedGeneratorFeeds.map(
        (f: AppBskyActorDefs.SavedFeed) => f.value,
      );
      const feedResponse = await agent.app.bsky.feed.getFeedGenerators({
        feeds: feedUris,
      });

      feedGeneratorFeeds.forEach((pinnedFeed: AppBskyActorDefs.SavedFeed) => {
        const generator = feedResponse.data.feeds.find(
          (g: FeedGenerator) => g.uri === pinnedFeed.value,
        );
        if (generator) {
          columns.push({
            id: `feed-${now}-${colIndex++}`,
            type: "feed",
            title: generator.displayName,
            data: pinnedFeed.value,
          });
        }
      });
    }

    // Add list-based feed columns
    listFeeds.forEach((listFeed: AppBskyActorDefs.SavedFeed) => {
      columns.push({
        id: `feed-${now}-${colIndex++}`,
        type: "feed",
        title: "List",
        data: listFeed.value,
      });
    });

    return columns;
  } catch (error) {
    console.error(
      "[SkyDeck] Failed to build columns from pinned feeds:",
      error,
    );
    return [homeColumn];
  }
}

const columnOptions = [
  {
    type: "feed" as ColumnType,
    label: "Feed Column",
    icon: Hash,
    description: "Add another feed column",
  },
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

export default function SkyDeck() {
  const { agent } = useAuth();
  const { showAlert } = useModal();
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [isNarrowView, setIsNarrowView] = useState(false);
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  const [customFeedUri, setCustomFeedUri] = useState("");
  const [isLoadingCustomFeed, setIsLoadingCustomFeed] = useState(false);
  const [columnWidth, setColumnWidth] = useState(320); // Default width
  const columnsContainerRef = useRef<HTMLDivElement>(null);
  const columnSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnsLoadedRef = useRef(false);

  // Fetch user's saved/pinned feeds
  const { data: userPrefs } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const prefs = await agent.getPreferences();
      return prefs;
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always", // Always fetch fresh data on mount
  });

  // Fetch feed generator details for saved feeds
  const { data: feedGenerators } = useQuery({
    queryKey: ["feedGenerators", userPrefs?.savedFeeds],
    queryFn: async () => {
      if (!agent || !userPrefs?.savedFeeds?.length) return [];

      const feedUris = userPrefs.savedFeeds
        .filter(
          (feed: AppBskyActorDefs.SavedFeed): boolean => feed.type === "feed",
        )
        .map((feed: AppBskyActorDefs.SavedFeed) => feed.value);

      if (feedUris.length === 0) return [];

      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris,
        });
        return response.data.feeds;
      } catch (error) {
        logger.error("Failed to fetch feed generators:", error);
        return [];
      }
    },
    enabled: !!agent && !!userPrefs?.savedFeeds,
  });

  // Fetch user's lists (paginate through all)
  const { data: userLists } = useQuery({
    queryKey: ["userLists", agent?.session?.did],
    queryFn: async () => {
      if (!agent || !agent.session?.did) throw new Error("Not authenticated");
      const allLists: AppBskyGraphDefs.ListView[] = [];
      let cursor: string | undefined;

      do {
        const response = await agent.app.bsky.graph.getLists({
          actor: agent.session.did,
          limit: 100,
          cursor,
        });
        allLists.push(...response.data.lists);
        cursor = response.data.cursor;
      } while (cursor);

      return allLists;
    },
    enabled: !!agent?.session?.did,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Handle responsive width detection
  useEffect(() => {
    const checkWidth = () => {
      // Consider narrow view for screens less than 768px (tailwind md breakpoint)
      setIsNarrowView(window.innerWidth < 768);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

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

      setColumns((prev) => {
        // Focus the newly added column (index = prev.length, which is the last position)
        setTimeout(() => {
          setFocusedColumnIndex(prev.length);

          if (columnsContainerRef.current) {
            const container = columnsContainerRef.current;
            const newColumnElement = container.querySelector(
              ".column-wrapper:last-of-type",
            ) as HTMLElement;
            if (newColumnElement) {
              newColumnElement.scrollIntoView({
                behavior: "smooth",
                inline: "end",
                block: "nearest",
              });
            }
          }
        }, 100);

        return [...prev, newColumn];
      });
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
    const homeColumn: Column = {
      id: "home",
      type: "feed",
      title: "Home",
      data: "following", // Default to following feed
    };

    // Initialize column service and load columns
    const loadColumns = async () => {
      if (!agent || columnsLoadedRef.current) return;
      columnsLoadedRef.current = true;

      // Initialize column service with the current storage type from preferences
      appPreferencesService.setAgent(agent);
      const appPreferences = await appPreferencesService.getPreferences();
      const storageType = appPreferences?.columnStorageType || "local";
      await columnService.initialize(agent, storageType);

      // Set column width from preferences
      if (appPreferences?.columnWidth) {
        setColumnWidth(appPreferences.columnWidth);
      }

      // Load columns from service
      const savedColumns = await columnService.getColumns();

      // Detect if this is a default-only layout (empty or just the auto-created home column)
      // that should be auto-populated from the user's Bluesky pinned feeds
      const isDefaultOnly =
        !savedColumns ||
        savedColumns.length === 0 ||
        (savedColumns.length === 1 && savedColumns[0].id === "home");
      const hasUserConfigured =
        localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMNS_CONFIGURED) === "true";

      // If Dexie has only default columns but the flag says "configured",
      // a previous auto-populate set the flag before saving to Dexie completed.
      // Clear the stale flag so auto-populate can retry.
      if (isDefaultOnly && hasUserConfigured) {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.COLUMNS_CONFIGURED);
      }

      if (isDefaultOnly) {
        // Auto-populate from Bluesky pinned feeds
        const initialColumns = await buildColumnsFromPinnedFeeds(
          agent,
          homeColumn,
        );
        setColumns(initialColumns);
        if (initialColumns.length > 1) {
          // Save immediately to Dexie — don't rely on the debounced save effect,
          // because SkyDeck may remount (route change) before the timer fires
          await columnService.importColumns(initialColumns);
          localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMNS_CONFIGURED, "true");
        }
      } else if (savedColumns && savedColumns.length > 0) {
        // Ensure the first column is always Home
        if (savedColumns[0].id !== "home") {
          const restoredColumns = [
            homeColumn,
            ...savedColumns.filter((col: Column) => col.id !== "home"),
          ];
          setColumns(restoredColumns);
        } else {
          setColumns(savedColumns);
        }
      } else {
        setColumns([homeColumn]);
      }
      // Mark columns as loaded
      setColumnsLoaded(true);
    };

    loadColumns();
  }, [agent]);

  // Save columns using column service - only after initial load, debounced
  useEffect(() => {
    if (columns.length > 0 && agent && columnsLoaded) {
      if (columnSaveTimerRef.current) {
        clearTimeout(columnSaveTimerRef.current);
      }
      columnSaveTimerRef.current = setTimeout(() => {
        columnService.importColumns(columns).catch((error) => {
          logger.error("Failed to save columns:", error);
        });
      }, 500);
    }
    return () => {
      if (columnSaveTimerRef.current) {
        clearTimeout(columnSaveTimerRef.current);
      }
    };
  }, [columns, agent, columnsLoaded]);

  const handleAddColumn = useCallback(
    (type: ColumnType, feedUri?: string, feedTitle?: string) => {
      const newColumn: Column = {
        id: Date.now().toString(),
        type: type,
        title:
          feedTitle ||
          (type === "feed"
            ? "Feed"
            : columnOptions.find((opt) => opt.type === type)?.label || type),
        data: feedUri || (type === "feed" ? "following" : undefined),
      };

      // Mark deck as manually configured so auto-populate doesn't override
      localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMNS_CONFIGURED, "true");

      setColumns((prev) => {
        // Focus the newly added column (index = prev.length, which is the last position)
        setTimeout(() => {
          setFocusedColumnIndex(prev.length);

          // Scroll to show the new column
          if (columnsContainerRef.current) {
            const container = columnsContainerRef.current;
            const newColumnElement = container.querySelector(
              ".column-wrapper:last-of-type",
            ) as HTMLElement;
            if (newColumnElement) {
              newColumnElement.scrollIntoView({
                behavior: "smooth",
                inline: "end",
                block: "nearest",
              });
            }
          }
        }, 100);

        return [...prev, newColumn];
      });
      setIsAddingColumn(false);
    },
    [],
  );

  const handleRemoveColumn = useCallback((id: string) => {
    // Don't allow removing the home column
    if (id === "home") return;

    // Mark deck as manually configured so auto-populate doesn't override
    localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMNS_CONFIGURED, "true");

    setColumns((prev) => {
      const columnToRemove = prev.find((col) => col.id === id);
      // Delete the column from the service
      if (columnToRemove) {
        columnService.deleteColumn(columnToRemove.id).catch((error) => {
          logger.error("Failed to delete column:", error);
        });
      }
      return prev.filter((col) => col.id !== id);
    });
  }, []);

  const handleMoveLeft = useCallback((columnId: string) => {
    setColumns((prev) => {
      const currentIndex = prev.findIndex((col) => col.id === columnId);
      if (currentIndex > 0) {
        const newColumns = [...prev];
        [newColumns[currentIndex - 1], newColumns[currentIndex]] = [
          newColumns[currentIndex],
          newColumns[currentIndex - 1],
        ];
        return newColumns;
      }
      return prev;
    });
  }, []);

  const handleMoveRight = useCallback((columnId: string) => {
    setColumns((prev) => {
      const currentIndex = prev.findIndex((col) => col.id === columnId);
      if (currentIndex < prev.length - 1) {
        const newColumns = [...prev];
        [newColumns[currentIndex], newColumns[currentIndex + 1]] = [
          newColumns[currentIndex + 1],
          newColumns[currentIndex],
        ];
        return newColumns;
      }
      return prev;
    });
  }, []);

  // Mobile swipe handlers
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const { swipeHandlers } = useColumnSwipe({
    totalColumns: columns.length,
    currentIndex: mobileColumnIndex,
    onIndexChange: setMobileColumnIndex,
    containerRef: mobileContainerRef,
  });

  // In narrow view, show columns with swipe navigation
  if (isNarrowView && columns.length > 0) {
    const currentColumn = columns[mobileColumnIndex] || columns[0];

    return (
      <div className="h-full overflow-hidden dark:bg-gray-900">
        <div
          ref={mobileContainerRef}
          {...swipeHandlers}
          className="relative h-full"
        >
          <SkyColumn
            column={currentColumn}
            onClose={() => handleRemoveColumn(currentColumn.id)}
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
                        : "bg-gray-400 dark:bg-gray-500"
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
      </div>
    );
  }

  // Full multi-column view for wider screens
  return (
    <div className="flex h-full flex-col overflow-hidden dark:bg-gray-900">
      <div className="skydeck-columns-scrollbar flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div ref={columnsContainerRef} className="flex h-full min-w-min gap-3">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className={`h-full shrink-0 rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-300 ease-out dark:border-gray-700 dark:bg-gray-900 ${
                focusedColumnIndex === index
                  ? "shadow-xl ring-2 ring-blue-500/30"
                  : "hover:shadow-lg dark:hover:shadow-black/30"
              }`}
              style={{ width: `${columnWidth}px` }}
              onClick={(e) => {
                // Don't focus column if clicking on menu button, menu dropdown, or remove button
                const target = e.target as HTMLElement;
                const isMenuButton = target.closest(
                  'button[aria-label="More options"]',
                );
                const isMenuDropdown = target.closest(".absolute.z-50"); // Menu dropdown has these classes
                const isRemoveButton = target.closest(
                  'button[title="Remove column"]',
                );
                if (!isMenuButton && !isMenuDropdown && !isRemoveButton) {
                  setFocusedColumnIndex(index);
                }
              }}
              onClickCapture={(e) => {
                // Don't focus column if clicking on menu button, menu dropdown, or remove button
                const target = e.target as HTMLElement;
                const isMenuButton = target.closest(
                  'button[aria-label="More options"]',
                );
                const isMenuDropdown = target.closest(".absolute.z-50"); // Menu dropdown has these classes
                const isRemoveButton = target.closest(
                  'button[title="Remove column"]',
                );
                if (!isMenuButton && !isMenuDropdown && !isRemoveButton) {
                  setFocusedColumnIndex(index);
                }
              }}
            >
              <SkyColumn
                column={column}
                onClose={() => handleRemoveColumn(column.id)}
                onMoveLeft={
                  columns.findIndex((col) => col.id === column.id) > 0
                    ? () => handleMoveLeft(column.id)
                    : undefined
                }
                onMoveRight={
                  columns.findIndex((col) => col.id === column.id) <
                  columns.length - 1
                    ? () => handleMoveRight(column.id)
                    : undefined
                }
                isFocused={focusedColumnIndex === index}
              />
            </div>
          ))}

          <div
            className="h-full shrink-0"
            style={{ width: `${columnWidth}px` }}
          >
            {isAddingColumn ? (
              <div className="flex h-full animate-fade-in flex-col rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                <div className="asph-scrollbar flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2">
                    {columnOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.type}
                          onClick={() => handleAddColumn(option.type)}
                          className="touch-target flex min-h-[4rem] items-start gap-3 rounded-md border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/50"
                        >
                          <Icon className="mt-0.5 h-5 w-5 text-blue-500" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="whitespace-normal text-sm text-asph-text-tertiary">
                              {option.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Add Feed Section */}
                    {userPrefs?.savedFeeds &&
                      feedGenerators &&
                      feedGenerators.length > 0 && (
                        <>
                          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                            <h4 className="mb-2 px-3 text-sm font-medium text-asph-text-secondary">
                              Add Feed
                            </h4>
                            <div className="grid gap-1">
                              {userPrefs.savedFeeds
                                .filter(
                                  (feed: AppBskyActorDefs.SavedFeed) =>
                                    feed.type === "feed",
                                )
                                .map(
                                  (savedFeed: AppBskyActorDefs.SavedFeed) => {
                                    const generator = feedGenerators.find(
                                      (g: FeedGenerator) =>
                                        g.uri === savedFeed.value,
                                    );
                                    if (!generator) return null;

                                    return (
                                      <button
                                        key={savedFeed.value}
                                        onClick={() =>
                                          handleAddColumn(
                                            "feed",
                                            savedFeed.value,
                                            generator.displayName,
                                          )
                                        }
                                        className="touch-target flex items-start gap-2 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                      >
                                        {savedFeed.pinned ? (
                                          <Star className="mt-0.5 h-4 w-4 text-yellow-500" />
                                        ) : (
                                          <Hash className="mt-0.5 h-4 w-4 text-asph-text-tertiary" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                            {generator.displayName}
                                          </div>
                                          {generator.description && (
                                            <div className="line-clamp-2 text-xs text-asph-text-tertiary">
                                              {generator.description}
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  },
                                )}
                            </div>
                          </div>
                        </>
                      )}

                    {/* Add Lists Section */}
                    {userLists && userLists.length > 0 && (
                      <>
                        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                          <h4 className="mb-2 px-3 text-sm font-medium text-asph-text-secondary">
                            Add List
                          </h4>
                          <div className="grid gap-1">
                            {userLists.map(
                              (list: AppBskyGraphDefs.ListView) => (
                                <button
                                  key={list.uri}
                                  onClick={() =>
                                    handleAddColumn("feed", list.uri, list.name)
                                  }
                                  className="touch-target-icon touch-target flex items-start gap-2 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                >
                                  <Users className="mt-0.5 h-4 w-4 text-blue-500" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                      {list.name}
                                    </div>
                                    {list.description && (
                                      <div className="truncate text-xs text-asph-text-tertiary">
                                        {list.description}
                                      </div>
                                    )}
                                    <div className="mt-0.5 text-xs text-asph-text-tertiary">
                                      {list.listItemCount || 0} members
                                    </div>
                                  </div>
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Add Custom Feed by URI */}
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h4 className="mb-2 px-3 text-sm font-medium text-asph-text-secondary">
                        Add Custom Feed or List by URI
                      </h4>
                      <div className="flex gap-2 px-3">
                        <label htmlFor="custom-feed-input" className="sr-only">
                          Custom feed or list URL
                        </label>
                        <input
                          id="custom-feed-input"
                          type="text"
                          value={customFeedUri}
                          onChange={(e) => setCustomFeedUri(e.target.value)}
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              customFeedUri.trim() &&
                              !isLoadingCustomFeed
                            ) {
                              e.preventDefault();
                              document
                                .getElementById("add-feed-button")
                                ?.click();
                            }
                          }}
                          placeholder="Paste feed/list AT-URI or bsky.app URL"
                          aria-describedby="custom-feed-help"
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
                        />
                        <button
                          id="add-feed-button"
                          onClick={async () => {
                            if (customFeedUri.trim()) {
                              setIsLoadingCustomFeed(true);
                              try {
                                let uri = customFeedUri.trim();

                                // Handle starter pack URLs
                                if (uri.includes("bsky.app/starter-pack/")) {
                                  // Extract the handle and rkey from starter pack URL
                                  const match = uri.match(
                                    // eslint-disable-next-line no-useless-escape
                                    /starter-pack\/([^\/]+)\/([^\/\?]+)/,
                                  );
                                  if (match) {
                                    const [, handle, rkey] = match;
                                    try {
                                      // Resolve the handle to DID
                                      const resolveResponse =
                                        await agent?.com.atproto.identity.resolveHandle(
                                          {
                                            handle: handle,
                                          },
                                        );
                                      if (resolveResponse?.data?.did) {
                                        // Construct the starter pack AT-URI
                                        const starterPackUri = `at://${resolveResponse.data.did}/app.bsky.graph.starterpack/${rkey}`;

                                        // Fetch the starter pack to get the list URI
                                        const starterPackResponse =
                                          await agent?.app.bsky.graph.getStarterPack(
                                            {
                                              starterPack: starterPackUri,
                                            },
                                          );

                                        if (
                                          starterPackResponse?.data?.starterPack
                                            ?.list
                                        ) {
                                          // Use the list URI from the starter pack
                                          const listData =
                                            starterPackResponse.data.starterPack
                                              .list;
                                          // Handle both string URI and object with uri property
                                          uri =
                                            typeof listData === "string"
                                              ? listData
                                              : listData.uri;
                                          logger.log(
                                            "Extracted list URI from starter pack:",
                                            uri,
                                          );
                                        } else {
                                          logger.error(
                                            "Starter pack does not contain a list",
                                          );
                                          throw new Error(
                                            "Starter pack does not contain a list",
                                          );
                                        }
                                      }
                                    } catch (error) {
                                      logger.error(
                                        "Failed to resolve starter pack:",
                                        error,
                                      );
                                      throw error;
                                    }
                                  }
                                }

                                // Ensure uri is a string
                                if (!uri || typeof uri !== "string") {
                                  throw new Error("Invalid feed URI");
                                }

                                // Check if it's a list URI
                                if (uri.includes("/app.bsky.graph.list/")) {
                                  // Try to fetch list info
                                  const response =
                                    await agent?.app.bsky.graph.getList({
                                      list: uri,
                                    });
                                  if (response?.data.list) {
                                    const list = response.data.list;
                                    handleAddColumn(
                                      "feed",
                                      list.uri,
                                      list.name,
                                    );
                                    setCustomFeedUri("");
                                  } else {
                                    // If no list info, add with URI as name
                                    handleAddColumn("feed", uri, uri);
                                    setCustomFeedUri("");
                                  }
                                } else {
                                  // It's a feed URI
                                  const response =
                                    await agent?.app.bsky.feed.getFeedGenerators(
                                      {
                                        feeds: [uri],
                                      },
                                    );
                                  if (response?.data.feeds[0]) {
                                    const feed = response.data.feeds[0];
                                    handleAddColumn(
                                      "feed",
                                      feed.uri,
                                      feed.displayName,
                                    );
                                    setCustomFeedUri("");
                                  } else {
                                    // If no feed info, add with URI as name
                                    handleAddColumn("feed", uri, uri);
                                    setCustomFeedUri("");
                                  }
                                }
                              } catch (error: unknown) {
                                logger.error(
                                  "Error fetching feed/list:",
                                  error,
                                );
                                // Show error to user instead of adding invalid feed
                                const errorMessage =
                                  error instanceof Error
                                    ? error.message
                                    : "Invalid feed URL";
                                showAlert(
                                  `Failed to add feed: ${errorMessage}`,
                                  {
                                    variant: "error",
                                    title: "Failed to Add Feed",
                                  },
                                );
                              } finally {
                                setIsLoadingCustomFeed(false);
                              }
                            }
                          }}
                          disabled={
                            !customFeedUri.trim() || isLoadingCustomFeed
                          }
                          className="touch-target-icon flex h-10 w-10 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Add custom feed"
                          title="Add Feed"
                        >
                          <Plus size={18} aria-hidden="true" />
                        </button>
                        <span id="custom-feed-help" className="sr-only">
                          Enter an AT-URI or Bluesky app URL for a feed or list
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => setIsAddingColumn(false)}
                      className="touch-target-list-item w-full rounded-md bg-gray-300 px-4 py-2 text-asph-text-secondary transition-colors hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="touch-target group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white shadow-md transition-all duration-300 hover:border-blue-400 hover:bg-gray-50 hover:shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-900/50"
                aria-label="Add new column"
              >
                <Plus
                  className="h-12 w-12 text-asph-text-tertiary group-hover:text-gray-600 dark:group-hover:text-gray-300"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
