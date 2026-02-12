import type { AppBskyFeedDefs } from "@atproto/api";
import {
  BarChart3,
  Image,
  Loader,
  Quote,
  Send,
  Smile,
  Type,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useVideoCompression } from "../hooks/useVideoCompression";
import { debug } from "../shared/debug";
import { extractBskyUrls, parseBskyPostUrl } from "../utils/bsky-url-parser";
import { compressImage, isCompressibleImage } from "../utils/image-compression";
import { proxifyBskyImage } from "../utils/image-proxy";
import {
  BLUESKY_MAX_VIDEO_SIZE,
  isVideoFile,
  shouldCompressVideo,
} from "../utils/video-compression";
import { EmojiPicker } from "./EmojiPicker";
import {
  MarkdownComposer,
  type MarkdownComposerHandle,
  parseMarkdownToPlainText,
} from "./MarkdownComposer";
import {
  createEmptyPoll,
  isPollValid,
  PollComposer,
  type PollData,
} from "./PollComposer";
import { VideoUploadProgress } from "./VideoUploadProgress";

interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
}

interface FormattedComposerProps {
  onSubmit: (
    text: string,
    media?: UploadedMedia[],
    quotedPost?: AppBskyFeedDefs.PostView,
    poll?: PollData,
  ) => Promise<void>;
  maxLength?: number;
  placeholder?: string;
  initialText?: string;
  replyTo?: {
    uri: string;
    cid: string;
    author: { handle: string; displayName?: string };
    text?: string;
  };
  parentPost?: AppBskyFeedDefs.PostView;
  quotedPost?: AppBskyFeedDefs.PostView;
  features?: {
    media?: boolean;
    emoji?: boolean;
    poll?: boolean;
    richText?: boolean;
    shortcuts?: boolean;
  };
  showReplyContext?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  onChange?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

const MAX_IMAGE_SIZE = 1000000;
const MAX_VIDEO_SIZE = BLUESKY_MAX_VIDEO_SIZE;
const MAX_IMAGES = 4;
const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mpeg", ".webm", ".mov"];

export function FormattedComposer({
  onSubmit,
  maxLength = 300,
  placeholder = "What's happening?",
  initialText = "",
  replyTo,
  parentPost,
  quotedPost,
  features = {
    media: true,
    emoji: true,
    poll: true,
    richText: true,
    shortcuts: true,
  },
  showReplyContext = true,
  submitLabel = "Post",
  onCancel,
  onChange,
  onFocus,
  onBlur,
  autoFocus = false,
}: FormattedComposerProps) {
  const { agent } = useAuth();
  const [text, setText] = useState(initialText);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRichText, setUseRichText] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const videoCompression = useVideoCompression({
    preset: "auto",
    generateThumbnail: true,
    thumbnailTime: 1,
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [detectedQuotePost, setDetectedQuotePost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [isLoadingQuotePost, setIsLoadingQuotePost] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdownRef = useRef<MarkdownComposerHandle>(null);
  const mediaUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!agent || quotedPost) return;

    const detectAndFetchPost = async () => {
      const urls = extractBskyUrls(text);
      if (urls.length === 0) {
        setDetectedQuotePost(null);
        return;
      }

      const firstUrl = urls[0];
      const parsed = parseBskyPostUrl(firstUrl);
      if (!parsed) {
        setDetectedQuotePost(null);
        return;
      }

      setIsLoadingQuotePost(true);
      try {
        const response = await agent.getPostThread({
          uri: parsed.uri,
          depth: 0,
        });
        if (
          response.success &&
          response.data.thread.$type === "app.bsky.feed.defs#threadViewPost"
        ) {
          const threadPost = response.data.thread as any;
          if (threadPost.post) {
            setDetectedQuotePost(threadPost.post);
          }
        }
      } catch (error) {
        debug.error("Failed to fetch quoted post:", error);
        setDetectedQuotePost(null);
      } finally {
        setIsLoadingQuotePost(false);
      }
    };

    const timer = setTimeout(() => {
      detectAndFetchPost();
    }, 500);

    return () => clearTimeout(timer);
  }, [text, agent, quotedPost]);

  useEffect(() => {
    media.forEach((m) => {
      if (m.preview && !m.preview.startsWith("data:")) {
        mediaUrlsRef.current.add(m.preview);
      }
    });
  }, [media]);

  useEffect(() => {
    return () => {
      mediaUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      mediaUrlsRef.current.clear();
    };
  }, []);

  const handleTextChange = (newText: string) => {
    setText(newText);
    onChange?.(newText);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (features.shortcuts && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
    e.stopPropagation();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addMedia(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addMedia = async (file: File) => {
    try {
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

        if (videoCompression.isTooLarge(file)) {
          setError("Video is too large. Maximum size is 500MB.");
          return;
        }

        let processedFile = file;

        if (shouldCompressVideo(file)) {
          try {
            const result = await videoCompression.compressVideo(file);
            processedFile = result.file;
          } catch (compressionError) {
            debug.error("Video compression failed:", compressionError);
            if (file.size <= MAX_VIDEO_SIZE) {
              processedFile = file;
            } else {
              setError(
                "Failed to compress video. Please try a smaller file or different format.",
              );
              return;
            }
          }
        }

        if (processedFile.size > MAX_VIDEO_SIZE) {
          setError(
            `Video is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is ${(MAX_VIDEO_SIZE / (1024 * 1024)).toFixed(0)}MB.`,
          );
          return;
        }

        const preview = URL.createObjectURL(processedFile);
        mediaUrlsRef.current.add(preview);

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
        const imageCount = media.filter((m) => m.type === "image").length;
        if (imageCount >= MAX_IMAGES) {
          setError(`Maximum ${MAX_IMAGES} images allowed`);
          return;
        }

        let processedFile = file;
        if (isCompressibleImage(file) && file.size > MAX_IMAGE_SIZE) {
          try {
            processedFile = await compressImage(file);
          } catch (compressionError) {
            debug.error("Failed to compress image:", compressionError);
          }
        }

        if (processedFile.size > MAX_IMAGE_SIZE) {
          setError("Image must be less than 1MB");
          return;
        }

        const preview = URL.createObjectURL(processedFile);
        mediaUrlsRef.current.add(preview);

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

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
        mediaUrlsRef.current.delete(item.preview);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

  const updateAltText = (id: string, alt: string) => {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt } : m)));
  };

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

  const handleSubmit = async () => {
    const plainText = useRichText ? parseMarkdownToPlainText(text) : text;

    if (
      !agent ||
      isSubmitting ||
      (!plainText.trim() && media.length === 0 && !poll)
    ) {
      return;
    }

    if (poll && !isPollValid(poll)) {
      setError("Please fill in all poll options");
      return;
    }

    if (plainText.length > maxLength) {
      setError(`Text exceeds ${maxLength} characters`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const finalQuotedPost = quotedPost || detectedQuotePost || undefined;
      let finalText = plainText.trim();

      if (detectedQuotePost && !quotedPost) {
        const urls = extractBskyUrls(text);
        urls.forEach((url) => {
          finalText = finalText.replace(url, "").trim();
        });
      }

      await onSubmit(finalText, media, finalQuotedPost, poll || undefined);

      media.forEach((m) => {
        URL.revokeObjectURL(m.preview);
        mediaUrlsRef.current.delete(m.preview);
      });

      setText("");
      setMedia([]);
      setPoll(null);
      setShowEmojiPicker(false);
      setDetectedQuotePost(null);
      setUseRichText(false);
      setShowPreview(false);
    } catch (error) {
      debug.error("Failed to submit:", error);
      setError(error instanceof Error ? error.message : "Failed to post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (useRichText && markdownRef.current) {
      const start = markdownRef.current.selectionStart;
      const end = markdownRef.current.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      onChange?.(newText);

      setTimeout(() => {
        markdownRef.current?.focus();
        markdownRef.current?.setSelectionRange(
          start + emoji.length,
          start + emoji.length,
        );
      }, 0);
    } else if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      onChange?.(newText);

      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          start + emoji.length,
          start + emoji.length,
        );
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  const togglePoll = () => {
    if (poll) {
      setPoll(null);
    } else {
      setPoll(createEmptyPoll());
    }
  };

  const toggleRichText = () => {
    setUseRichText(!useRichText);
    setShowPreview(false);
  };

  const plainTextLength = useRichText
    ? parseMarkdownToPlainText(text).length
    : text.length;

  return (
    <div className="w-full">
      {showReplyContext && replyTo && parentPost && (
        <div
          className="mb-4 rounded-lg border p-3"
          style={{
            backgroundColor: "var(--asph-bg-primary)",
            borderColor: "var(--asph-border-primary)",
          }}
        >
          <div
            className="mb-1 text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Replying to
          </div>
          <div className="flex items-start gap-3">
            <img
              src={
                parentPost.author.avatar
                  ? proxifyBskyImage(parentPost.author.avatar)
                  : "/default-avatar.svg"
              }
              alt={parentPost.author.handle}
              className="h-8 w-8 rounded-full"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm">
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {parentPost.author.displayName || parentPost.author.handle}
                </span>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  @{parentPost.author.handle}
                </span>
              </div>
              <div
                className="mt-1 line-clamp-2 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {(parentPost.record as any)?.text || ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoadingQuotePost && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-tertiary)",
          }}
        >
          <Loader size={16} className="animate-spin" />
          Loading quote post...
        </div>
      )}

      {(quotedPost || detectedQuotePost) && (
        <div
          className="mb-4 rounded-lg border p-3"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
          }}
        >
          <div
            className="mb-1 flex items-center justify-between text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            <span>
              <Quote size={12} className="mr-1 inline" />
              {detectedQuotePost && !quotedPost
                ? "Quote post detected"
                : "Quoting"}
            </span>
            {detectedQuotePost && !quotedPost && (
              <button
                onClick={() => setDetectedQuotePost(null)}
                className="text-xs hover:text-red-500"
                title="Remove quote"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-start gap-3">
            {(() => {
              const displayPost = quotedPost || detectedQuotePost;
              if (!displayPost) return null;

              return (
                <>
                  <img
                    src={
                      displayPost.author.avatar
                        ? proxifyBskyImage(displayPost.author.avatar)
                        : "/default-avatar.svg"
                    }
                    alt={displayPost.author.handle}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm">
                      <span
                        className="font-semibold"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {displayPost.author.displayName ||
                          displayPost.author.handle}
                      </span>
                      <span style={{ color: "var(--asph-text-secondary)" }}>
                        @{displayPost.author.handle}
                      </span>
                    </div>
                    <div
                      className="mt-1 line-clamp-3 text-sm"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {(displayPost.record as any)?.text || ""}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {useRichText ? (
        <MarkdownComposer
          ref={markdownRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          showPreview={showPreview}
          onPreviewToggle={setShowPreview}
        />
      ) : (
        <>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus={autoFocus}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            className="min-h-[120px] w-full resize-none rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
            }}
          />
          <div className="mt-1 flex items-center justify-end">
            <span
              className={`text-xs ${plainTextLength > maxLength * 0.9 ? "text-orange-500" : ""}`}
              style={{
                color:
                  plainTextLength <= maxLength * 0.9
                    ? "var(--asph-text-secondary)"
                    : undefined,
              }}
            >
              {plainTextLength}/{maxLength}
            </span>
          </div>
        </>
      )}

      {poll && (
        <PollComposer
          poll={poll}
          onChange={setPoll}
          onRemove={() => setPoll(null)}
        />
      )}

      {media.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
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

              <button
                onClick={() => removeMedia(item.id)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-all group-hover:opacity-100"
              >
                <X size={16} />
              </button>

              {item.type === "image" && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 opacity-0 transition-all group-hover:opacity-100">
                  <input
                    type="text"
                    value={item.alt}
                    onChange={(e) => updateAltText(item.id, e.target.value)}
                    placeholder="Alt text"
                    className="w-full rounded border bg-white/10 px-2 py-1 text-xs text-white placeholder-white/60 focus-visible:outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
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
                className="rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--asph-text-secondary)" }}
                title="Add image or video"
              >
                <Image size={20} />
              </button>
            </>
          )}

          {features.emoji && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isSubmitting}
                className="rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--asph-text-secondary)" }}
                title="Add emoji"
              >
                <Smile size={20} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-[70] mb-2">
                  <EmojiPicker
                    onSelectEmoji={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          )}

          {features.poll && (
            <button
              onClick={togglePoll}
              disabled={isSubmitting || media.length > 0}
              className={`rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${
                poll ? "text-blue-500" : ""
              }`}
              style={{
                color: poll ? undefined : "var(--asph-text-secondary)",
              }}
              title={poll ? "Remove poll" : "Add poll"}
            >
              <BarChart3 size={20} />
            </button>
          )}

          {features.richText && (
            <button
              onClick={toggleRichText}
              disabled={isSubmitting}
              className={`rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${
                useRichText ? "text-blue-500" : ""
              }`}
              style={{
                color: useRichText ? undefined : "var(--asph-text-secondary)",
              }}
              title={useRichText ? "Plain text mode" : "Rich text mode"}
            >
              <Type size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              {error}
            </span>
          )}

          {onCancel && (
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

          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (!text.trim() && media.length === 0 && !poll) ||
              (poll && !isPollValid(poll)) ||
              plainTextLength > maxLength
            }
            className="flex items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
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
              <Loader size={20} className="animate-spin" />
            ) : (
              <>
                <Send size={20} />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
