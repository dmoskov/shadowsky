import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Cloud, Search, Settings, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { ImageGallery } from "./ImageGallery";
import { PostActionBar } from "./PostActionBar";
import { ThreadModal } from "./ThreadModal";
import { VideoPlayer } from "./VideoPlayer";

interface BookmarksColumnProps {
  isFocused?: boolean;
  onClose?: () => void;
}

interface BookmarkWithPost {
  postUri: string;
  savedAt: string;
  post: AppBskyFeedDefs.PostView | null;
}

const scrollPositions = new Map<string, number>();

export const BookmarksColumn: React.FC<BookmarksColumnProps> = ({
  isFocused = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
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
  const containerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<ListImperativeAPI>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  const cacheKey = `bookmarks-${searchQuery}`;

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 180,
    key: cacheKey,
  });

  const {
    data: bookmarks,
    isLoading,
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

  // Filter bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!bookmarks) return [];
    return bookmarks.filter(
      (bookmark: BookmarkWithPost) =>
        bookmark.post &&
        !isPostHidden(bookmark.post.uri) &&
        !isUserMuted(bookmark.post.author.did) &&
        !isUserBlocked(bookmark.post.author.did) &&
        !isThreadMuted(bookmark.post.uri),
    );
  }, [bookmarks, isPostHidden, isUserMuted, isUserBlocked, isThreadMuted]);

  // Refetch bookmarks when the column becomes focused
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused, refetch]);

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

    if ((embed as { $type?: string }).$type === "app.bsky.embed.images#view") {
      const imageEmbed = embed as { images: Array<{ thumb: string; fullsize: string; alt?: string }> };
      const handleImageClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const images = imageEmbed.images.map((img) => ({
          thumb: proxifyBskyImage(img.thumb),
          fullsize: proxifyBskyImage(img.fullsize),
          alt: img.alt,
        }));
        setGalleryImages(images);
        setGalleryIndex(index);
      };

      return (
        <div
          className={`mt-2 grid gap-1 ${imageEmbed.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {imageEmbed.images.map((img, idx: number) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-lg bg-bsky-bg-tertiary"
            >
              <img
                src={proxifyBskyImage(img.thumb)}
                alt={img.alt || ""}
                className="h-auto max-h-80 w-full cursor-pointer object-contain hover:opacity-95"
                onClick={(e) => handleImageClick(e, idx)}
              />
            </div>
          ))}
        </div>
      );
    }

    if ((embed as { $type?: string }).$type === "app.bsky.embed.video#view") {
      const videoEmbed = embed as { playlist: string; thumbnail?: string; aspectRatio?: { width: number; height: number }; alt?: string };
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <VideoPlayer
            src={proxifyBskyVideo(videoEmbed.playlist) || ""}
            thumbnail={
              videoEmbed.thumbnail ? proxifyBskyVideo(videoEmbed.thumbnail) : undefined
            }
            aspectRatio={videoEmbed.aspectRatio}
            alt={videoEmbed.alt}
          />
        </div>
      );
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
      {/* Header */}
      <div
        className="bsky-glass sticky top-0 z-20 border-b"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <div className="group flex items-center justify-between px-4 py-2.5">
          <div className="flex flex-1 items-center gap-2">
            <Bookmark size={20} style={{ color: "var(--bsky-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Bookmarks
            </h2>
            {bookmarkCount !== undefined && (
              <span
                className="rounded-full px-2 py-0.5 text-sm"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  color: "var(--bsky-text-secondary)",
                }}
              >
                {bookmarkCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/settings/data")}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Data storage settings"
            >
              <Cloud
                size={14}
                style={{ color: "var(--bsky-text-secondary)" }}
              />
              <span style={{ color: "var(--bsky-text-secondary)" }}>
                Official
              </span>
              <Settings
                size={12}
                style={{ color: "var(--bsky-text-tertiary)" }}
              />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="rounded-full p-1.5 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
                style={{ color: "var(--bsky-text-secondary)" }}
                aria-label="Close column"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 transform"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full py-2 pl-10 pr-4 text-sm"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Bookmarks List - Virtualized */}
      <div ref={listContainerRef} className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {!isLoading && filteredBookmarks.length === 0 && (
          <div className="p-8 text-center">
            <Bookmark
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <p style={{ color: "var(--bsky-text-primary)" }}>
              {searchQuery ? "No bookmarks found" : "No bookmarks yet"}
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
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
              if (!post) return null;

              const isItemFocused = focusedIndex === index;

              return (
                <div style={style}>
                  <div
                    className={`group cursor-pointer border-b transition-colors hover:bg-blue-500 hover:bg-opacity-5 ${
                      isItemFocused
                        ? "border-l-4 border-l-blue-500 bg-blue-500 bg-opacity-10 pl-3"
                        : ""
                    }`}
                    style={{ borderColor: "var(--bsky-border-primary)" }}
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
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {post.author?.displayName ||
                                post.author?.handle ||
                                "Unknown"}
                            </span>
                            <span
                              className="text-sm"
                              style={{ color: "var(--bsky-text-secondary)" }}
                            >
                              @{post.author?.handle || "unknown"}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "var(--bsky-text-tertiary)" }}
                            >
                              {formatDistanceToNow(new Date(bookmark.savedAt), {
                                addSuffix: true,
                              })}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnbookmark(bookmark.postUri);
                              }}
                              className="rounded p-1 opacity-50 transition-colors hover:bg-yellow-100 group-hover:opacity-100 dark:hover:bg-yellow-900/20"
                              style={{ color: "#ffad1f" }}
                              title="Remove bookmark"
                            >
                              <Bookmark size={16} fill="currentColor" />
                            </button>
                          </div>

                          <div
                            className="mt-2 whitespace-pre-wrap break-words"
                            style={{ color: "var(--bsky-text-primary)" }}
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
