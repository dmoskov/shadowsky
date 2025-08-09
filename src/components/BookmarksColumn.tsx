import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { bookmarkService } from "../services/bookmark-service";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { ImageGallery } from "./ImageGallery";
import { PostActionBar } from "./PostActionBar";
import { ThreadModal } from "./ThreadModal";
import { VideoPlayer } from "./VideoPlayer";

interface BookmarksColumnProps {
  isFocused?: boolean;
  onClose?: () => void;
}

export const BookmarksColumn: React.FC<BookmarksColumnProps> = ({
  isFocused = false,
  onClose,
}) => {
  const queryClient = useQueryClient();
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
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize bookmark service
  useEffect(() => {
    bookmarkService.init();
  }, []);

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["bookmarks", searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        return await bookmarkService.searchBookmarks(searchQuery);
      }
      return await bookmarkService.getBookmarkedPosts();
    },
    staleTime: 30000,
  });

  // Refetch bookmarks when the column becomes focused
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused, refetch]);

  const { data: bookmarkCount } = useQuery({
    queryKey: ["bookmarkCount"],
    queryFn: () => bookmarkService.getBookmarkCount(),
    staleTime: 30000,
  });

  const handleUnbookmark = useCallback(
    async (postUri: string) => {
      await bookmarkService.removeBookmark(postUri);
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
    },
    [queryClient]
  );

  const handlePostClick = (post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post);
    setShowThread(true);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isFocused || !bookmarks) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
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
            prev === -1 ? 0 : Math.min(prev + 1, bookmarks.length - 1);
          return newIndex;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = prev === -1 ? 0 : Math.max(prev - 1, 0);
          return newIndex;
        });
      } else if (
        e.key === "Enter" &&
        focusedIndex >= 0 &&
        bookmarks[focusedIndex]?.post
      ) {
        e.preventDefault();
        handlePostClick(bookmarks[focusedIndex].post!);
      } else if (
        e.key === "Delete" &&
        focusedIndex >= 0 &&
        bookmarks[focusedIndex]
      ) {
        e.preventDefault();
        handleUnbookmark(bookmarks[focusedIndex].postUri);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, bookmarks, focusedIndex, handleUnbookmark]);

  // Focus container when column is focused
  useEffect(() => {
    if (containerRef.current && isFocused) {
      containerRef.current.focus();
    }
  }, [isFocused]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && bookmarks?.[focusedIndex]) {
      const itemEl = itemRefs.current.get(bookmarks[focusedIndex].postUri);
      if (itemEl) {
        itemEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [focusedIndex, bookmarks]);

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    if (embed.$type === "app.bsky.embed.images#view") {
      const handleImageClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const images = embed.images.map((img: any) => ({
          thumb: proxifyBskyImage(img.thumb),
          fullsize: proxifyBskyImage(img.fullsize),
          alt: img.alt,
        }));
        setGalleryImages(images);
        setGalleryIndex(index);
      };

      return (
        <div
          className={`mt-2 grid gap-1 ${embed.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {embed.images.map((img: any, idx: number) => (
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

    if (embed.$type === "app.bsky.embed.video#view") {
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist) || ""}
            thumbnail={
              embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined
            }
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
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
          <div className="flex items-center gap-2">
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

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {!isLoading && (!bookmarks || bookmarks.length === 0) && (
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

        {bookmarks?.map((bookmark, index) => {
          const post = bookmark.post;
          if (!post) return null;

          const isFocused = focusedIndex === index;

          return (
            <div
              key={bookmark.postUri}
              ref={(el) => {
                if (el) itemRefs.current.set(bookmark.postUri, el);
              }}
              className={`group cursor-pointer border-b transition-colors hover:bg-blue-500 hover:bg-opacity-5 ${
                isFocused
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
                        className="ml-auto rounded p-1 opacity-50 transition-colors hover:bg-yellow-100 group-hover:opacity-100 dark:hover:bg-yellow-900/20"
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
                      {(post.record as any)?.text || ""}
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
          );
        })}
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
