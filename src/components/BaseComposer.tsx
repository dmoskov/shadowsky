import {
  AlertCircle,
  Edit2,
  Image,
  Loader,
  Send,
  Smile,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useVideoCompression } from "../hooks/useVideoCompression";
import { debug } from "../shared/debug";
import { compressImage, isCompressibleImage } from "../utils/image-compression";
import { safeCreateObjectURL, safeRevokeObjectURL } from "../utils/retry";
import { debounce, INTERACTION_TIMING } from "../utils/timing";
import {
  BLUESKY_MAX_VIDEO_SIZE,
  isVideoFile,
  shouldCompressVideo,
} from "../utils/video-compression";
import { EmojiPicker } from "./EmojiPicker";
import { GiphySearch } from "./GiphySearch";
import { ImageEditor } from "./ImageEditor";
import { VideoUploadProgress } from "./VideoUploadProgress";

async function loadAnthropicService() {
  return await import("../services/anthropic");
}

interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
}

interface BaseComposerProps {
  // Core functionality
  onSubmit: (text: string, media?: UploadedMedia[]) => Promise<void>;
  maxLength?: number;
  placeholder?: string;
  initialText?: string;

  // Reply context (optional)
  replyTo?: {
    uri: string;
    cid: string;
    author: { handle: string; displayName?: string };
  };

  // Feature toggles
  features?: {
    media?: boolean;
    emoji?: boolean;
    giphy?: boolean;
    altTextGeneration?: boolean;
    shortcuts?: boolean;
    imageEditing?: boolean;
  };

  // UI customization
  layout?: "inline" | "full";
  showCharCount?: boolean;
  submitLabel?: string;
  submitIcon?: React.ReactNode;

  // Callbacks
  onCancel?: () => void;
  onChange?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;

  // Auto-focus
  autoFocus?: boolean;
}

const MAX_IMAGE_SIZE = 1000000; // 1MB
const MAX_VIDEO_SIZE = BLUESKY_MAX_VIDEO_SIZE; // 100MB recommended
const MAX_IMAGES = 4;
const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mpeg", ".webm", ".mov"];

export function BaseComposer({
  onSubmit,
  maxLength = 300,
  placeholder = "What's happening?",
  initialText = "",
  replyTo,
  features = {
    media: true,
    emoji: true,
    giphy: false,
    altTextGeneration: true,
    shortcuts: true,
    imageEditing: true,
  },
  layout = "full",
  showCharCount = true,
  submitLabel = "Post",
  submitIcon = <Send size={layout === "inline" ? 16 : 20} />,
  onCancel,
  onChange,
  onFocus,
  onBlur,
  autoFocus = false,
}: BaseComposerProps) {
  const { agent } = useAuth();
  const [text, setText] = useState(initialText);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [generatingAlt, setGeneratingAlt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Video compression hook
  const videoCompression = useVideoCompression({
    preset: "auto",
    generateThumbnail: true,
    thumbnailTime: 1,
  });

  // Create a stable debounced callback for parent onChange
  // This prevents cascading re-renders on every keystroke
  const debouncedOnChangeRef = useRef<
    (((text: string) => void) & { cancel: () => void }) | null
  >(null);

  // Memoize the debounced function creation
  const getDebouncedOnChange = useCallback(() => {
    if (!onChange) return null;
    if (!debouncedOnChangeRef.current) {
      debouncedOnChangeRef.current = debounce(
        ((text: unknown) => onChange(text as string)) as (
          ...args: unknown[]
        ) => unknown,
        INTERACTION_TIMING.TYPING,
      ) as ((text: string) => void) & { cancel: () => void };
    }
    return debouncedOnChangeRef.current;
  }, [onChange]);

  // Cancel debounced callback on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      debouncedOnChangeRef.current?.cancel();
    };
  }, []);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= maxLength) {
      // Update local state immediately for responsive cursor feedback
      setText(newText);
      // Debounce parent callback to prevent cascading re-renders
      getDebouncedOnChange()?.(newText);
      setError(null);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (features.shortcuts && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
    // Stop propagation to prevent parent handlers
    e.stopPropagation();
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addMedia(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Add media file
  const addMedia = async (file: File) => {
    try {
      // Check if it's a video using MIME type detection
      const isVideo =
        isVideoFile(file) ||
        SUPPORTED_VIDEO_FORMATS.some((format) =>
          file.name.toLowerCase().endsWith(format),
        );

      if (isVideo) {
        if (media.some((m) => m.type === "video")) {
          setError("Only one video can be uploaded at a time");
          return;
        }

        // Check if video is too large to process
        if (videoCompression.isTooLarge(file)) {
          setError("Video is too large. Maximum size is 500MB.");
          return;
        }

        let processedFile = file;

        // Compress video if it exceeds the recommended size
        if (shouldCompressVideo(file)) {
          debug.log("Video needs compression:", {
            size: file.size,
            threshold: MAX_VIDEO_SIZE,
          });

          try {
            const result = await videoCompression.compressVideo(file);
            processedFile = result.file;

            if (result.wasCompressed) {
              debug.log("Video compressed:", {
                original: file.size,
                compressed: processedFile.size,
                ratio: (file.size / processedFile.size).toFixed(2),
              });
            }
          } catch (compressionError) {
            debug.error("Video compression failed:", compressionError);
            // If compression fails but file is under limit, use original
            if (file.size <= MAX_VIDEO_SIZE) {
              debug.log("Using original file as fallback");
              processedFile = file;
            } else {
              setError(
                "Failed to compress video. Please try a smaller file or different format.",
              );
              return;
            }
          }
        }

        // Final size check
        if (processedFile.size > MAX_VIDEO_SIZE) {
          setError(
            `Video is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is ${(MAX_VIDEO_SIZE / (1024 * 1024)).toFixed(0)}MB.`,
          );
          return;
        }

        // Create preview with error handling
        const preview = safeCreateObjectURL(processedFile);
        if (!preview) {
          setError("Failed to create preview for video file");
          return;
        }

        const newMedia: UploadedMedia = {
          id: Date.now().toString(),
          file: processedFile,
          preview,
          alt: "",
          type: "video",
        };

        setMedia((prev) => [...prev, newMedia]);
        setError(null);
      } else {
        // Check image limits
        const imageCount = media.filter((m) => m.type === "image").length;
        if (imageCount >= MAX_IMAGES) {
          setError(`Maximum ${MAX_IMAGES} images allowed`);
          return;
        }

        // Compress image if needed
        let processedFile = file;
        if (isCompressibleImage(file) && file.size > MAX_IMAGE_SIZE) {
          try {
            processedFile = await compressImage(file);
            debug.log("Image compressed", {
              original: file.size,
              compressed: processedFile.size,
            });
          } catch (compressionError) {
            debug.error("Failed to compress image:", compressionError);
          }
        }

        if (processedFile.size > MAX_IMAGE_SIZE) {
          setError("Image must be less than 1MB");
          return;
        }

        // Create preview with error handling
        const preview = safeCreateObjectURL(processedFile);
        if (!preview) {
          setError("Failed to create preview for media file");
          return;
        }

        const newMedia: UploadedMedia = {
          id: Date.now().toString(),
          file: processedFile,
          preview,
          alt: "",
          type: "image",
        };

        setMedia((prev) => [...prev, newMedia]);
        setError(null);
      }
    } catch (error) {
      debug.error("Failed to add media:", error);
      setError("Failed to add media");
    }
  };

  // Remove media
  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) {
        safeRevokeObjectURL(item.preview);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

  // Update alt text
  const updateAltText = (id: string, alt: string) => {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt } : m)));
  };

  // Handle image editor save
  const handleImageEditorSave = (
    editedImages: Array<{
      originalFile: File;
      editedFile: File;
      preview: string;
    }>,
  ) => {
    // Update media with edited versions
    const imageMedia = media.filter((m) => m.type === "image");
    const videoMedia = media.filter((m) => m.type === "video");

    const updatedImageMedia = imageMedia.map((item, index) => {
      const edited = editedImages[index];
      if (edited && edited.editedFile !== edited.originalFile) {
        // Revoke old preview URL
        safeRevokeObjectURL(item.preview);
        return {
          ...item,
          file: edited.editedFile,
          preview: edited.preview,
        };
      }
      return item;
    });

    setMedia([...updatedImageMedia, ...videoMedia]);
    setShowImageEditor(false);
  };

  // Check if there are images to edit
  const hasEditableImages = media.some((m) => m.type === "image");

  // Generate alt text with AI
  const handleGenerateAlt = async (id: string) => {
    const item = media.find((m) => m.id === id);
    if (!item || item.type !== "image") return;

    setGeneratingAlt(id);
    try {
      // Convert File to data URL for alt text generation
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = () => {
          reject(reader.error || new Error("FileReader error"));
        };
        reader.readAsDataURL(item.file);
      });

      const anthropicService = await loadAnthropicService();
      const alt = await anthropicService.generateAltText(dataUrl);
      updateAltText(id, alt);
    } catch (error) {
      debug.error("Failed to generate alt text:", error);
      // Provide more specific error message
      if (error instanceof Error && error.message.includes("rate limit")) {
        setError(
          "Alt text generation rate limit reached. Please try again later.",
        );
      } else if (
        error instanceof Error &&
        error.message.includes("temporarily unavailable")
      ) {
        setError(
          "Alt text service is temporarily unavailable. Please try again later.",
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to generate alt text. Please try again.",
        );
      }
    } finally {
      setGeneratingAlt(null);
    }
  };

  // Handle paste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await addMedia(file);
        }
      }
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!agent || isSubmitting || (!text.trim() && media.length === 0)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(text.trim(), media);

      // Reset form
      setText("");
      setMedia([]);
      setShowEmojiPicker(false);
      setShowGifSearch(false);
    } catch (error) {
      debug.error("Failed to submit:", error);
      setError(error instanceof Error ? error.message : "Failed to post");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);

    if (newText.length <= maxLength) {
      setText(newText);
      // Use debounced callback for consistency with text input
      getDebouncedOnChange()?.(newText);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  // Handle GIF selection
  const handleGifSelect = async (gifUrl: string) => {
    try {
      const response = await fetch(gifUrl);
      const blob = await response.blob();
      const file = new File([blob], "gif.gif", { type: "image/gif" });
      await addMedia(file);
      setShowGifSearch(false);
    } catch (error) {
      debug.error("Failed to add GIF:", error);
      setError("Failed to add GIF");
    }
  };

  const isInline = layout === "inline";

  return (
    <div className="w-full">
      {/* Reply context */}
      {replyTo && (
        <div
          className="mb-2 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Replying to @{replyTo.author.handle}
        </div>
      )}

      {/* Main composer area */}
      <div className={`flex ${isInline ? "gap-2" : "flex-col gap-3"}`}>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus={autoFocus}
            onFocus={() => {
              onFocus?.();
              // Stop propagation to prevent parent handlers
              event?.stopPropagation();
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`w-full resize-none rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isInline ? "min-h-[40px]" : "min-h-[100px]"
            }`}
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
            }}
          />

          {/* Media preview */}
          {media.length > 0 && (
            <div
              className={`mt-2 ${isInline ? "flex gap-2" : "grid grid-cols-2 gap-2"}`}
            >
              {media.map((item) => (
                <div key={item.id} className="group relative">
                  {item.type === "image" ? (
                    <img
                      src={item.preview}
                      alt={item.alt}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <video
                      src={item.preview}
                      className="h-32 w-full rounded object-cover"
                      controls
                    />
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeMedia(item.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>

                  {/* Alt text input */}
                  {item.type === "image" && !isInline && (
                    <div className="mt-1 flex gap-1">
                      <input
                        type="text"
                        value={item.alt}
                        onChange={(e) => updateAltText(item.id, e.target.value)}
                        placeholder="Alt text"
                        className="flex-1 rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        style={{
                          backgroundColor: "var(--asph-bg-secondary)",
                          borderColor: "var(--asph-border-primary)",
                          color: "var(--asph-text-primary)",
                        }}
                      />
                      {features.altTextGeneration && (
                        <button
                          onClick={() => handleGenerateAlt(item.id)}
                          disabled={generatingAlt === item.id}
                          className="rounded border px-2 py-1 text-xs transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800"
                          style={{ borderColor: "var(--asph-border-primary)" }}
                        >
                          {generatingAlt === item.id ? (
                            <Loader size={12} className="animate-spin" />
                          ) : (
                            "Generate"
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Edit images button */}
              {features.imageEditing && hasEditableImages && !isInline && (
                <button
                  onClick={() => setShowImageEditor(true)}
                  className="flex h-32 w-full items-center justify-center rounded border-2 border-dashed transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{
                    borderColor: "var(--asph-border-primary)",
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Edit2 size={20} />
                    <span className="text-xs">Edit All</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Video compression progress */}
          {videoCompression.isCompressing && (
            <div className="mt-2">
              <VideoUploadProgress
                stage="compressing"
                progress={videoCompression.state.progress}
                fileName={
                  videoCompression.state.metadata
                    ? `Compressing video (${(videoCompression.state.originalSize / (1024 * 1024)).toFixed(1)}MB)`
                    : "Compressing video..."
                }
                compressionProgress={{
                  stage: videoCompression.state.stage || "analyzing",
                  progress: videoCompression.state.progress,
                  estimatedTimeRemaining:
                    videoCompression.state.estimatedTimeRemaining ?? undefined,
                }}
                onCancel={() => videoCompression.cancel()}
                compact={layout === "inline"}
              />
            </div>
          )}

          {/* Character count and error */}
          <div className="mt-1 flex items-center justify-between">
            {showCharCount && (
              <span
                className={`text-xs ${text.length > maxLength * 0.9 ? "text-orange-500" : ""}`}
                style={{
                  color:
                    text.length <= maxLength * 0.9
                      ? "var(--asph-text-secondary)"
                      : undefined,
                }}
              >
                {text.length}/{maxLength}
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle size={12} />
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div
          className={`flex ${isInline ? "flex-col" : "flex-row items-end"} gap-2`}
        >
          {features.media && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className={`relative z-10 rounded-full p-2 transition-all duration-100 ease-in-out hover:scale-110 hover:bg-opacity-80 ${
                  isInline ? "h-8 w-8" : ""
                }`}
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-secondary)",
                }}
                title="Add image or video"
              >
                <Image size={isInline ? 16 : 20} />
              </button>
            </>
          )}

          {features.emoji && (
            <div className="relative z-10">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isSubmitting}
                className={`relative z-10 rounded-full p-2 transition-all duration-100 ease-in-out hover:scale-110 hover:bg-opacity-80 ${
                  isInline ? "h-8 w-8" : ""
                }`}
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-secondary)",
                }}
                title="Add emoji"
              >
                <Smile size={isInline ? 16 : 20} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 z-[70] mb-2">
                  <EmojiPicker
                    onSelectEmoji={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && media.length === 0)}
            className={`${
              isInline
                ? "h-8 w-8 rounded-full p-2"
                : "flex items-center gap-2 rounded-full px-4 py-2"
            } transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50`}
            style={{
              backgroundColor: "var(--asph-primary)",
              color: "white",
            }}
            title={
              features.shortcuts
                ? `${submitLabel} (Ctrl/Cmd + Enter)`
                : submitLabel
            }
          >
            {isSubmitting ? (
              <Loader size={isInline ? 16 : 20} className="animate-spin" />
            ) : (
              <>
                {submitIcon}
                {!isInline && <span>{submitLabel}</span>}
              </>
            )}
          </button>

          {onCancel && !isInline && (
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border px-4 py-2"
              style={{
                borderColor: "var(--asph-border-primary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* GIF search modal */}
      {features.giphy && showGifSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Search GIFs</h3>
              <button
                onClick={() => setShowGifSearch(false)}
                className="rounded-full p-2 transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <GiphySearch
              onSelectGif={handleGifSelect}
              onClose={() => setShowGifSearch(false)}
            />
          </div>
        </div>
      )}

      {/* Image editor modal */}
      {features.imageEditing && showImageEditor && hasEditableImages && (
        <ImageEditor
          images={media
            .filter((m) => m.type === "image")
            .map((m) => ({ file: m.file, preview: m.preview }))}
          onSave={handleImageEditorSave}
          onCancel={() => setShowImageEditor(false)}
        />
      )}
    </div>
  );
}
