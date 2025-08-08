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
    <div className="notifications-feed bookmarks-container">
      <div className="bookmarks-header">
        <div className="bookmarks-title">
          <Bookmark className="h-5 w-5" />
          <h2>Bookmarks</h2>
          {bookmarkCount !== undefined && (
            <span className="bookmarks-count">{bookmarkCount}</span>
          )}
        </div>

        <div className="bookmarks-actions">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="action-button"
            title="Export/Import"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="loading-state">
          <div className="spinner" />
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
        <div className="empty-state">
          <Bookmark className="h-12 w-12 text-gray-400" />
          <p className="empty-message">
            {searchQuery
              ? "No bookmarks found matching your search"
              : "No bookmarks yet"}
          </p>
          <p className="empty-hint">Save posts to view them here later</p>
        </div>
      )}

      <div className="bookmarks-list">
        {bookmarks?.map((bookmark) => (
          <div key={bookmark.id} className="bookmark-item">
            <div className="bookmark-meta">
              <img
                src={
                  proxifyBskyImage(bookmark.author.avatar) ||
                  "/default-avatar.png"
                }
                alt={bookmark.author?.handle || "unknown"}
                className="author-avatar"
              />
              <div className="author-info">
                <span className="author-name">
                  {bookmark.author?.displayName ||
                    bookmark.author?.handle ||
                    "Unknown"}
                </span>
                <span className="author-handle">
                  @{bookmark.author?.handle || "unknown"}
                </span>
              </div>
              <span className="bookmark-time">
                {formatDistanceToNow(new Date(bookmark.savedAt), {
                  addSuffix: true,
                })}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.postUri);
                }}
                className="delete-bookmark-button"
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
              <div className="bookmark-content">
                <p className="bookmark-text">{bookmark.text}</p>
                <p className="post-unavailable">Post no longer available</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="load-more-trigger" />

      {showExportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowExportModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Bookmarks</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="close-button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="modal-actions">
              <button onClick={handleExport} className="modal-button export">
                <Download className="h-4 w-4" />
                Export Bookmarks
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="modal-button import"
              >
                <Upload className="h-4 w-4" />
                Import Bookmarks
              </button>

              <button
                onClick={handleClearAll}
                className="modal-button clear danger"
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
