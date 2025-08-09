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
import { bookmarkService } from "../services/bookmark-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { PostRenderer } from "./PostRenderer";

export const Bookmarks: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      alert("Failed to import bookmarks. Please check the file format.");
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        "Are you sure you want to clear all bookmarks? This cannot be undone.",
      )
    ) {
      await bookmarkService.clearAllBookmarks();
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkCount"] });
    }
  };

  const openPostThread = (post: AppBskyFeedDefs.PostView) => {
    const parts = post.uri.split("/");
    const handle = parts[2];
    const postId = parts[parts.length - 1];
    navigate(`/thread/${handle}/${postId}`);
  };

  return (
    <div className="h-full flex flex-col bg-bsky-bg-primary">
      <div className="sticky top-0 z-10 bg-bsky-bg-primary border-b border-bsky-border-primary p-4">
        <div className="flex items-center gap-2 mb-4">
          <Bookmark className="h-5 w-5" />
          <h2 className="text-xl font-semibold text-bsky-text-primary m-0">Bookmarks</h2>
          {bookmarkCount !== undefined && (
            <span className="bg-bsky-bg-secondary text-bsky-text-secondary py-0.5 px-2 rounded-full text-sm">{bookmarkCount}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bsky-text-tertiary" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 px-3 pl-10 bg-bsky-bg-secondary border border-bsky-border-primary rounded-full text-bsky-text-primary text-sm transition-all duration-200 focus:outline-none focus:border-bsky-accent-primary"
            />
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="p-2 bg-transparent border-none text-bsky-text-secondary cursor-pointer rounded-md transition-all duration-200 hover:bg-bsky-bg-secondary hover:text-bsky-text-primary"
            title="Export/Import"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 px-8">
          <div className="w-8 h-8 border-2 border-bsky-border-primary border-t-bsky-accent-primary rounded-full animate-spin" />
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
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <Bookmark className="h-12 w-12 text-gray-400" />
          <p className="text-bsky-text-primary text-base font-medium mt-4 mb-2">
            {searchQuery
              ? "No bookmarks found matching your search"
              : "No bookmarks yet"}
          </p>
          <p className="text-bsky-text-secondary text-sm">Save posts to view them here later</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks?.map((bookmark) => (
          <div key={bookmark.id} className="group border-b border-bsky-border-primary transition-colors duration-200 -mx-4 px-4 hover:bg-bsky-bg-hover">
            <div className="flex items-center gap-3 py-3 px-4">
              <img
                src={
                  proxifyBskyImage(bookmark.author.avatar) ||
                  "/default-avatar.png"
                }
                alt={bookmark.author?.handle || "unknown"}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <span className="block font-semibold text-bsky-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                  {bookmark.author?.displayName ||
                    bookmark.author?.handle ||
                    "Unknown"}
                </span>
                <span className="block text-sm text-bsky-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                  @{bookmark.author?.handle || "unknown"}
                </span>
              </div>
              <span className="text-xs text-bsky-text-tertiary whitespace-nowrap">
                {formatDistanceToNow(new Date(bookmark.savedAt), {
                  addSuffix: true,
                })}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.postUri);
                }}
                className="p-2 bg-transparent border-none text-bsky-text-tertiary cursor-pointer rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-bsky-bg-secondary hover:text-red-600"
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
                <p className="text-bsky-text-primary leading-6 mb-2">{bookmark.text}</p>
                <p className="text-sm text-bsky-text-tertiary italic">Post no longer available</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      {showExportModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowExportModal(false)}
        >
          <div className="bg-bsky-bg-primary rounded-xl w-11/12 max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-bsky-border-primary">
              <h3 className="text-lg font-semibold text-bsky-text-primary m-0">Manage Bookmarks</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 bg-transparent border-none text-bsky-text-secondary cursor-pointer rounded-md transition-all duration-200 hover:bg-bsky-bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <button onClick={handleExport} className="flex items-center gap-2 py-3 px-4 bg-bsky-bg-secondary border border-bsky-border-primary rounded-lg text-bsky-text-primary text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-bsky-bg-hover">
                <Download className="h-4 w-4" />
                Export Bookmarks
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 py-3 px-4 bg-bsky-bg-secondary border border-bsky-border-primary rounded-lg text-bsky-text-primary text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-bsky-bg-hover"
              >
                <Upload className="h-4 w-4" />
                Import Bookmarks
              </button>

              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 py-3 px-4 bg-bsky-bg-secondary border border-red-600 rounded-lg text-red-600 text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-red-50"
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
