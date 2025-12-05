/**
 * ComposerThreadPreview - Level 2 (Standard) Component
 * Expandable section - shows thread preview with post reordering
 */

import { GripVertical, Image, Split, Video } from "lucide-react";
import React from "react";
import { MAX_POST_LENGTH, type UploadedMedia } from "./types";

interface ComposerThreadPreviewProps {
  posts: string[];
  displayPosts: string[];
  postOrder: number[];
  media: UploadedMedia[];
  text: string;

  // Drag and drop for media
  draggedMedia: UploadedMedia | null;
  dragOverPostIndex: number | null;
  dragOverMediaId: string | null;
  onMediaDragStart: (e: React.DragEvent, media: UploadedMedia) => void;
  onMediaDragEnd: (e: React.DragEvent) => void;
  onMediaDrop: (e: React.DragEvent, postIndex: number) => void;
  onDragOverPost: (e: React.DragEvent, postIndex: number) => void;
  onDragLeave: () => void;
  onMediaReorderDragOver: (e: React.DragEvent, media: UploadedMedia) => void;
  onMediaReorderDrop: (e: React.DragEvent, media: UploadedMedia) => void;
  setDragOverMediaId: (id: string | null) => void;

  // Drag and drop for posts
  draggedPostIndex: number | null;
  dragOverPostOrderIndex: number | null;
  onPostDragStart: (e: React.DragEvent, index: number) => void;
  onPostDragEnd: (e: React.DragEvent) => void;
  onPostDragOver: (e: React.DragEvent, index: number) => void;
  onPostDrop: (e: React.DragEvent, index: number) => void;
}

export const ComposerThreadPreview: React.FC<ComposerThreadPreviewProps> = ({
  posts,
  displayPosts,
  postOrder,
  media,
  text,
  draggedMedia,
  dragOverPostIndex,
  dragOverMediaId,
  onMediaDragStart,
  onMediaDragEnd,
  onMediaDrop,
  onDragOverPost,
  onDragLeave,
  onMediaReorderDragOver,
  onMediaReorderDrop,
  setDragOverMediaId,
  draggedPostIndex,
  dragOverPostOrderIndex,
  onPostDragStart,
  onPostDragEnd,
  onPostDragOver,
  onPostDrop,
}) => {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {posts.length > 1 && (
        <h3
          className="mb-4 text-lg font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Thread Preview
        </h3>
      )}
      <div className="space-y-3">
        {displayPosts.map((post, displayIndex) => {
          // Find the original index before reordering
          const originalIndex =
            postOrder.length > 0 ? postOrder[displayIndex] : displayIndex;
          const postMedia = media.filter((m) => m.postIndex === originalIndex);
          const hasMedia =
            postMedia.length > 0 ||
            (originalIndex === 0 &&
              media.filter((m) => m.postIndex === undefined).length > 0);

          return (
            <PostPreviewCard
              key={originalIndex}
              post={post}
              displayIndex={displayIndex}
              originalIndex={originalIndex}
              totalPosts={posts.length}
              postMedia={postMedia}
              media={media}
              hasMedia={hasMedia}
              text={text}
              // Media drag and drop
              draggedMedia={draggedMedia}
              dragOverPostIndex={dragOverPostIndex}
              dragOverMediaId={dragOverMediaId}
              onMediaDragStart={onMediaDragStart}
              onMediaDragEnd={onMediaDragEnd}
              onMediaDrop={onMediaDrop}
              onDragOverPost={onDragOverPost}
              onDragLeave={onDragLeave}
              onMediaReorderDragOver={onMediaReorderDragOver}
              onMediaReorderDrop={onMediaReorderDrop}
              setDragOverMediaId={setDragOverMediaId}
              // Post drag and drop
              draggedPostIndex={draggedPostIndex}
              dragOverPostOrderIndex={dragOverPostOrderIndex}
              onPostDragStart={onPostDragStart}
              onPostDragEnd={onPostDragEnd}
              onPostDragOver={onPostDragOver}
              onPostDrop={onPostDrop}
            />
          );
        })}
      </div>
    </div>
  );
};

interface PostPreviewCardProps {
  post: string;
  displayIndex: number;
  originalIndex: number;
  totalPosts: number;
  postMedia: UploadedMedia[];
  media: UploadedMedia[];
  hasMedia: boolean;
  text: string;
  // Media drag and drop
  draggedMedia: UploadedMedia | null;
  dragOverPostIndex: number | null;
  dragOverMediaId: string | null;
  onMediaDragStart: (e: React.DragEvent, media: UploadedMedia) => void;
  onMediaDragEnd: (e: React.DragEvent) => void;
  onMediaDrop: (e: React.DragEvent, postIndex: number) => void;
  onDragOverPost: (e: React.DragEvent, postIndex: number) => void;
  onDragLeave: () => void;
  onMediaReorderDragOver: (e: React.DragEvent, media: UploadedMedia) => void;
  onMediaReorderDrop: (e: React.DragEvent, media: UploadedMedia) => void;
  setDragOverMediaId: (id: string | null) => void;
  // Post drag and drop
  draggedPostIndex: number | null;
  dragOverPostOrderIndex: number | null;
  onPostDragStart: (e: React.DragEvent, index: number) => void;
  onPostDragEnd: (e: React.DragEvent) => void;
  onPostDragOver: (e: React.DragEvent, index: number) => void;
  onPostDrop: (e: React.DragEvent, index: number) => void;
}

const PostPreviewCard: React.FC<PostPreviewCardProps> = ({
  post,
  displayIndex,
  originalIndex,
  totalPosts,
  postMedia,
  media,
  hasMedia,
  text,
  draggedMedia,
  dragOverPostIndex,
  dragOverMediaId,
  onMediaDragStart,
  onMediaDragEnd,
  onMediaDrop,
  onDragOverPost,
  onDragLeave,
  onMediaReorderDragOver,
  onMediaReorderDrop,
  setDragOverMediaId,
  draggedPostIndex,
  dragOverPostOrderIndex,
  onPostDragStart,
  onPostDragEnd,
  onPostDragOver,
  onPostDrop,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    onDragOverPost(e, originalIndex);
    onPostDragOver(e, displayIndex);
  };

  const handleDrop = (e: React.DragEvent) => {
    // Check if we're dragging media or a post
    if (draggedMedia) {
      onMediaDrop(e, originalIndex);
    } else if (draggedPostIndex !== null) {
      onPostDrop(e, displayIndex);
    }
  };

  return (
    <div
      className={`bsky-card relative cursor-move p-4 transition-all hover:shadow-sm ${
        dragOverPostIndex === originalIndex ? "ring-2 ring-blue-400" : ""
      } ${dragOverPostOrderIndex === displayIndex ? "border-t-4 border-blue-500" : ""}`}
      draggable
      onDragStart={(e) => onPostDragStart(e, displayIndex)}
      onDragEnd={onPostDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay for media */}
      {dragOverPostIndex === originalIndex && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-blue-50 bg-opacity-50">
          <div className="font-medium text-blue-600">Drop attachment here</div>
        </div>
      )}

      {/* Post header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <GripVertical size={16} className="text-gray-400" />
          {totalPosts > 1 && (
            <span
              className="font-semibold"
              style={{ color: "var(--bsky-primary)" }}
            >
              Post {displayIndex + 1}
            </span>
          )}
          {hasMedia && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              style={{
                background: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-secondary)",
              }}
            >
              {media.some(
                (m) =>
                  m.type === "video" &&
                  (m.postIndex === originalIndex ||
                    (originalIndex === 0 && m.postIndex === undefined)),
              ) ? (
                <Video size={12} />
              ) : (
                <Image size={12} />
              )}
              {originalIndex === 0
                ? media.filter(
                    (m) => m.postIndex === undefined || m.postIndex === 0,
                  ).length
                : postMedia.length}
            </span>
          )}
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {post.length}/{MAX_POST_LENGTH}
        </span>
      </div>

      {/* Post content */}
      <div
        className="mb-3 whitespace-pre-wrap break-words"
        style={{
          color: "var(--bsky-text-primary)",
          lineHeight: "1.5",
        }}
      >
        {post}
      </div>

      {/* Manual split indicator */}
      {text.includes("\n---\n") && originalIndex > 0 && (
        <div
          className="mb-2 flex items-center gap-2 text-xs"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <Split size={14} />
          <span>Manual split</span>
        </div>
      )}

      {/* Attachments for this post */}
      {(originalIndex === 0
        ? media.filter((m) => m.postIndex === undefined || m.postIndex === 0)
        : postMedia
      ).length > 0 && (
        <div
          className="mt-3 grid grid-cols-4 gap-2 border-t pt-3"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          {(originalIndex === 0
            ? media.filter(
                (m) => m.postIndex === undefined || m.postIndex === 0,
              )
            : postMedia
          ).map((m) => (
            <div
              key={m.id}
              className={`relative cursor-move overflow-hidden rounded border ${dragOverMediaId === m.id ? "ring-2 ring-blue-400" : ""}`}
              style={{
                borderColor:
                  dragOverMediaId === m.id
                    ? "var(--bsky-primary)"
                    : "var(--bsky-border-primary)",
                background: "var(--bsky-bg-secondary)",
                transition: "border-color 0.2s",
              }}
              draggable
              onDragStart={(e) => onMediaDragStart(e, m)}
              onDragEnd={onMediaDragEnd}
              onDragOver={(e) => onMediaReorderDragOver(e, m)}
              onDrop={(e) => onMediaReorderDrop(e, m)}
              onDragLeave={() => setDragOverMediaId(null)}
            >
              {m.type === "video" ? (
                <video
                  src={m.preview}
                  className="pointer-events-none h-16 w-full object-cover"
                />
              ) : (
                <img
                  src={m.preview}
                  alt={m.alt || "Attachment"}
                  className="pointer-events-none h-16 w-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-all hover:bg-opacity-20">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  className="opacity-0 hover:opacity-100"
                >
                  <path d="M7 11V7a5 5 0 0110 0v4m-5-4v10m-4-6h8" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComposerThreadPreview;
