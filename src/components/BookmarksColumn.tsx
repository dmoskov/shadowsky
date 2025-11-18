import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  Cloud,
  Database,
  Search,
  Settings,
  Tag,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import { appPreferencesService } from "../services/app-preferences-service";
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

export const BookmarksColumn: React.FC<BookmarksColumnProps> = ({
  isFocused = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { agent } = useAuth();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
  const { showAlert } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<
    "local" | "custom" | "official"
  >("local");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingBookmarkUri, setEditingBookmarkUri] = useState<string | null>(
    null,
  );
  const [tagInput, setTagInput] = useState("");
  const [galleryImages, setGalleryImages] = useState<Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }> | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Note: bookmarkServiceV2 is initialized in AuthContext

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["bookmarks", searchQuery, selectedTag],
    queryFn: async () => {
      if (selectedTag) {
        return await bookmarkServiceV2.getBookmarksByTag(selectedTag);
      }
      if (searchQuery) {
        return await bookmarkServiceV2.searchBookmarks(searchQuery);
      }
      return await bookmarkServiceV2.getBookmarkedPosts();
    },
    staleTime: 30000,
  });

  const { data: allTags } = useQuery({
    queryKey: ["bookmarkTags"],
    queryFn: async () => {
      return await bookmarkServiceV2.getAllTags();
    },
    staleTime: 30000,
  });

  // Refetch bookmarks when the column becomes focused
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused, refetch]);

  // Fetch current storage type
  useEffect(() => {
    const fetchStorageType = async () => {
      if (agent) {
        appPreferencesService.setAgent(agent);
        const prefs = await appPreferencesService.getPreferences();
        if (prefs) {
          setStorageType(
            prefs.bookmarkStorageType as "local" | "custom" | "official",
          );
        }
      }
    };
    fetchStorageType();
  }, [agent]);

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

  const handleOpenTagModal = useCallback(
    (bookmarkUri: string, currentTags?: string[]) => {
      setEditingBookmarkUri(bookmarkUri);
      setTagInput(currentTags?.join(", ") || "");
      setShowTagModal(true);
    },
    [],
  );

  const handleSaveTags = useCallback(async () => {
    if (!editingBookmarkUri) return;

    try {
      const tags = tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await bookmarkServiceV2.updateBookmarkTags(editingBookmarkUri, tags);
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkTags"] });
      setShowTagModal(false);
      setEditingBookmarkUri(null);
      setTagInput("");
    } catch (error) {
      showAlert(
        `Failed to update tags: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          variant: "error",
          title: "Error",
        },
      );
    }
  }, [editingBookmarkUri, tagInput, queryClient, showAlert]);

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
              {storageType === "local" && (
                <>
                  <Database
                    size={14}
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                  <span style={{ color: "var(--bsky-text-secondary)" }}>
                    Local
                  </span>
                </>
              )}
              {storageType === "custom" && (
                <>
                  <Cloud size={14} className="text-orange-500" />
                  <span className="text-orange-500">Public</span>
                </>
              )}
              {storageType === "official" && (
                <>
                  <Cloud
                    size={14}
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                  <span style={{ color: "var(--bsky-text-secondary)" }}>
                    Official
                  </span>
                </>
              )}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedTag(null);
              }}
              className="w-full rounded-full py-2 pl-10 pr-4 text-sm"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            />
          </div>

          {allTags && allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedTag(null)}
                className={`rounded-full px-2 py-0.5 text-xs transition-all ${
                  !selectedTag
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTag(tag);
                    setSearchQuery("");
                  }}
                  className={`rounded-full px-2 py-0.5 text-xs transition-all ${
                    selectedTag === tag
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
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

        {bookmarks
          ?.filter(
            (bookmark) =>
              bookmark.post &&
              !isPostHidden(bookmark.post.uri) &&
              !isUserMuted(bookmark.post.author.did) &&
              !isUserBlocked(bookmark.post.author.did) &&
              !isThreadMuted(bookmark.post.uri),
          )
          .map((bookmark, index) => {
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
                            handleOpenTagModal(bookmark.postUri, bookmark.tags);
                          }}
                          className="ml-auto rounded p-1 opacity-50 transition-colors hover:bg-blue-100 group-hover:opacity-100 dark:hover:bg-blue-900/20"
                          style={{ color: "var(--bsky-text-secondary)" }}
                          title="Manage tags"
                        >
                          <Tag size={16} />
                        </button>
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

                      {bookmark.tags && bookmark.tags.length > 0 && (
                        <div className="mb-2 mt-1 flex flex-wrap gap-1">
                          {bookmark.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: "var(--bsky-bg-secondary)",
                                border: "1px solid var(--bsky-border-primary)",
                                color: "var(--bsky-text-secondary)",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

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

      {/* Tag Modal */}
      {showTagModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowTagModal(false)}
        >
          <div
            className="w-11/12 max-w-md rounded-xl shadow-xl"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-6"
              style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
            >
              <h3
                className="m-0 text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Manage Tags
              </h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="cursor-pointer rounded-md border-none bg-transparent p-2 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g., coding, design, favorites"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="mb-4 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setTagInput("");
                    setEditingBookmarkUri(null);
                  }}
                  className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTags}
                  className="cursor-pointer rounded-lg border-none px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
                  style={{ backgroundColor: "var(--bsky-primary)" }}
                >
                  Save Tags
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
