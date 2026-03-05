import { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  Download,
  MoreVertical,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useModal } from "../contexts/ModalContext";
import { useToast } from "../contexts/ToastContext";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";
import { reinitializeBookmarkService } from "../services/bookmark-service-wrapper";
import { proxifyBskyImage } from "../utils/image-proxy";
import { PostRenderer } from "./PostRenderer";
import { ThreadModal } from "./ThreadModal";
import { FeedSkeleton } from "./ui/SkeletonLoader";

export const Bookmarks: React.FC = () => {
  const queryClient = useQueryClient();
  const { showAlert, showDestructiveConfirm } = useModal();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reinitialize bookmark service when component mounts to check for storage changes
  useEffect(() => {
    reinitializeBookmarkService().then(() => {
      // Invalidate queries to refetch with the correct storage
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
    });
  }, [queryClient]);

  // Note: bookmarkServiceV2 is initialized in AuthContext

  const {
    data: bookmarks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookmarks", searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        return await bookmarkServiceV2.searchBookmarks(searchQuery);
      }
      return await bookmarkServiceV2.getBookmarkedPosts();
    },
    staleTime: 0,
  });

  const { data: bookmarkCount } = useQuery({
    queryKey: ["bookmarkCount"],
    queryFn: async () => {
      // Refresh cache is already called in the main bookmarks query
      return bookmarkServiceV2.getBookmarkCount();
    },
    staleTime: 0, // Always refetch when component mounts
  });

  const handleBookmarkToggle = async (post: AppBskyFeedDefs.PostView) => {
    await bookmarkServiceV2.toggleBookmark(post);
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
    queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
  };

  const handleDeleteBookmark = async (postUri: string) => {
    try {
      await bookmarkServiceV2.removeBookmark(postUri);
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
      queryClient.invalidateQueries({ queryKey: ["atProtocolRecordCounts"] });
      showToast("Bookmark removed", {
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to remove bookmark:", error);
      showToast("Failed to remove bookmark", { type: "error" });
    }
  };

  const handleExport = async () => {
    try {
      const bookmarks = await bookmarkServiceV2.exportBookmarks();
      const blob = new Blob([JSON.stringify(bookmarks, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bluesky-bookmarks-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      showToast("Bookmarks exported", {
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to export bookmarks:", error);
      showToast("Failed to export bookmarks", { type: "error" });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bookmarks = JSON.parse(text);
      const importedCount = Array.isArray(bookmarks) ? bookmarks.length : 0;
      await bookmarkServiceV2.importBookmarks(bookmarks);
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
      setShowExportModal(false);
      showToast(
        `Imported ${importedCount} bookmark${importedCount !== 1 ? "s" : ""}`,
        {
          type: "success",
          duration: 3000,
        },
      );
    } catch (error) {
      console.error("Failed to import bookmarks:", error);
      showAlert("Failed to import bookmarks. Please check the file format.", {
        variant: "error",
        title: "Import Failed",
      });
    }
  };

  const handleClearAll = async () => {
    await showDestructiveConfirm(
      {
        title: "Clear All Bookmarks",
        message:
          "This will permanently remove all your saved bookmarks. You will lose your entire bookmark collection.",
        confirmButtonLabel: "Clear All Bookmarks",
        severity: "danger",
        canUndo: false,
        warningMessage: `You have ${bookmarkCount ?? 0} bookmark${(bookmarkCount ?? 0) !== 1 ? "s" : ""} that will be permanently deleted.`,
      },
      async () => {
        try {
          await bookmarkServiceV2.clearAllBookmarks();
          queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
          queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
          setShowExportModal(false);
          showToast("All bookmarks cleared", {
            type: "success",
            duration: 3000,
          });
        } catch (error) {
          console.error("Failed to clear bookmarks:", error);
          showToast("Failed to clear bookmarks", { type: "error" });
        }
      },
    );
  };

  const openPostThread = (post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post);
    setShowThread(true);
  };

  return (
    <div
      className="mx-auto flex h-full max-w-4xl flex-col bg-asph-bg-primary"
      role="main"
      aria-label="Bookmarks"
    >
      <div className="sticky top-0 z-10 border-b border-asph-border-primary bg-asph-bg-primary p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" aria-hidden="true" />
            <h2
              className="m-0 text-xl font-semibold text-asph-text-primary"
              id="bookmarks-heading"
            >
              Bookmarks
            </h2>
            {bookmarkCount !== undefined && (
              <span
                className="rounded-full bg-asph-bg-secondary px-2 py-0.5 text-sm text-asph-text-secondary"
                aria-label={`${bookmarkCount} bookmarks`}
              >
                {bookmarkCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-asph-text-tertiary"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="focus-visible:border-asph-accent-primary w-full rounded-full border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 pl-10 text-sm text-asph-text-primary transition-all duration-200 focus-visible:outline-none"
              aria-label="Search bookmarks"
            />
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="touch-target-icon cursor-pointer rounded-md border-none bg-transparent p-2 text-asph-text-secondary transition-all duration-200 hover:bg-asph-bg-secondary hover:text-asph-text-primary"
            aria-label="Manage bookmarks menu"
            aria-haspopup="dialog"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading && <FeedSkeleton count={5} aria-label="Loading bookmarks" />}

      {error && (
        <div className="error-state p-4 text-center" role="alert">
          <p className="text-red-500">
            Error loading bookmarks: {(error as Error).message}
          </p>
        </div>
      )}

      {!isLoading && !error && bookmarks?.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <Bookmark className="h-12 w-12 text-asph-text-tertiary" />
          <p className="mb-2 mt-4 text-base font-medium text-asph-text-primary">
            {searchQuery
              ? "No bookmarks found matching your search"
              : "No bookmarks yet"}
          </p>
          <p className="text-sm text-asph-text-secondary">
            Save posts to view them here later
          </p>
        </div>
      )}

      <div
        className="asph-scrollbar flex-1 overflow-y-auto p-4"
        role="feed"
        aria-label="Bookmarked posts"
      >
        {bookmarks?.map((bookmark) => (
          <article
            key={bookmark.id}
            className="group -mx-4 border-b border-asph-border-primary px-4 transition-colors duration-200 hover:bg-asph-bg-hover"
            aria-label={`Bookmarked post by ${bookmark.author?.displayName || bookmark.author?.handle || "unknown"}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <img
                src={
                  proxifyBskyImage(bookmark.author.avatar) ||
                  "/default-avatar.svg"
                }
                alt={bookmark.author?.handle || "unknown"}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-asph-text-primary">
                  {bookmark.author?.displayName ||
                    bookmark.author?.handle ||
                    "Unknown"}
                </span>
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-asph-text-secondary">
                  @{bookmark.author?.handle || "unknown"}
                </span>
              </div>
              <span className="whitespace-nowrap text-xs text-asph-text-tertiary">
                {formatDistanceToNow(new Date(bookmark.savedAt), {
                  addSuffix: true,
                })}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.postUri);
                }}
                className="touch-target-icon cursor-pointer rounded-md border-none bg-transparent p-2 text-asph-text-tertiary opacity-0 transition-all duration-200 hover:bg-asph-bg-secondary hover:text-red-600 group-hover:opacity-100"
                aria-label={`Delete bookmark for post by ${bookmark.author?.displayName || bookmark.author?.handle || "unknown"}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {bookmark.post ? (
              <div onClick={() => openPostThread(bookmark.post!)}>
                <PostRenderer
                  post={bookmark.post}
                  onLike={() => {}}
                  onRepost={() => {}}
                  onReply={() => {}}
                  onBookmark={() => handleBookmarkToggle(bookmark.post!)}
                  isBookmarked={true}
                  compact
                  onQuoteClick={(uri: string) => {
                    // Find the quoted post if it's available
                    const quotedPost = bookmarks?.find(
                      (b: { post?: AppBskyFeedDefs.PostView }) =>
                        b.post?.uri === uri,
                    )?.post;
                    if (quotedPost) {
                      setSelectedPost(quotedPost);
                      setShowThread(true);
                    } else {
                      // If we don't have the post data, open ThreadModal with the URI
                      // ThreadModal will fetch the post data itself
                      setSelectedPost({ uri } as AppBskyFeedDefs.PostView);
                      setShowThread(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="py-2 pb-4 pl-12">
                <p className="mb-2 leading-6 text-asph-text-primary">
                  {bookmark.text}
                </p>
                <p className="text-sm italic text-asph-text-tertiary">
                  Post no longer available
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowExportModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-bookmarks-title"
        >
          <div
            className="w-11/12 max-w-sm rounded-xl bg-asph-bg-primary shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="flex items-center justify-between border-b border-asph-border-primary p-6">
              <h3
                id="manage-bookmarks-title"
                className="m-0 text-lg font-semibold text-asph-text-primary"
              >
                Manage Bookmarks
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="touch-target-icon cursor-pointer rounded-md border-none bg-transparent p-2 text-asph-text-secondary transition-all duration-200 hover:bg-asph-bg-secondary"
                aria-label="Close manage bookmarks dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div
              className="flex flex-col gap-3 p-6"
              role="group"
              aria-label="Bookmark management options"
            >
              <button
                onClick={handleExport}
                className="touch-target-sm flex cursor-pointer items-center gap-2 rounded-lg border border-asph-border-primary bg-asph-bg-secondary px-4 py-3 text-sm font-medium text-asph-text-primary transition-all duration-200 hover:bg-asph-bg-hover"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export Bookmarks
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="touch-target-sm flex cursor-pointer items-center gap-2 rounded-lg border border-asph-border-primary bg-asph-bg-secondary px-4 py-3 text-sm font-medium text-asph-text-primary transition-all duration-200 hover:bg-asph-bg-hover"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import Bookmarks
              </button>

              <button
                onClick={handleClearAll}
                className="touch-target-sm flex cursor-pointer items-center gap-2 rounded-lg border border-red-600 bg-asph-bg-secondary px-4 py-3 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear All Bookmarks
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: "none" }}
              aria-label="Select bookmark file to import"
            />
          </div>
        </div>
      )}

      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
          }}
        />
      )}
    </div>
  );
};
