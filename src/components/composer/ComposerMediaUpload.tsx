/**
 * ComposerMediaUpload - Level 1 (Primary) Component
 * Always visible - handles media upload, preview, and alt text
 */

import { AlertCircle, Loader, Sparkles, X } from "lucide-react";
import React from "react";
import type { UploadedMedia } from "./types";

interface ComposerMediaUploadProps {
  media: UploadedMedia[];
  posts: string[];
  isPosting: boolean;

  // Handlers
  onRemoveMedia: (id: string) => void;
  onUpdateAlt: (id: string, alt: string) => void;
  onAutoGenerateAlt: (id: string) => void;

  // Drag and drop
  draggedMedia: UploadedMedia | null;
  dragOverMediaId: string | null;
  onDragStart: (e: React.DragEvent, media: UploadedMedia) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onMediaDragOver: (e: React.DragEvent, media: UploadedMedia) => void;
  onMediaDrop: (e: React.DragEvent, media: UploadedMedia) => void;
  onDragLeave: () => void;

  // Alt text generation
  generatingAltTextFor: string | null;
}

export const ComposerMediaUpload: React.FC<ComposerMediaUploadProps> = ({
  media,
  posts,
  isPosting,
  onRemoveMedia,
  onUpdateAlt,
  onAutoGenerateAlt,
  draggedMedia: _draggedMedia,
  dragOverMediaId,
  onDragStart,
  onDragEnd,
  onMediaDragOver,
  onMediaDrop,
  onDragLeave,
  generatingAltTextFor,
}) => {
  // Prop declared in interface for consistency with parent component
  void _draggedMedia;
  if (media.length === 0) {
    return null;
  }

  const hasVideo = media.some((m) => m.type === "video");
  const hasMissingAltText = media.some((m) => m.type === "image" && !m.alt);

  return (
    <div className="asph-card mb-6 p-4 md:p-6">
      <h3
        className="mb-4 text-lg font-semibold"
        style={{ color: "var(--asph-text-primary)" }}
      >
        {hasVideo ? "Video" : "Images"}
        <span
          className="text-sm font-normal"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {posts.length > 1
            ? " (drag to reorder or assign to posts)"
            : media.length > 1
              ? " (drag to reorder)"
              : " (will be added to first post)"}
        </span>
      </h3>

      {/* Video upload notice */}
      {hasVideo && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg p-3"
          style={{ background: "var(--asph-bg-tertiary)" }}
        >
          <AlertCircle
            size={16}
            className="mt-0.5 flex-shrink-0"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Videos will be uploaded to Bluesky's servers for processing. This
            may take a few moments depending on file size and server load.
          </p>
        </div>
      )}

      {/* Missing alt text warning */}
      {hasMissingAltText && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-amber-400 p-3"
          style={{ background: "var(--asph-bg-tertiary)" }}
          role="alert"
          aria-live="polite"
        >
          <AlertCircle
            size={16}
            className="mt-0.5 flex-shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <p
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Some images are missing alt text. Adding alt text improves
            accessibility for screen reader users.
          </p>
        </div>
      )}

      {/* Media grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {media
          .filter((m) => m.postIndex === undefined || m.postIndex === 0)
          .map((m) => (
            <MediaItem
              key={m.id}
              media={m}
              isPosting={isPosting}
              onRemove={() => onRemoveMedia(m.id)}
              onUpdateAlt={(alt) => onUpdateAlt(m.id, alt)}
              onAutoGenerateAlt={() => onAutoGenerateAlt(m.id)}
              isDragOver={dragOverMediaId === m.id}
              isGeneratingAlt={generatingAltTextFor === m.id}
              canGenerateAlt={generatingAltTextFor === null}
              onDragStart={(e) => onDragStart(e, m)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onMediaDragOver(e, m)}
              onDrop={(e) => onMediaDrop(e, m)}
              onDragLeave={onDragLeave}
            />
          ))}
      </div>
    </div>
  );
};

interface MediaItemProps {
  media: UploadedMedia;
  isPosting: boolean;
  onRemove: () => void;
  onUpdateAlt: (alt: string) => void;
  onAutoGenerateAlt: () => void;
  isDragOver: boolean;
  isGeneratingAlt: boolean;
  canGenerateAlt: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

const MediaItem: React.FC<MediaItemProps> = ({
  media,
  isPosting: _isPostingMediaItem,
  onRemove,
  onUpdateAlt,
  onAutoGenerateAlt,
  isDragOver,
  isGeneratingAlt,
  canGenerateAlt,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
}) => {
  // Prop declared in interface for consistency with parent
  void _isPostingMediaItem;
  return (
    <div
      className={`relative cursor-move overflow-hidden rounded-lg border ${isDragOver ? "ring-2 ring-blue-400" : ""}`}
      style={{
        borderColor: isDragOver
          ? "var(--asph-primary)"
          : "var(--asph-border-primary)",
        background: "var(--asph-bg-secondary)",
        transition: "transform 0.2s, border-color 0.2s",
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Preview */}
      <div className="group/image relative h-32 w-full">
        {media.type === "video" ? (
          <video
            src={media.preview}
            controls
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <>
            <img
              src={media.preview}
              alt={media.alt || "Upload preview"}
              className="pointer-events-none h-full w-full object-cover"
            />
            {media.alt && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 p-3 opacity-0 transition-opacity duration-200 group-hover/image:opacity-100">
                <p className="line-clamp-4 text-center text-xs text-white">
                  {media.alt}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Remove button */}
      <button
        className="absolute right-2 top-2 rounded-full bg-black bg-opacity-70 p-1 text-white transition-all hover:bg-opacity-90"
        onClick={onRemove}
        aria-label="Remove media"
      >
        <X size={16} />
      </button>

      {/* Drag handle indicator */}
      <div className="absolute left-2 top-2 rounded-full bg-black bg-opacity-70 p-1 text-white">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M7 11V7a5 5 0 0110 0v4m-5-4v10m-4-6h8" />
        </svg>
      </div>

      {/* Alt text input */}
      <div
        className="relative border-t"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <label htmlFor={`alt-text-${media.id}`} className="sr-only">
          Alt text for image{" "}
          {media.alt
            ? "(has alt text)"
            : "(no alt text - add for accessibility)"}
        </label>
        <textarea
          id={`alt-text-${media.id}`}
          placeholder="Add alt text for accessibility"
          value={media.alt}
          onChange={(e) => onUpdateAlt(e.target.value)}
          className={`w-full resize-none p-2 pr-10 text-sm focus-visible:outline-none ${!media.alt ? "border-l-2 border-l-amber-400" : ""}`}
          rows={2}
          aria-describedby={`alt-text-help-${media.id}`}
          style={{
            background: "var(--asph-bg-primary)",
            color: "var(--asph-text-primary)",
            minHeight: "3.5rem",
          }}
        />
        <span id={`alt-text-help-${media.id}`} className="sr-only">
          Describe the image for screen reader users. Good alt text describes
          the content and function of the image.
        </span>

        {/* Auto-generate alt text button */}
        {media.type === "image" && (
          <button
            onClick={onAutoGenerateAlt}
            className={`absolute right-2 top-2 rounded-lg p-1.5 transition-all ${
              isGeneratingAlt
                ? "animate-pulse bg-blue-100 dark:bg-blue-900"
                : "hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            disabled={!canGenerateAlt}
            title="Generate alt text with AI"
          >
            {isGeneratingAlt ? (
              <Loader
                size={16}
                className="animate-spin"
                style={{ color: "var(--asph-primary)" }}
              />
            ) : (
              <Sparkles
                size={16}
                className="transition-transform"
                style={{ color: "var(--asph-text-secondary)" }}
              />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ComposerMediaUpload;
