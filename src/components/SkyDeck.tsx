import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Clock,
  Hash,
  Mail,
  MessageSquare,
  Plus,
  Star,
  Users,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useColumnSwipe } from "../hooks/useColumnSwipe";
import { useModal } from "../contexts/ModalContext";
import { columnFeedPrefs } from "../utils/cookies";
import SkyColumn from "./SkyColumn";

export type ColumnType =
  | "notifications"
  | "timeline"
  | "conversations"
  | "feed"
  | "messages"
  | "bookmarks";

export interface Column {
  id: string;
  type: ColumnType;
  title?: string;
  data?: string; // Can be threadUri, feedUri, profileHandle, listUri etc
}

interface FeedGenerator {
  uri: string;
  displayName: string;
  description?: string;
  avatar?: string;
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
    type: "conversations" as ColumnType,
    label: "Conversations",
    icon: MessageSquare,
    description: "Your conversations",
  },
  {
    type: "bookmarks" as ColumnType,
    label: "Bookmarks",
    icon: Bookmark,
    description: "Your saved posts",
  },
];

export default function SkyDeck() {
  const { agent } = useAuth();
  const { showAlert } = useModal();
  const [columns, setColumns] = useState<Column[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [_, setDraggedElement] = useState<HTMLElement | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [isNarrowView, setIsNarrowView] = useState(false);
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  const [customFeedUri, setCustomFeedUri] = useState("");
  const [isLoadingCustomFeed, setIsLoadingCustomFeed] = useState(false);
  const columnsContainerRef = useRef<HTMLDivElement>(null);

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
        .filter((feed: any): boolean => feed.type === "feed")
        .map((feed: any) => feed.value);

      if (feedUris.length === 0) return [];

      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris,
        });
        return response.data.feeds;
      } catch (error) {
        console.error("Failed to fetch feed generators:", error);
        return [];
      }
    },
    enabled: !!agent && !!userPrefs?.savedFeeds,
  });

  // Fetch user's lists
  const { data: userLists } = useQuery({
    queryKey: ["userLists", agent?.session?.did],
    queryFn: async () => {
      if (!agent || !agent.session?.did) throw new Error("Not authenticated");
      const response = await agent.app.bsky.graph.getLists({
        actor: agent.session.did,
        limit: 50,
      });
      return response.data.lists;
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
        const scrollContainer = focusedColumn?.querySelector(".bsky-scrollbar");
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

  useEffect(() => {
    const homeColumn: Column = {
      id: "home",
      type: "feed",
      title: "Home",
      data: "following", // Default to following feed
    };

    const savedColumns = localStorage.getItem("skyDeckColumns");
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        // Ensure the first column is always Home
        if (parsed.length === 0 || parsed[0].id !== "home") {
          const restoredColumns = [
            homeColumn,
            ...parsed.filter((col: Column) => col.id !== "home"),
          ].map((col: Column) => {
            if (col.type === "feed" && col.id) {
              const savedFeed = columnFeedPrefs.getFeedForColumn(col.id);
              if (savedFeed) {
                return { ...col, data: savedFeed };
              }
            }
            return col;
          });
          setColumns(restoredColumns);
        } else {
          // Restore feed preferences from cookies
          const restoredColumns = parsed.map((col: Column) => {
            if (col.type === "feed" && col.id) {
              const savedFeed = columnFeedPrefs.getFeedForColumn(col.id);
              if (savedFeed) {
                return { ...col, data: savedFeed };
              }
            }
            return col;
          });
          setColumns(restoredColumns);
        }
      } catch {
        // If parsing fails, start with just home column
        setColumns([homeColumn]);
      }
    } else {
      // First time - just home column
      setColumns([homeColumn]);
    }
  }, []);

  useEffect(() => {
    if (columns.length > 0) {
      localStorage.setItem("skyDeckColumns", JSON.stringify(columns));
    }
  }, [columns]);

  const handleAddColumn = (
    type: ColumnType,
    feedUri?: string,
    feedTitle?: string,
  ) => {
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

    setColumns([...columns, newColumn]);
    setIsAddingColumn(false);

    // Focus and scroll to the new column
    setTimeout(() => {
      setFocusedColumnIndex(columns.length);

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
  };

  const handleRemoveColumn = (id: string) => {
    // Don't allow removing the home column
    if (id === "home") return;
    setColumns(columns.filter((col) => col.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setIsDragging(id);
    setDraggedElement(e.currentTarget as HTMLElement);
    e.dataTransfer.effectAllowed = "move";

    // Create a custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = "0.8";
    dragImage.style.transform = "rotate(2deg)";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(
      dragImage,
      e.clientX - e.currentTarget.getBoundingClientRect().left,
      20,
    );
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();

    if (isDragging && isDragging !== dropId) {
      const dragIndex = columns.findIndex((col) => col.id === isDragging);
      const dropIndex = columns.findIndex((col) => col.id === dropId);

      const newColumns = [...columns];
      const [draggedColumn] = newColumns.splice(dragIndex, 1);
      newColumns.splice(dropIndex, 0, draggedColumn);

      setColumns(newColumns);
    }

    setIsDragging(null);
    setDragOverId(null);
  };

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
            chromeless={false}
          />
          {/* Column dots indicator */}
          {columns.length > 1 && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-1.5 pb-2 pointer-events-none">
              <div className="flex gap-1.5 rounded-full bg-black/20 dark:bg-white/20 px-3 py-2 pointer-events-auto">
                {columns.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setMobileColumnIndex(index)}
                    className={`h-2 w-2 rounded-full transition-all ${
                      index === mobileColumnIndex
                        ? "bg-blue-500 w-6"
                        : "bg-gray-400 dark:bg-gray-500"
                    }`}
                    aria-label={`Go to column ${index + 1}`}
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
              className={`h-full w-[400px] rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-300 ease-out dark:border-gray-700 dark:bg-gray-900 ${
                isDragging === column.id
                  ? "scale-[0.98] cursor-grabbing opacity-50"
                  : "cursor-grab"
              } ${
                dragOverId === column.id && isDragging !== column.id
                  ? "relative before:absolute before:bottom-0 before:left-[-2px] before:top-0 before:w-1 before:animate-pulse before:rounded-sm before:bg-blue-500"
                  : ""
              } ${
                focusedColumnIndex === index
                  ? "shadow-xl ring-2 ring-blue-500/30"
                  : "hover:shadow-lg dark:hover:shadow-black/30"
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, column.id)}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragEnd={() => {
                setIsDragging(null);
                setDragOverId(null);
                setDraggedElement(null);
              }}
              onDragLeave={() => {
                if (dragOverId === column.id) {
                  setDragOverId(null);
                }
              }}
              onClick={(e) => {
                // Don't focus column if clicking on menu button or menu dropdown
                const target = e.target as HTMLElement;
                const isMenuButton = target.closest(
                  'button[aria-label="More options"]',
                );
                const isMenuDropdown = target.closest(".absolute.z-50"); // Menu dropdown has these classes
                if (!isMenuButton && !isMenuDropdown) {
                  setFocusedColumnIndex(index);
                }
              }}
              onClickCapture={(e) => {
                // Don't focus column if clicking on menu button or menu dropdown
                const target = e.target as HTMLElement;
                const isMenuButton = target.closest(
                  'button[aria-label="More options"]',
                );
                const isMenuDropdown = target.closest(".absolute.z-50"); // Menu dropdown has these classes
                if (!isMenuButton && !isMenuDropdown) {
                  setFocusedColumnIndex(index);
                }
              }}
            >
              <SkyColumn
                column={column}
                onClose={() => handleRemoveColumn(column.id)}
                isFocused={focusedColumnIndex === index}
              />
            </div>
          ))}

          <div className="h-full w-[400px]">
            {isAddingColumn ? (
              <div className="flex h-full animate-fade-in flex-col rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2">
                    {columnOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.type}
                          onClick={() => handleAddColumn(option.type)}
                          className="flex min-h-[4rem] items-start gap-3 rounded-md border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/50"
                        >
                          <Icon className="mt-0.5 h-5 w-5 text-blue-500" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="whitespace-normal text-sm text-gray-500 dark:text-gray-400">
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
                            <h4 className="mb-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Add Feed
                            </h4>
                            <div className="grid gap-1">
                              {userPrefs.savedFeeds
                                .filter((feed: any) => feed.type === "feed")
                                .map((savedFeed: any) => {
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
                                      className="flex items-start gap-2 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                    >
                                      {savedFeed.pinned ? (
                                        <Star className="mt-0.5 h-4 w-4 text-yellow-500" />
                                      ) : (
                                        <Hash className="mt-0.5 h-4 w-4 text-gray-400" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                          {generator.displayName}
                                        </div>
                                        {generator.description && (
                                          <div className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                            {generator.description}
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        </>
                      )}

                    {/* Add Lists Section */}
                    {userLists && userLists.length > 0 && (
                      <>
                        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                          <h4 className="mb-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Add List
                          </h4>
                          <div className="grid gap-1">
                            {userLists.map((list: any) => (
                              <button
                                key={list.uri}
                                onClick={() =>
                                  handleAddColumn("feed", list.uri, list.name)
                                }
                                className="flex items-start gap-2 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
                              >
                                <Users className="mt-0.5 h-4 w-4 text-blue-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {list.name}
                                  </div>
                                  {list.description && (
                                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                      {list.description}
                                    </div>
                                  )}
                                  <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                    {list.listItemCount || 0} members
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Add Custom Feed by URI */}
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h4 className="mb-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Add Custom Feed or List by URI
                      </h4>
                      <div className="flex gap-2 px-3">
                        <input
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
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
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
                                          console.log(
                                            "Extracted list URI from starter pack:",
                                            uri,
                                          );
                                        } else {
                                          console.error(
                                            "Starter pack does not contain a list",
                                          );
                                          throw new Error(
                                            "Starter pack does not contain a list",
                                          );
                                        }
                                      }
                                    } catch (error) {
                                      console.error(
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
                              } catch (error: any) {
                                console.error(
                                  "Error fetching feed/list:",
                                  error,
                                );
                                // Show error to user instead of adding invalid feed
                                showAlert(
                                  `Failed to add feed: ${error?.message || "Invalid feed URL"}`,
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
                          className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Add Feed"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => setIsAddingColumn(false)}
                      className="w-full rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white shadow-md transition-all duration-300 hover:border-blue-400 hover:bg-gray-50 hover:shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-900/50"
              >
                <Plus className="h-12 w-12 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
