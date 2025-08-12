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
import { useNavigate } from "react-router-dom";
import { useModal } from "../contexts/ModalContext";
import { bookmarkService } from "../services/bookmark-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { PostRenderer } from "./PostRenderer";

export const Bookmarks: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initialize bookmark service
  useEffect(() => {
    bookmarkService.init();
  }, []);

  const {
    data: bookmarks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookmarks", searchQuery],
    queryFn: async () => {
      console.log("Fetching bookmarks...");
      if (searchQuery) {
        const results = await bookmarkService.searchBookmarks(searchQuery);
        console.log("Search results:", results);
        return results;
      }
      const bookmarks = await bookmarkService.getBookmarkedPosts();
      console.log("Bookmarks loaded:", bookmarks);
      return bookmarks;
    },
    staleTime: 30000,
  });

  const { data: bookmarkCount } = useQuery({
    queryKey: ["bookmarkCount"],
    queryFn: () => bookmarkService.getBookmarkCount(),
    staleTime: 30000,
  });

  const handleBookmarkToggle = async (post: AppBskyFeedDefs.PostView) => {
    await bookmarkService.toggleBookmark(post);
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
  };

  const handleDeleteBookmark = async (postUri: string) => {
    await bookmarkService.removeBookmark(postUri);
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
  };

  const handleExport = async () => {
    const bookmarks = await bookmarkService.exportBookmarks();
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
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bookmarks = JSON.parse(text);
      await bookmarkService.importBookmarks(bookmarks);
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
    } catch (error) {
      console.error("Failed to import bookmarks:", error);
      showAlert("Failed to import bookmarks. Please check the file format.", {
        variant: "error",
        title: "Import Failed",
      });
    }
  };

  const handleClearAll = async () => {
    await showConfirm(
      "Are you sure you want to clear all bookmarks? This cannot be undone.",
      async () => {
        await bookmarkService.clearAllBookmarks();
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
      },
      {
        variant: "warning",
        title: "Clear All Bookmarks",
        confirmText: "Clear All",
        cancelText: "Cancel",
      },
    );
  };

  const openPostThread = (post: AppBskyFeedDefs.PostView) => {
    const parts = post.uri.split("/");
    const handle = parts[2];
    const postId = parts[parts.length - 1];
    navigate(`/thread/${handle}/${postId}`);
  };

  return (
    <div className="flex h-full flex-col bg-bsky-bg-primary">
      <div className="sticky top-0 z-10 border-b border-bsky-border-primary bg-bsky-bg-primary p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          <h2 className="m-0 text-xl font-semibold text-bsky-text-primary">
            Bookmarks
          </h2>
          {bookmarkCount !== undefined && (
            <span className="rounded-full bg-bsky-bg-secondary px-2 py-0.5 text-sm text-bsky-text-secondary">
              {bookmarkCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-bsky-text-tertiary" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="focus:border-bsky-accent-primary w-full rounded-full border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 pl-10 text-sm text-bsky-text-primary transition-all duration-200 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary hover:text-bsky-text-primary"
            title="Export/Import"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div className="border-t-bsky-accent-primary h-8 w-8 animate-spin rounded-full border-2 border-bsky-border-primary" />
          <p>Loading bookmarks...</p>
        </div>
      )}

      {error && (
        <div className="error-state p-4 text-center">
          <p className="text-red-500">
            Error loading bookmarks: {(error as Error).message}
          </p>
        </div>
      )}

      {!isLoading && !error && bookmarks?.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <Bookmark className="h-12 w-12 text-gray-400" />
          <p className="mb-2 mt-4 text-base font-medium text-bsky-text-primary">
            {searchQuery
              ? "No bookmarks found matching your search"
              : "No bookmarks yet"}
          </p>
          <p className="text-sm text-bsky-text-secondary">
            Save posts to view them here later
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks?.map((bookmark) => (
          <div
            key={bookmark.id}
            className="group -mx-4 border-b border-bsky-border-primary px-4 transition-colors duration-200 hover:bg-bsky-bg-hover"
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
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-bsky-text-primary">
                  {bookmark.author?.displayName ||
                    bookmark.author?.handle ||
                    "Unknown"}
                </span>
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-bsky-text-secondary">
                  @{bookmark.author?.handle || "unknown"}
                </span>
              </div>
              <span className="whitespace-nowrap text-xs text-bsky-text-tertiary">
                {formatDistanceToNow(new Date(bookmark.savedAt), {
                  addSuffix: true,
                })}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.postUri);
                }}
                className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-tertiary opacity-0 transition-all duration-200 hover:bg-bsky-bg-secondary hover:text-red-600 group-hover:opacity-100"
                title="Delete bookmark"
              >
                <Trash2 className="h-4 w-4" />
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
                />
              </div>
            ) : (
              <div className="py-2 pb-4 pl-12">
                <p className="mb-2 leading-6 text-bsky-text-primary">
                  {bookmark.text}
                </p>
                <p className="text-sm italic text-bsky-text-tertiary">
                  Post no longer available
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="w-11/12 max-w-sm rounded-xl bg-bsky-bg-primary shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-bsky-border-primary p-6">
              <h3 className="m-0 text-lg font-semibold text-bsky-text-primary">
                Manage Bookmarks
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-6">
              <button
                onClick={handleExport}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-4 py-3 text-sm font-medium text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
              >
                <Download className="h-4 w-4" />
                Export Bookmarks
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-4 py-3 text-sm font-medium text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
              >
                <Upload className="h-4 w-4" />
                Import Bookmarks
              </button>

              <button
                onClick={handleClearAll}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-600 bg-bsky-bg-secondary px-4 py-3 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Bookmarks
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
