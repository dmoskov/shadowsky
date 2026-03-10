import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  ChevronDown,
  Cloud,
  Folder,
  MessageCircle,
  Search,
  Settings,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import {
  useBookmarkCollections,
  useCollectionBookmarks,
} from "../hooks/useBookmarkCollections";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { useMinDuration } from "../hooks/useTiming";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import type { BookmarkCollection } from "../services/bookmark-collections";
import { COLLECTION_COLORS } from "../services/bookmark-collections";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import {
  CollectionManager,
  SaveToCollectionDropdown,
} from "./bookmark-collections";
import { ImageGallery } from "./ImageGallery";
import { ImageGrid } from "./ImageGrid";
import { PostActionBar } from "./PostActionBar";
import { ThreadModal } from "./ThreadModal";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import { FeedSkeleton } from "./ui/SkeletonLoader";
import { VideoPlayer } from "./VideoPlayer";

interface BookmarksColumnProps {
  isFocused?: boolean;
  onClose?: () => void;
}

const scrollPositions = new Map<string, number>();

const BookmarksColumnComponent: React.FC<BookmarksColumnProps> = ({
  isFocused = false,
  onClose,
}) => {
  const navigate = useViewTransitionNavigate();
  const queryClient = useQueryClient();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
  const { getThreadPrefetchHandlers } = useRoutePrefetch();
  const { showAlert } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }> | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null);
  const [showCollectionPanel, setShowCollectionPanel] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const collectionDropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<ListImperativeAPI>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  const { collections } = useBookmarkCollections();
  const {
    bookmarks: collectionBookmarks,
    refetch: refetchCollectionBookmarks,
  } = useCollectionBookmarks(selectedCollectionId);

  const cacheKey = `bookmarks-${searchQuery}-${selectedCollectionId || "all"}`;

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 180,
    key: cacheKey,
  });

  const {
    data: bookmarks,
    isLoading: isLoadingRaw,
    refetch,
  } = useQuery({
    queryKey: ["bookmarks", searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        return await bookmarkServiceV2.searchBookmarks(searchQuery);
      }
      return await bookmarkServiceV2.getBookmarkedPosts();
    },
    staleTime: 30000,
  });

  // Apply minimum duration to prevent jarring flash of loading state
  const isLoading = useMinDuration(isLoadingRaw);

  // Close collection dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        collectionDropdownRef.current &&
        !collectionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCollectionDropdown(false);
      }
    };

    if (showCollectionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCollectionDropdown]);

  // Get the source bookmarks based on collection selection
  const sourceBookmarks = useMemo(() => {
    if (selectedCollectionId) {
      return collectionBookmarks;
    }
    return bookmarks || [];
  }, [selectedCollectionId, collectionBookmarks, bookmarks]);

  // Filter bookmarks based on search and moderation
  const filteredBookmarks = useMemo(() => {
    if (!sourceBookmarks) return [];
    let filtered = sourceBookmarks.filter(
      (bookmark) =>
        bookmark.post &&
        !isPostHidden(bookmark.post.uri) &&
        !isUserMuted(bookmark.post.author.did) &&
        !isUserBlocked(bookmark.post.author.did) &&
        !isThreadMuted(bookmark.post.uri),
    );

    // Apply search filter if there's a query and we're viewing a collection
    if (searchQuery && selectedCollectionId) {
      const lowercaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((bookmark) => {
        const searchText =
          `${bookmark.text} ${bookmark.author.handle} ${bookmark.author.displayName}`.toLowerCase();
        const notesText = bookmark.notes?.toLowerCase() || "";
        return (
          searchText.includes(lowercaseQuery) ||
          notesText.includes(lowercaseQuery)
        );
      });
    }

    return filtered;
  }, [
    sourceBookmarks,
    isPostHidden,
    isUserMuted,
    isUserBlocked,
    isThreadMuted,
    searchQuery,
    selectedCollectionId,
  ]);

  // Refetch bookmarks when the column becomes focused
  useEffect(() => {
    if (isFocused) {
      refetch();
      if (selectedCollectionId) {
        refetchCollectionBookmarks();
      }
    }
  }, [isFocused, refetch, selectedCollectionId, refetchCollectionBookmarks]);

  // Get the selected collection details
  const selectedCollection = useMemo(() => {
    if (!selectedCollectionId || selectedCollectionId === "__uncategorized__") {
      return null;
    }
    return collections.find((c) => c.id === selectedCollectionId) || null;
  }, [selectedCollectionId, collections]);

  const getCollectionColor = (collection: BookmarkCollection) => {
    const colorOption = COLLECTION_COLORS.find(
      (c) => c.id === collection.color,
    );
    return colorOption?.value || "#3b82f6";
  };

  const { data: bookmarkCount } = useQuery({
    queryKey: ["bookmarkCount"],
    queryFn: () => bookmarkServiceV2.getBookmarkCount(),
    staleTime: 30000,
  });

  const handleUnbookmark = useCallback(
    async (postUri: string) => {
      try {
        await bookmarkServiceV2.removeBookmark(postUri);
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
      } catch {
        showAlert("Failed to remove bookmark. Please try again.", {
          variant: "error",
          title: "Error",
        });
      }
    },
    [queryClient, showAlert],
  );

  const handlePostClick = (post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post);
    setShowThread(true);
  };

  // Measure container height for virtual list
  useEffect(() => {
    if (!listContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(listContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Restore scroll position when bookmarks are loaded
  useEffect(() => {
    if (
      shouldRestoreScroll &&
      cacheKey &&
      filteredBookmarks.length > 0 &&
      scrollPositions.has(cacheKey) &&
      listRef.current
    ) {
      const savedPosition = scrollPositions.get(cacheKey)!;
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: 0,
            behavior: "auto",
          });
          const element = listRef.current.element;
          if (element) {
            element.scrollTop = savedPosition;
          }
        }
      }, 0);
      setShouldRestoreScroll(false);
    }
  }, [cacheKey, filteredBookmarks.length, shouldRestoreScroll]);

  // Mark that we should restore scroll on mount
  useEffect(() => {
    if (cacheKey && scrollPositions.has(cacheKey)) {
      setShouldRestoreScroll(true);
    }
  }, [cacheKey]);

  // Save scroll position when unmounting
  useEffect(() => {
    return () => {
      if (cacheKey && listRef.current) {
        const element = listRef.current.element;
        if (element) {
          scrollPositions.set(cacheKey, element.scrollTop);
        }
      }
    };
  }, [cacheKey]);

  // Keyboard navigation
  useEffect(() => {
    if (!isFocused || !filteredBookmarks.length) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex =
            prev === -1 ? 0 : Math.min(prev + 1, filteredBookmarks.length - 1);
          // Scroll to the focused item
          if (listRef.current && newIndex >= 0) {
            listRef.current.scrollToRow({
              index: newIndex,
              behavior: "smooth",
            });
          }
          return newIndex;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = prev === -1 ? 0 : Math.max(prev - 1, 0);
          // Scroll to the focused item
          if (listRef.current && newIndex >= 0) {
            listRef.current.scrollToRow({
              index: newIndex,
              behavior: "smooth",
            });
          }
          return newIndex;
        });
      } else if (
        e.key === "Enter" &&
        focusedIndex >= 0 &&
        filteredBookmarks[focusedIndex]?.post
      ) {
        e.preventDefault();
        handlePostClick(filteredBookmarks[focusedIndex].post!);
      } else if (
        e.key === "Delete" &&
        focusedIndex >= 0 &&
        filteredBookmarks[focusedIndex]
      ) {
        e.preventDefault();
        handleUnbookmark(filteredBookmarks[focusedIndex].postUri);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, filteredBookmarks, focusedIndex, handleUnbookmark]);

  // Focus container when column is focused
  useEffect(() => {
    if (containerRef.current && isFocused) {
      containerRef.current.focus();
    }
  }, [isFocused]);

  const renderEmbed = (embed: AppBskyFeedDefs.PostView["embed"]) => {
    if (!embed) return null;

    const embedType = (embed as { $type?: string }).$type;

    // Record with media (quoted post + images/video)
    if (embedType === "app.bsky.embed.recordWithMedia#view") {
      const rwm = embed as any;
      return (
        <div className="mt-2 space-y-2">
          {rwm.media && renderEmbed(rwm.media)}
          {rwm.record && renderEmbed(rwm.record)}
        </div>
      );
    }

    if (embedType === "app.bsky.embed.images#view") {
      const imageEmbed = embed as {
        images: Array<{ thumb: string; fullsize: string; alt?: string }>;
      };

      return (
        <ImageGrid
          images={imageEmbed.images.map((img: any) => ({
            thumb: img.thumb,
            fullsize: img.fullsize,
            alt: img.alt,
          }))}
          onImageClick={(index) => {
            const mapped: Array<{
              thumb: string;
              fullsize: string;
              alt?: string;
            }> = [];
            for (const img of imageEmbed.images) {
              const thumb = proxifyBskyImage(img.thumb);
              const fullsize = proxifyBskyImage(img.fullsize);
              if (thumb && fullsize) {
                mapped.push({ thumb, fullsize, alt: img.alt });
              }
            }
            setGalleryImages(mapped);
            setGalleryIndex(index);
          }}
        />
      );
    }

    if (embedType === "app.bsky.embed.video#view") {
      const videoEmbed = embed as {
        playlist: string;
        thumbnail?: string;
        aspectRatio?: { width: number; height: number };
        alt?: string;
      };
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <VideoPlayer
            src={proxifyBskyVideo(videoEmbed.playlist) || ""}
            thumbnail={
              videoEmbed.thumbnail
                ? proxifyBskyVideo(videoEmbed.thumbnail)
                : undefined
            }
            aspectRatio={videoEmbed.aspectRatio}
            alt={videoEmbed.alt}
          />
        </div>
      );
    }

    // External link embed
    if (embedType === "app.bsky.embed.external#view") {
      const extEmbed = embed as {
        external: {
          uri: string;
          title?: string;
          description?: string;
          thumb?: string;
        };
      };
      const external = extEmbed.external;
      if (!external) return null;
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border p-2.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10"
          style={{
            borderColor: "var(--asph-border-primary)",
            backgroundColor: "var(--asph-bg-primary)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (external.uri) {
              window.open(external.uri, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {external.thumb && (
            <img
              src={proxifyBskyImage(external.thumb)}
              alt=""
              className="mb-2 h-auto w-full rounded object-cover"
              style={{
                maxHeight: "200px",
                backgroundColor: "var(--asph-bg-tertiary)",
              }}
            />
          )}
          <div
            className="line-clamp-2 text-sm font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            {external.title}
          </div>
          <div
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {external.description}
          </div>
        </div>
      );
    }

    // Record embed (quoted posts, starter packs, feeds, lists, labelers)
    if (embedType === "app.bsky.embed.record#view") {
      const recordData = (embed as any).record;
      if (!recordData) return null;

      // Deleted or detached
      if (
        recordData.$type === "app.bsky.embed.record#viewNotFound" ||
        recordData.$type === "app.bsky.embed.record#viewDetached"
      ) {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border p-3 text-sm italic"
            style={{
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-secondary)",
            }}
          >
            Post not found or deleted
          </div>
        );
      }

      if (recordData.$type === "app.bsky.embed.record#viewBlocked") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border p-3 text-sm italic"
            style={{
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-secondary)",
            }}
          >
            Post from blocked user
          </div>
        );
      }

      // Normal quoted post
      if (recordData.$type === "app.bsky.embed.record#viewRecord") {
        const quotedPost = recordData;
        return (
          <div
            className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
            style={{ borderColor: "var(--asph-border-primary)" }}
            onClick={(e) => {
              e.stopPropagation();
              if (quotedPost.uri && quotedPost.author?.handle) {
                const quotedPostId = quotedPost.uri.split("/").pop();
                navigate(`/thread/${quotedPost.author.handle}/${quotedPostId}`);
              }
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--asph-bg-tertiary)",
                borderBottom: "1px solid var(--asph-border-primary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                {quotedPost.author?.handle && (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <img
                      src={
                        proxifyBskyImage(quotedPost.author?.avatar) ||
                        "/default-avatar.svg"
                      }
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  </ProfileHoverCard>
                )}
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer text-sm font-semibold hover:underline"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {quotedPost.author?.displayName ||
                        quotedPost.author?.handle}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    Unknown
                  </span>
                )}
              </div>
              <div
                className="text-sm"
                style={{ color: "var(--asph-text-primary)" }}
              >
                <RichText
                  text={quotedPost.value?.text || ""}
                  facets={quotedPost.value?.facets}
                />
              </div>
              {quotedPost.embeds?.[0] && (
                <div className="mt-2">{renderEmbed(quotedPost.embeds[0])}</div>
              )}
            </div>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="flex h-full flex-col"
      style={{ outline: "none" }}
    >
      {/* Collection Panel Overlay */}
      {showCollectionPanel && (
        <div className="absolute inset-0 z-30 flex">
          <div
            className="flex-1 bg-black bg-opacity-50"
            onClick={() => setShowCollectionPanel(false)}
          />
          <div className="w-72 bg-asph-bg-primary shadow-xl">
            <CollectionManager
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={(id) => {
                setSelectedCollectionId(id);
                setShowCollectionPanel(false);
              }}
              onClose={() => setShowCollectionPanel(false)}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="asph-glass sticky top-0 z-20 border-b"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <div className="group flex items-center justify-between px-4 py-2.5">
          <div className="flex flex-1 items-center gap-2">
            <Bookmark size={20} style={{ color: "var(--asph-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Bookmarks
            </h2>
            {bookmarkCount !== undefined && !selectedCollectionId && (
              <span
                className="rounded-full px-2 py-0.5 text-sm"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  color: "var(--asph-text-secondary)",
                }}
              >
                {bookmarkCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCollectionPanel(true)}
              className="touch-target-sm flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Manage collections"
            >
              <Folder
                size={14}
                style={{ color: "var(--asph-text-secondary)" }}
              />
              <span style={{ color: "var(--asph-text-secondary)" }}>
                Collections
              </span>
            </button>

            <button
              onClick={() => navigate("/settings/data")}
              className="touch-target-sm flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Data storage settings"
            >
              <Cloud
                size={14}
                style={{ color: "var(--asph-text-secondary)" }}
              />
              <Settings
                size={12}
                style={{ color: "var(--asph-text-tertiary)" }}
              />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="touch-target-icon rounded-full p-1.5 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
                style={{ color: "var(--asph-text-secondary)" }}
                aria-label="Close column"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Collection Selector */}
        <div className="px-4 pb-2">
          <div className="relative" ref={collectionDropdownRef}>
            <button
              onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
              className="touch-target-sm flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-asph-bg-secondary"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              <div className="flex items-center gap-2">
                {selectedCollection ? (
                  <>
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: getCollectionColor(selectedCollection),
                      }}
                    />
                    <span style={{ color: "var(--asph-text-primary)" }}>
                      {selectedCollection.name}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      ({selectedCollection.bookmarkCount})
                    </span>
                  </>
                ) : selectedCollectionId === "__uncategorized__" ? (
                  <>
                    <Folder
                      size={14}
                      style={{ color: "var(--asph-text-tertiary)" }}
                    />
                    <span style={{ color: "var(--asph-text-primary)" }}>
                      Uncategorized
                    </span>
                  </>
                ) : (
                  <>
                    <Bookmark
                      size={14}
                      style={{ color: "var(--asph-primary)" }}
                    />
                    <span style={{ color: "var(--asph-text-primary)" }}>
                      All Bookmarks
                    </span>
                    {bookmarkCount !== undefined && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--asph-text-tertiary)" }}
                      >
                        ({bookmarkCount})
                      </span>
                    )}
                  </>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${showCollectionDropdown ? "rotate-180" : ""}`}
                style={{ color: "var(--asph-text-tertiary)" }}
              />
            </button>

            {showCollectionDropdown && (
              <div
                className="asph-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg"
                style={{
                  backgroundColor: "var(--asph-bg-primary)",
                  borderColor: "var(--asph-border-primary)",
                }}
              >
                {/* All Bookmarks option */}
                <button
                  onClick={() => {
                    setSelectedCollectionId(null);
                    setShowCollectionDropdown(false);
                  }}
                  className={`touch-target flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-asph-bg-secondary ${
                    !selectedCollectionId ? "bg-blue-500 bg-opacity-10" : ""
                  }`}
                >
                  <Bookmark
                    size={14}
                    style={{ color: "var(--asph-primary)" }}
                  />
                  <span style={{ color: "var(--asph-text-primary)" }}>
                    All Bookmarks
                  </span>
                </button>

                {/* Uncategorized option */}
                <button
                  onClick={() => {
                    setSelectedCollectionId("__uncategorized__");
                    setShowCollectionDropdown(false);
                  }}
                  className={`touch-target flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-asph-bg-secondary ${
                    selectedCollectionId === "__uncategorized__"
                      ? "bg-blue-500 bg-opacity-10"
                      : ""
                  }`}
                >
                  <Folder
                    size={14}
                    style={{ color: "var(--asph-text-tertiary)" }}
                  />
                  <span style={{ color: "var(--asph-text-secondary)" }}>
                    Uncategorized
                  </span>
                </button>

                {collections.length > 0 && (
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: "var(--asph-border-primary)" }}
                  />
                )}

                {/* User collections */}
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => {
                      setSelectedCollectionId(collection.id);
                      setShowCollectionDropdown(false);
                    }}
                    className={`touch-target flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-asph-bg-secondary ${
                      selectedCollectionId === collection.id
                        ? "bg-blue-500 bg-opacity-10"
                        : ""
                    }`}
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: getCollectionColor(collection),
                      }}
                    />
                    <span
                      className="flex-1 text-left"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {collection.name}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      {collection.bookmarkCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 transform"
              style={{ color: "var(--asph-text-tertiary)" }}
            />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full py-2 pl-10 pr-4 text-sm"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
                color: "var(--asph-text-primary)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Bookmarks List - Virtualized */}
      <div ref={listContainerRef} className="flex-1 overflow-hidden">
        {isLoading && <FeedSkeleton count={5} aria-label="Loading bookmarks" />}

        {!isLoading && filteredBookmarks.length === 0 && (
          <div className="p-8 text-center">
            <Bookmark
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--asph-text-tertiary)" }}
            />
            <p style={{ color: "var(--asph-text-primary)" }}>
              {searchQuery ? "No bookmarks found" : "No bookmarks yet"}
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Save posts to view them here
            </p>
          </div>
        )}

        {!isLoading && filteredBookmarks.length > 0 && (
          <List
            listRef={listRef}
            rowCount={filteredBookmarks.length}
            rowHeight={dynamicRowHeight}
            defaultHeight={containerHeight}
            overscanCount={5}
            rowComponent={({ index, style }) => {
              const bookmark = filteredBookmarks[index];
              const post = bookmark.post;
              if (!post) return <div style={style} />;

              const isItemFocused = focusedIndex === index;

              return (
                <div style={style}>
                  <div
                    className={`group cursor-pointer border-b transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10 ${
                      isItemFocused
                        ? "border-l-4 border-l-blue-500 bg-blue-500 bg-opacity-10 pl-3"
                        : ""
                    }`}
                    style={{ borderColor: "var(--asph-border-primary)" }}
                    {...getThreadPrefetchHandlers(post.uri)}
                    onClick={() => handlePostClick(post)}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {post.author?.avatar && (
                          <img
                            src={proxifyBskyImage(post.author.avatar)}
                            alt={post.author.handle || ""}
                            className="h-10 w-10 rounded-full"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span
                              className="font-semibold"
                              style={{ color: "var(--asph-text-primary)" }}
                            >
                              {post.author?.displayName ||
                                post.author?.handle ||
                                "Unknown"}
                            </span>
                            <span
                              className="text-sm"
                              style={{ color: "var(--asph-text-secondary)" }}
                            >
                              @{post.author?.handle || "unknown"}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "var(--asph-text-tertiary)" }}
                            >
                              {formatDistanceToNow(new Date(bookmark.savedAt), {
                                addSuffix: true,
                              })}
                            </span>
                            <div
                              className="ml-auto flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SaveToCollectionDropdown
                                postUri={bookmark.postUri}
                                compact
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnbookmark(bookmark.postUri);
                                }}
                                className="touch-target-icon rounded p-1 text-yellow-500 opacity-50 transition-colors hover:bg-yellow-100 group-hover:opacity-100 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                                title="Remove bookmark"
                              >
                                <Bookmark size={16} fill="currentColor" />
                              </button>
                            </div>
                          </div>

                          <div
                            className="mt-2 whitespace-pre-wrap break-words"
                            style={{ color: "var(--asph-text-primary)" }}
                          >
                            {(post.record as { text?: string })?.text || ""}
                          </div>

                          {post.embed && renderEmbed(post.embed)}

                          <PostActionBar
                            post={post}
                            onReply={() => {}}
                            onLike={() => {}}
                            onRepost={() => {}}
                            showCounts={true}
                            size="small"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
            rowProps={{}}
          />
        )}
      </div>

      {/* Thread Modal */}
      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
          }}
        />
      )}

      {/* Image Gallery */}
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => {
            setGalleryImages(null);
            setGalleryIndex(0);
          }}
        />
      )}
    </div>
  );
};

/**
 * Memoized BookmarksColumn for optimal SkyDeck performance
 */
export const BookmarksColumn = React.memo(
  BookmarksColumnComponent,
  (prevProps, nextProps) => {
    return prevProps.isFocused === nextProps.isFocused;
  },
);

BookmarksColumn.displayName = "BookmarksColumn";
