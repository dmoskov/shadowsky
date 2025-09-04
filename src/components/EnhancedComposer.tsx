import type { AppBskyFeedDefs } from "@atproto/api";
import {
  AlertCircle,
  Hash,
  Image,
  Loader,
  Quote,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  generateAltText,
  generateSmartReplies,
  suggestHashtags,
  type HashtagSuggestion,
  type SmartReply,
} from "../services/anthropic";
import { appPreferencesService } from "../services/app-preferences-service";
import { debug } from "../shared/debug";
import { extractBskyUrls, parseBskyPostUrl } from "../utils/bsky-url-parser";
import { compressImage, isCompressibleImage } from "../utils/image-compression";
import { proxifyBskyImage } from "../utils/image-proxy";
import { EmojiPicker } from "./EmojiPicker";
import { GiphySearch } from "./GiphySearch";

interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
}

interface EnhancedComposerProps {
  // Core functionality
  onSubmit: (
    text: string,
    media?: UploadedMedia[],
    quotedPost?: AppBskyFeedDefs.PostView,
  ) => Promise<void>;
  maxLength?: number;
  placeholder?: string;
  initialText?: string;

  // Reply context (optional)
  replyTo?: {
    uri: string;
    cid: string;
    author: { handle: string; displayName?: string };
    text?: string;
  };

  // Parent post context for better reply understanding
  parentPost?: AppBskyFeedDefs.PostView;

  // Quote post context (optional)
  quotedPost?: AppBskyFeedDefs.PostView;

  // Feature toggles
  features?: {
    media?: boolean;
    emoji?: boolean;
    giphy?: boolean;
    altTextGeneration?: boolean;
    shortcuts?: boolean;
    smartReplies?: boolean;
    hashtags?: boolean;
    threadOptimization?: boolean;
  };

  // UI customization
  showReplyContext?: boolean;
  submitLabel?: string;

  // Callbacks
  onCancel?: () => void;
  onChange?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;

  // Auto-focus
  autoFocus?: boolean;
}

const MAX_IMAGE_SIZE = 1000000; // 1MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES = 4;
const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mpeg", ".webm", ".mov"];

export function EnhancedComposer({
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
    giphy: false,
    altTextGeneration: true,
    shortcuts: true,
    smartReplies: true,
    hashtags: true,
    threadOptimization: false,
  },
  showReplyContext = true,
  submitLabel = "Post",
  onCancel,
  onChange,
  onFocus,
  onBlur,
  autoFocus = false,
}: EnhancedComposerProps) {
  const { agent } = useAuth();
  const [text, setText] = useState(initialText);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [generatingAlt, setGeneratingAlt] = useState<string | null>(null);

  // AI features state
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [, setIsLoadingSmartReplies] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<
    HashtagSuggestion[]
  >([]);
  const [, setIsLoadingHashtags] = useState(false);
  const [enableSmartReplies, setEnableSmartReplies] = useState(false);
  const [enableHashtags, setEnableHashtags] = useState(false);

  // Quote post detection state
  const [detectedQuotePost, setDetectedQuotePost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [isLoadingQuotePost, setIsLoadingQuotePost] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load AI settings
  useEffect(() => {
    const loadSettings = async () => {
      const prefs = await appPreferencesService.getPreferences();
      if (prefs?.aiSettings) {
        setEnableSmartReplies(
          features.smartReplies === true &&
            prefs.aiSettings.enableSmartReplies === true,
        );
        setEnableHashtags(
          features.hashtags === true &&
            prefs.aiSettings.enableHashtagSuggestions === true,
        );
      }
    };
    loadSettings();
  }, [features.smartReplies, features.hashtags]);

  // Load smart replies for replies
  useEffect(() => {
    if (replyTo?.text && enableSmartReplies && !text) {
      loadSmartReplies();
    }
  }, [replyTo?.text, enableSmartReplies, text]);

  // Load hashtag suggestions
  useEffect(() => {
    if (enableHashtags && text.length > 50) {
      const timer = setTimeout(() => {
        loadHashtagSuggestions();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [text, enableHashtags]);

  // Detect Bluesky URLs and fetch post data
  useEffect(() => {
    if (!agent || quotedPost) return; // Don't detect if we already have a quoted post from props

    const detectAndFetchPost = async () => {
      const urls = extractBskyUrls(text);

      if (urls.length === 0) {
        setDetectedQuotePost(null);
        return;
      }

      // Take the first URL found
      const firstUrl = urls[0];
      const parsed = parseBskyPostUrl(firstUrl);

      if (!parsed) {
        setDetectedQuotePost(null);
        return;
      }

      setIsLoadingQuotePost(true);
      try {
        // Fetch the post thread using the AT URI
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
    }, 500); // Debounce to avoid too many API calls

    return () => clearTimeout(timer);
  }, [text, agent, quotedPost]);

  const loadSmartReplies = async () => {
    if (!replyTo?.text) return;

    setIsLoadingSmartReplies(true);
    try {
      const result = await generateSmartReplies(
        replyTo.text,
        replyTo.author.handle,
      );
      setSmartReplies(result.suggestions);
    } catch (error) {
      debug.error("Failed to generate smart replies:", error);
    } finally {
      setIsLoadingSmartReplies(false);
    }
  };

  const loadHashtagSuggestions = async () => {
    setIsLoadingHashtags(true);
    try {
      const result = await suggestHashtags(text);
      setHashtagSuggestions(result.hashtags);
      setShowHashtagSuggestions(true);
    } catch (error) {
      debug.error("Failed to suggest hashtags:", error);
    } finally {
      setIsLoadingHashtags(false);
    }
  };

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= maxLength) {
      setText(newText);
      onChange?.(newText);
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
    e.stopPropagation();
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addMedia(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Add media file
  const addMedia = async (file: File) => {
    try {
      const isVideo = SUPPORTED_VIDEO_FORMATS.some((format) =>
        file.name.toLowerCase().endsWith(format),
      );

      if (isVideo) {
        if (media.some((m) => m.type === "video")) {
          setError("Only one video can be uploaded at a time");
          return;
        }
        if (file.size > MAX_VIDEO_SIZE) {
          setError("Video must be less than 50MB");
          return;
        }
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
            debug.log("Image compressed", {
              original: file.size,
              compressed: processedFile.size,
            });
          } catch (error) {
            debug.error("Failed to compress image:", error);
          }
        }

        if (processedFile.size > MAX_IMAGE_SIZE) {
          setError("Image must be less than 1MB");
          return;
        }
        file = processedFile;
      }

      const preview = URL.createObjectURL(file);
      const newMedia: UploadedMedia = {
        id: Date.now().toString(),
        file: file,
        preview,
        alt: "",
        type: isVideo ? "video" : "image",
      };

      setMedia((prev) => [...prev, newMedia]);
      setError(null);
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
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

  // Update alt text
  const updateAltText = (id: string, alt: string) => {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt } : m)));
  };

  // Generate alt text with AI
  const handleGenerateAlt = async (id: string) => {
    const item = media.find((m) => m.id === id);
    if (!item || item.type !== "image") return;

    setGeneratingAlt(id);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(item.file);
      });

      const alt = await generateAltText(dataUrl);
      updateAltText(id, alt);
    } catch (error) {
      debug.error("Failed to generate alt text:", error);
      setError("Failed to generate alt text");
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
      // Use either the passed quotedPost prop or the detected one
      const finalQuotedPost = quotedPost || detectedQuotePost || undefined;

      // If we have a detected quote post, remove the URL from the text
      let finalText = text.trim();
      if (detectedQuotePost && !quotedPost) {
        const urls = extractBskyUrls(text);
        // Remove all detected Bluesky URLs from the text
        urls.forEach((url) => {
          finalText = finalText.replace(url, "").trim();
        });
      }

      await onSubmit(finalText, media, finalQuotedPost);

      setText("");
      setMedia([]);
      setShowEmojiPicker(false);
      setShowGifSearch(false);
      setShowHashtagSuggestions(false);
      setSmartReplies([]);
      setDetectedQuotePost(null);
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
      onChange?.(newText);

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

  // Handle smart reply selection
  const handleSelectSmartReply = (reply: SmartReply) => {
    setText(reply.text);
    onChange?.(reply.text);
    setSmartReplies([]);
    textareaRef.current?.focus();
  };

  // Handle hashtag selection
  const handleSelectHashtag = (tag: string) => {
    const newText = text + " " + tag;
    if (newText.length <= maxLength) {
      setText(newText);
      onChange?.(newText);
    }
    setShowHashtagSuggestions(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full">
      {/* Reply context */}
      {showReplyContext && replyTo && parentPost && (
        <div
          className="mb-4 rounded-lg border p-3"
          style={{
            backgroundColor: "var(--bsky-bg-primary)",
            borderColor: "var(--bsky-border-primary)",
          }}
        >
          <div
            className="mb-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
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
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {parentPost.author.displayName || parentPost.author.handle}
                </span>
                <span style={{ color: "var(--bsky-text-secondary)" }}>
                  @{parentPost.author.handle}
                </span>
              </div>
              <div
                className="mt-1 line-clamp-2 text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {(parentPost.record as any)?.text || ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading quote post indicator */}
      {isLoadingQuotePost && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          <Loader size={16} className="animate-spin" />
          Loading quote post...
        </div>
      )}

      {/* Quote post preview */}
      {(quotedPost || detectedQuotePost) && (
        <div
          className="mb-4 rounded-lg border p-3"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            borderColor: "var(--bsky-border-primary)",
          }}
        >
          <div
            className="mb-1 flex items-center justify-between text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
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
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {displayPost.author.displayName ||
                          displayPost.author.handle}
                      </span>
                      <span style={{ color: "var(--bsky-text-secondary)" }}>
                        @{displayPost.author.handle}
                      </span>
                    </div>
                    <div
                      className="mt-1 line-clamp-3 text-sm"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {(displayPost.record as any)?.text || ""}
                    </div>
                    {displayPost.embed &&
                      (displayPost.embed as any).$type ===
                        "app.bsky.embed.images#view" && (
                        <div className="mt-2 flex gap-1">
                          {(displayPost.embed as any).images
                            ?.slice(0, 2)
                            .map((img: any, idx: number) => (
                              <img
                                key={idx}
                                src={proxifyBskyImage(img.thumb)}
                                alt=""
                                className="h-16 w-16 rounded object-cover"
                              />
                            ))}
                          {(displayPost.embed as any).images?.length > 2 && (
                            <div
                              className="flex h-16 w-16 items-center justify-center rounded text-sm font-semibold"
                              style={{
                                backgroundColor: "var(--bsky-bg-tertiary)",
                                color: "var(--bsky-text-secondary)",
                              }}
                            >
                              +{(displayPost.embed as any).images.length - 2}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Smart reply suggestions */}
      {smartReplies.length > 0 && !text && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles
              size={14}
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Smart Replies
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {smartReplies.slice(0, 3).map((reply, index) => (
              <button
                key={index}
                onClick={() => handleSelectSmartReply(reply)}
                className="rounded-lg border px-3 py-1.5 text-sm transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
                disabled={isSubmitting}
              >
                {reply.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main composer area */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        autoFocus={autoFocus}
        onFocus={() => {
          onFocus?.();
          event?.stopPropagation();
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        className="min-h-[120px] w-full resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border-primary)",
          color: "var(--bsky-text-primary)",
        }}
      />

      {/* Media preview */}
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

              {/* Remove button */}
              <button
                onClick={() => removeMedia(item.id)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-all group-hover:opacity-100"
              >
                <X size={16} />
              </button>

              {/* Alt text input */}
              {item.type === "image" && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 opacity-0 transition-all group-hover:opacity-100">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={item.alt}
                      onChange={(e) => updateAltText(item.id, e.target.value)}
                      placeholder="Alt text"
                      className="flex-1 rounded border bg-white/10 px-2 py-1 text-xs text-white placeholder-white/60 focus:outline-none"
                    />
                    {features.altTextGeneration && (
                      <button
                        onClick={() => handleGenerateAlt(item.id)}
                        disabled={generatingAlt === item.id}
                        className="rounded bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30"
                      >
                        {generatingAlt === item.id ? (
                          <Loader size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hashtag suggestions */}
      {showHashtagSuggestions && hashtagSuggestions.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 flex items-center gap-1.5">
            <Hash size={14} style={{ color: "var(--bsky-text-tertiary)" }} />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Suggested Hashtags
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {hashtagSuggestions.map((tag, index) => (
              <button
                key={index}
                onClick={() => handleSelectHashtag(tag.tag)}
                className="rounded-full border px-2 py-0.5 text-xs transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
                title={`Relevance: ${tag.relevance}${tag.isTrending ? " (Trending)" : ""}`}
              >
                {tag.tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Media button */}
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
                style={{ color: "var(--bsky-text-secondary)" }}
                title="Add image or video"
              >
                <Image size={20} />
              </button>
            </>
          )}

          {/* Emoji picker */}
          {features.emoji && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isSubmitting}
                className="rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--bsky-text-secondary)" }}
                title="Add emoji"
              >
                <Smile size={20} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-50 mb-2">
                  <EmojiPicker
                    onSelectEmoji={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Character count */}
          <span
            className={`text-sm ${text.length > maxLength * 0.9 ? "text-orange-500" : ""}`}
            style={{
              color:
                text.length <= maxLength * 0.9
                  ? "var(--bsky-text-secondary)"
                  : undefined,
            }}
          >
            {text.length}/{maxLength}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Error message */}
          {error && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <AlertCircle size={16} />
              {error}
            </span>
          )}

          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border px-4 py-2"
              style={{
                borderColor: "var(--bsky-border-primary)",
                color: "var(--bsky-text-secondary)",
              }}
            >
              Cancel
            </button>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && media.length === 0)}
            className="flex items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--bsky-primary)",
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

      {/* GIF search modal */}
      {features.giphy && showGifSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Search GIFs</h3>
              <button
                onClick={() => setShowGifSearch(false)}
                className="rounded-full p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-700"
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
    </div>
  );
}
