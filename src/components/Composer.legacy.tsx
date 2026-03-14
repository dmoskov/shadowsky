import type { AppBskyFeedDefs } from "@atproto/api";
import { RichText } from "@atproto/api";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  FileText,
  GripVertical,
  Image,
  Link,
  Loader,
  MessageCircle,
  MessageSquare,
  Plus,
  Save,
  Send,
  Settings,
  Smile,
  Split,
  Trash2,
  Undo,
  Video,
  Wand2,
  X,
} from "lucide-react";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import {
  useCreateDraft,
  useDeleteDraft,
  useDrafts,
  useLoadDraft,
  useUpdateDraft,
} from "../hooks/useDrafts";
import { useLinkPreview } from "../hooks/useLinkPreview";
import { useVideoUploadManager } from "../hooks/useVideoUploadManager";
import {
  fetchLinkMetadata,
  type LinkMetadata,
  type StyleMatchedWritingFeedback,
  type ThreadOptimizationResult,
  type ToneOption,
} from "../services/anthropic";
import { appPreferencesService } from "../services/app-preferences-service";
import { ThreadgateService } from "../services/atproto/threadgate";
import { getComposerSettings, saveComposerSettings } from "../services/drafts";
import type { EnrichedDraft } from "../services/drafts/official-draft-service";
import {
  postToMultipleAccounts,
  retryPostToAccount,
  type MultiPostProgress,
  type PostContent,
} from "../services/multi-account-posting-service";
import {
  composeFromSharedContent,
  parseReceivedShare,
} from "../services/share-service";
import { debug } from "../shared/debug";
import { uploadBlobWithRetry } from "../utils/blob-upload";
import { isGifFile } from "../utils/gif-to-video";
import { compressImage, isCompressibleImage } from "../utils/image-compression";
import { createLogger } from "../utils/logger";
import { parseBskyUrl } from "../utils/url-helpers";
import { MultiAccountConfirmDialog } from "./composer/MultiAccountConfirmDialog";
import {
  MultiAccountSelector,
  type AccountPostStatus,
} from "./composer/MultiAccountSelector";
import { extractFirstBskyPostUrl, extractFirstLinkUrl } from "./composer/utils";
import { type MentionTypeaheadHandle } from "./MentionTypeahead";
import { ReplyControls, type ReplyPermission } from "./ReplyControls";
import { AISettingsPanel } from "./settings/AISettingsPanel";
import { ThreadComposer } from "./ThreadComposer";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { UploadProgressBar } from "./ui/UploadProgressBar";
// Lazy-loaded sub-components for mobile performance
const ComposerTextArea = React.lazy(() =>
  import("./composer/ComposerTextArea").then((module) => ({
    default: module.ComposerTextArea,
  })),
);
const ComposerMediaUpload = React.lazy(() =>
  import("./composer/ComposerMediaUpload").then((module) => ({
    default: module.ComposerMediaUpload,
  })),
);

// Lazy-loaded modals for performance optimization
const ComposerModals = React.lazy(() =>
  import("./composer/ComposerModals").then((module) => ({
    default: module.ComposerModals,
  })),
);

const logger = createLogger("Composer");

let anthropicServiceModule: typeof import("../services/anthropic") | null =
  null;

async function loadAnthropicService() {
  if (!anthropicServiceModule) {
    anthropicServiceModule = await import("../services/anthropic");
  }
  return anthropicServiceModule;
}

interface NumberingFormat {
  id: string;
  name: string;
  format: (index: number, total: number) => string;
  example: string;
}

interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
  postIndex?: number; // Track which post this attachment belongs to
  order?: number; // Track order within a post
}

const NUMBERING_FORMATS: NumberingFormat[] = [
  {
    id: "none",
    name: "No numbering",
    format: () => "",
    example: "",
  },
  {
    id: "simple",
    name: "Simple",
    format: (i, t) => `${i}/${t}`,
    example: "1/5",
  },
  {
    id: "brackets",
    name: "Brackets",
    format: (i, t) => `[${i}/${t}]`,
    example: "[1/5]",
  },
  {
    id: "thread",
    name: "Thread",
    format: (i, t) => (i === 1 ? "🧵 1/" + t : `${i}/${t}`),
    example: "🧵 1/5",
  },
  {
    id: "dots",
    name: "Dots",
    format: (i, t) => `${i}•${t}`,
    example: "1•5",
  },
];

const TONE_OPTIONS: {
  value: ToneOption;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal and business-like",
    icon: "💼",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Relaxed and friendly",
    icon: "😊",
  },
  {
    value: "humorous",
    label: "Humorous",
    description: "Witty and playful",
    icon: "😄",
  },
  {
    value: "informative",
    label: "Informative",
    description: "Educational and clear",
    icon: "📚",
  },
  {
    value: "inspirational",
    label: "Inspirational",
    description: "Motivating and uplifting",
    icon: "✨",
  },
];

const MAX_POST_LENGTH = 300;
const MAX_IMAGE_SIZE = 1000000; // 1MB (Bluesky's exact limit)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_VIDEO_DURATION = 180; // 3 minutes in seconds
const MAX_IMAGES_PER_POST = 4;
const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mpeg", ".webm", ".mov"];

// Helper function to get video duration
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

export function Composer() {
  const { agent, session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [text, setText] = useState("");
  const [posts, setPosts] = useState<string[]>([]);
  const [numberingFormat, setNumberingFormat] = useState<
    "none" | "simple" | "brackets" | "thread" | "dots"
  >("simple");
  const [showSettings, setShowSettings] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{
    type: "idle" | "posting" | "success" | "error" | "loading";
    message?: string;
    postUrl?: string;
  } | null>({ type: "idle" });
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUrlsRef = useRef<Set<string>>(new Set());

  // Video upload manager with automatic cleanup and duplicate prevention
  const videoUploadManager = useVideoUploadManager(agent);

  // Link preview detection
  const linkPreview = useLinkPreview(text);
  const [linkPreviewEnabled, setLinkPreviewEnabled] = useState(true);
  const lastDetectedUrl = useRef<string | null>(null);

  // Re-enable link preview when a new URL is detected
  useEffect(() => {
    if (
      linkPreview.detectedUrl &&
      linkPreview.detectedUrl !== lastDetectedUrl.current
    ) {
      lastDetectedUrl.current = linkPreview.detectedUrl;
      setLinkPreviewEnabled(true);
    } else if (!linkPreview.detectedUrl) {
      lastDetectedUrl.current = null;
    }
  }, [linkPreview.detectedUrl]);

  // Draft and scheduling state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  // Draft hooks
  const { data: drafts = [] } = useDrafts(agent, true);
  const createDraftMutation = useCreateDraft(agent);
  const updateDraftMutation = useUpdateDraft(agent);
  const deleteDraftMutation = useDeleteDraft(agent);
  const loadDraftMutation = useLoadDraft();
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [numberingPosition, setNumberingPosition] = useState<
    "beginning" | "end"
  >("end");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingPost, setPendingPost] = useState<{
    posts: string[];
    media: UploadedMedia[];
  } | null>(null);
  const [autoGenerateAltText, setAutoGenerateAltText] = useState(false);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const sendTimeout = useRef<NodeJS.Timeout | null>(null);
  const autoGenerateAltTextRef = useRef<
    ((mediaId: string) => Promise<void>) | null
  >(null);

  // Drag and drop state
  const [draggedMedia, setDraggedMedia] = useState<UploadedMedia | null>(null);
  const [dragOverPostIndex, setDragOverPostIndex] = useState<number | null>(
    null,
  );
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null);
  const [generatingAltTextFor, setGeneratingAltTextFor] = useState<
    string | null
  >(null);

  // Post reordering state
  const [postOrder, setPostOrder] = useState<number[]>([]);
  const [draggedPostIndex, setDraggedPostIndex] = useState<number | null>(null);
  const [dragOverPostOrderIndex, setDragOverPostOrderIndex] = useState<
    number | null
  >(null);
  const [isReorderingPosts, setIsReorderingPosts] = useState(false);

  // Giphy and emoji state
  const [showGiphySearch, setShowGiphySearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<MentionTypeaheadHandle>(null);

  // Tone adjustment state
  const [showToneOptions, setShowToneOptions] = useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneOption | null>(null);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [tonePreview, setTonePreview] = useState<string | null>(null);
  const [showTonePreview, setShowTonePreview] = useState(false);

  // Thread optimization state
  const [threadOptimizationResult, setThreadOptimizationResult] =
    useState<ThreadOptimizationResult | null>(null);
  const [showThreadPreview, setShowThreadPreview] = useState(false);

  // Hashtag state
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<
    import("../services/anthropic").HashtagSuggestion[]
  >([]);
  const [isLoadingHashtags, setIsLoadingHashtags] = useState(false);
  const hashtagDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI settings state
  const [enableHashtagSuggestions, setEnableHashtagSuggestions] =
    useState(false);

  // Writing feedback state
  const [showWritingFeedback, setShowWritingFeedback] = useState(false);
  const [writingFeedback, setWritingFeedback] =
    useState<StyleMatchedWritingFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Check if we're in development mode
  const isDev = import.meta.env.DEV;

  // Reply control state
  const [replyPermission, setReplyPermission] =
    useState<ReplyPermission>("everyone");

  // Thread composer modal state
  const [showThreadComposer, setShowThreadComposer] = useState(false);

  // Multi-account posting state
  const [selectedPostingAccounts, setSelectedPostingAccounts] = useState<
    string[]
  >([]);
  const [accountPostStatuses, setAccountPostStatuses] = useState<
    AccountPostStatus[]
  >([]);
  const [showMultiAccountConfirm, setShowMultiAccountConfirm] = useState(false);
  const [pendingMultiAccountPost, setPendingMultiAccountPost] = useState<{
    posts: string[];
    media: UploadedMedia[];
  } | null>(null);
  const [lastPostContent, setLastPostContent] = useState<PostContent | null>(
    null,
  );

  // Load settings on mount
  useEffect(() => {
    const settings = getComposerSettings();
    setNumberingFormat(settings.numberingFormat);
    setShowSettings(settings.showSettingsPanel);
    setDelaySeconds(settings.defaultDelaySeconds);
    setNumberingPosition(settings.numberingPosition || "end");

    // Load AI settings and multi-account preferences from app preferences
    const loadAppPreferences = async () => {
      const prefs = await appPreferencesService.getPreferences();
      if (prefs?.aiSettings) {
        setAutoGenerateAltText(prefs.aiSettings.autoGenerateAltText);
        setEnableHashtagSuggestions(prefs.aiSettings.enableHashtagSuggestions);
      }
      // Load default posting accounts if set
      if (prefs?.multiAccountPosting?.defaultPostingAccounts?.length) {
        setSelectedPostingAccounts(
          prefs.multiAccountPosting.defaultPostingAccounts,
        );
      }
    };

    loadAppPreferences();
  }, []);

  // Handle shared content from Web Share Target API
  useEffect(() => {
    const sharedContent = parseReceivedShare(searchParams);
    if (sharedContent) {
      const composedText = composeFromSharedContent(sharedContent);
      if (composedText) {
        setText(composedText);
        // Clear the URL parameters after processing
        setSearchParams({}, { replace: true });
        // Log for debugging
        debug.log("[Composer] Received shared content:", sharedContent);
      }
    }
  }, [searchParams, setSearchParams]);

  // Save thread settings when they change
  useEffect(() => {
    saveComposerSettings({
      numberingFormat,
      showSettingsPanel: showSettings,
      defaultDelaySeconds: delaySeconds,
      numberingPosition,
    });
  }, [numberingFormat, showSettings, delaySeconds, numberingPosition]);

  // Save AI settings to app preferences when they change
  useEffect(() => {
    const saveAiSettings = async () => {
      // Check if we have loaded initial settings
      const prefs = await appPreferencesService.getPreferences();
      if (prefs) {
        await appPreferencesService.updatePreferences({
          aiSettings: {
            autoGenerateAltText,
            enableHashtagSuggestions,
          },
        });
      }
    };

    saveAiSettings();
  }, [autoGenerateAltText, enableHashtagSuggestions]);

  // Drafts are loaded via useDrafts hook

  // Initialize selected accounts with current account if none selected
  useEffect(() => {
    if (session?.did && selectedPostingAccounts.length === 0) {
      setSelectedPostingAccounts([session.did]);
    }
  }, [session?.did, selectedPostingAccounts.length]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      if (sendTimeout.current) {
        clearTimeout(sendTimeout.current);
      }
      if (hashtagDebounceTimerRef.current) {
        clearTimeout(hashtagDebounceTimerRef.current);
      }
      // Remove any body overflow styles
      document.body.style.overflow = "";
    };
  }, []);

  // Load hashtag suggestions with debounce
  useEffect(() => {
    if (hashtagDebounceTimerRef.current) {
      clearTimeout(hashtagDebounceTimerRef.current);
    }

    // Don't suggest hashtags if feature is disabled or text is too short
    if (!enableHashtagSuggestions || text.length < 20) {
      setShowHashtagSuggestions(false);
      setHashtagSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingHashtags(true);
      try {
        const anthropicService = await loadAnthropicService();
        const existingTags = text.match(/#[a-zA-Z0-9]+/g) || [];
        const result = await anthropicService.suggestHashtags(
          text,
          existingTags.map((tag) => tag.slice(1)),
        );
        setHashtagSuggestions(result.hashtags);
        setShowHashtagSuggestions(result.hashtags.length > 0);
      } catch (error) {
        logger.error("Failed to load hashtag suggestions:", error);
        // Silently fail - don't show error to user
      } finally {
        setIsLoadingHashtags(false);
      }
    }, 1000); // 1 second debounce

    hashtagDebounceTimerRef.current = timer;

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [text, enableHashtagSuggestions]);

  // Auto-split text into posts when it changes
  useEffect(() => {
    // Skip processing if we're in the middle of reordering
    if (isReorderingPosts) return;

    if (!text.trim()) {
      setPosts([]);
      setPostOrder([]);
      return;
    }

    // First check for manual splits (using --- as the delimiter)
    const manualSplitMarker = "\n---\n";
    if (text.includes(manualSplitMarker)) {
      // Split by manual markers first
      const manualSplits = text
        .split(manualSplitMarker)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const finalPosts: string[] = [];

      // Then check each manually split section for length
      for (const section of manualSplits) {
        if (section.length <= MAX_POST_LENGTH) {
          finalPosts.push(section);
        } else {
          // If a manual section is too long, auto-split it
          const words = section.split(" ");
          let currentPost = "";

          for (const word of words) {
            const testPost = currentPost ? `${currentPost} ${word}` : word;

            // Account for numbering in length calculation
            const format = NUMBERING_FORMATS.find(
              (f) => f.id === numberingFormat,
            );
            const numberingLength =
              format && numberingFormat !== "none"
                ? format.format(finalPosts.length + 1, 999).length + 2
                : 0; // +2 for space and safety margin

            if (testPost.length + numberingLength <= MAX_POST_LENGTH) {
              currentPost = testPost;
            } else {
              if (currentPost) {
                finalPosts.push(currentPost);
              }
              currentPost = word;
            }
          }

          if (currentPost) {
            finalPosts.push(currentPost);
          }
        }
      }

      setPosts(finalPosts);
      // Initialize post order if it doesn't match
      if (postOrder.length !== finalPosts.length) {
        setPostOrder(finalPosts.map((_, index) => index));
      }
    } else {
      // No manual splits, use auto-split logic
      const words = text.split(" ");
      const splitPosts: string[] = [];
      let currentPost = "";

      for (const word of words) {
        const testPost = currentPost ? `${currentPost} ${word}` : word;

        // Account for numbering in length calculation
        const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
        const numberingLength =
          format && numberingFormat !== "none"
            ? format.format(splitPosts.length + 1, 999).length + 2
            : 0; // +2 for space and safety margin

        if (testPost.length + numberingLength <= MAX_POST_LENGTH) {
          currentPost = testPost;
        } else {
          if (currentPost) {
            splitPosts.push(currentPost);
          }
          currentPost = word;
        }
      }

      if (currentPost) {
        splitPosts.push(currentPost);
      }

      setPosts(splitPosts);
      // Initialize post order if it doesn't match
      if (postOrder.length !== splitPosts.length) {
        setPostOrder(splitPosts.map((_, index) => index));
      }
    }
  }, [text, numberingFormat, isReorderingPosts]);

  const applyNumbering = useCallback(
    (posts: string[], order?: number[]): string[] => {
      if (numberingFormat === "none" || posts.length === 1) return posts;

      const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
      if (!format) return posts;

      // If we have a custom order, apply it
      const orderedPosts =
        order && order.length === posts.length
          ? order.map((i) => posts[i])
          : posts;

      return orderedPosts.map((post, index) => {
        const numbering = format.format(index + 1, orderedPosts.length);
        return numberingPosition === "beginning"
          ? `${numbering} ${post}`
          : `${post} ${numbering}`;
      });
    },
    [numberingFormat, numberingPosition],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(
        (item) => item.type.indexOf("image") !== -1,
      );

      if (imageItems.length === 0) return;

      // Prevent default paste behavior for images
      e.preventDefault();

      // Check if we already have a video
      const hasVideo = media.some((m) => m.type === "video");
      if (hasVideo) {
        setPostStatus({
          type: "error",
          message: "Cannot add images when a video is present",
        });
        return;
      }

      // Check if we've reached the image limit
      const currentImageCount = media.filter((m) => m.type === "image").length;
      if (currentImageCount >= MAX_IMAGES_PER_POST) {
        setPostStatus({
          type: "error",
          message: `Maximum ${MAX_IMAGES_PER_POST} images per post`,
        });
        return;
      }

      // Process each image
      for (const item of imageItems) {
        const blob = item.getAsFile();
        if (!blob) continue;

        // Convert blob to File object
        let file = new File(
          [blob],
          `pasted-image-${Date.now()}.${blob.type.split("/")[1]}`,
          { type: blob.type },
        );

        // Compress if needed
        if (file.size > MAX_IMAGE_SIZE && isCompressibleImage(file)) {
          try {
            setPostStatus({ type: "loading", message: "Compressing image..." });
            file = await compressImage(file);
            setPostStatus(null);
          } catch (error) {
            logger.error("Failed to compress image:", error);
            setPostStatus({
              type: "error",
              message: "Failed to compress image",
            });
            continue;
          }
        }

        // Add to media
        const previewUrl = URL.createObjectURL(blob);
        mediaUrlsRef.current.add(previewUrl);
        const newMedia: UploadedMedia = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: previewUrl,
          alt: "",
          type: "image",
        };

        setMedia((prev) => [...prev, newMedia]);
        setPostStatus({ type: "success", message: "Image pasted!" });
        setTimeout(() => setPostStatus({ type: "idle" }), 2000);

        // Auto-generate alt text if enabled
        if (autoGenerateAltText && autoGenerateAltTextRef.current) {
          setTimeout(() => {
            autoGenerateAltTextRef.current?.(newMedia.id);
          }, 100);
        }

        // Stop if we've reached the limit
        if (
          media.filter((m) => m.type === "image").length + 1 >=
          MAX_IMAGES_PER_POST
        ) {
          break;
        }
      }
    },
    [media, autoGenerateAltText],
  );

  const handleMediaSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      // Check if we already have a video
      const hasVideo = media.some((m) => m.type === "video");

      const validFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isVideo =
          file.type.startsWith("video/") ||
          SUPPORTED_VIDEO_FORMATS.some((format) =>
            file.name.toLowerCase().endsWith(format),
          );

        if (!isImage && !isVideo) {
          setPostStatus({
            type: "error",
            message: `${file.name} is not a supported media file`,
          });
          return false;
        }

        if (isVideo && hasVideo) {
          setPostStatus({
            type: "error",
            message: "Only one video per post is allowed",
          });
          return false;
        }

        if (isVideo && media.length > 0) {
          setPostStatus({
            type: "error",
            message: "Cannot mix videos with images",
          });
          return false;
        }

        if (isImage && hasVideo) {
          setPostStatus({
            type: "error",
            message: "Cannot add images when a video is present",
          });
          return false;
        }

        // Images will be compressed if needed, so don't reject them

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          setPostStatus({
            type: "error",
            message: `${file.name} is too large (max 500MB for videos)`,
          });
          return false;
        }

        return true;
      });

      // Process each file, converting GIFs to videos if needed (dev only)
      for (const file of validFiles) {
        if (isDev && isGifFile(file)) {
          try {
            setPostStatus({
              type: "posting",
              message: "Converting GIF to video...",
            });

            // Convert file to data URL for server
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            // Use server endpoint to convert GIF
            const response = await fetch(
              "http://localhost:3002/api/convert-gif",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ gifUrl: dataUrl }),
              },
            );

            if (!response.ok) {
              throw new Error("Failed to convert GIF");
            }

            const videoBlob = await response.blob();

            // Check converted size
            if (videoBlob.size > MAX_VIDEO_SIZE) {
              setPostStatus({
                type: "error",
                message: `Converted video is too large (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 500MB.`,
              });
              setTimeout(() => setPostStatus({ type: "idle" }), 3000);
              continue;
            }

            const videoFile = new File(
              [videoBlob],
              file.name.replace(".gif", ".mp4"),
              { type: "video/mp4" },
            );
            logger.log(
              "Created video file from GIF:",
              videoFile.name,
              "size:",
              videoFile.size,
              "type:",
              videoFile.type,
            );

            // Check video duration
            try {
              const duration = await getVideoDuration(videoFile);
              if (duration > MAX_VIDEO_DURATION) {
                setPostStatus({
                  type: "error",
                  message: `Converted video duration (${Math.round(duration)}s) exceeds maximum of ${MAX_VIDEO_DURATION} seconds (3 minutes)`,
                });
                setTimeout(() => setPostStatus({ type: "idle" }), 3000);
                continue;
              }
            } catch (error) {
              logger.error("Failed to get video duration:", error);
              setPostStatus({
                type: "error",
                message: "Failed to validate video duration",
              });
              setTimeout(() => setPostStatus({ type: "idle" }), 3000);
              continue;
            }

            const previewUrl = URL.createObjectURL(videoBlob);
            mediaUrlsRef.current.add(previewUrl);
            const newMedia: UploadedMedia = {
              id: Math.random().toString(36).substr(2, 9),
              file: videoFile,
              preview: previewUrl,
              alt: "",
              type: "video",
            };
            logger.log("Created media object with type:", newMedia.type);

            setMedia((prev) => [...prev, newMedia]);
            setPostStatus({
              type: "success",
              message: "GIF converted to video!",
            });
            setTimeout(() => setPostStatus({ type: "idle" }), 2000);
          } catch (error) {
            logger.error("GIF conversion failed:", error);
            setPostStatus({
              type: "error",
              message: "Failed to convert GIF. Using static image.",
            });

            // Fall back to static image
            let processedFile = file;

            // Compress if needed
            if (file.size > MAX_IMAGE_SIZE && isCompressibleImage(file)) {
              try {
                processedFile = await compressImage(file);
              } catch (error) {
                logger.error("Failed to compress GIF fallback:", error);
              }
            }

            const previewUrl = URL.createObjectURL(processedFile);
            mediaUrlsRef.current.add(previewUrl);
            const newMedia: UploadedMedia = {
              id: Math.random().toString(36).substr(2, 9),
              file: processedFile,
              preview: previewUrl,
              alt: "",
              type: "image",
            };
            setMedia((prev) => [...prev, newMedia]);
          }
        } else {
          // Handle regular images and videos
          let processedFile = file;

          // Compress image if needed
          if (
            !file.type.startsWith("video/") &&
            file.size > MAX_IMAGE_SIZE &&
            isCompressibleImage(file)
          ) {
            try {
              setPostStatus({
                type: "loading",
                message: `Compressing ${file.name}...`,
              });
              processedFile = await compressImage(file);
              setPostStatus({ type: "success", message: "Image compressed!" });
              setTimeout(() => setPostStatus(null), 2000);
            } catch (error) {
              logger.error("Failed to compress image:", error);
              // Continue with original file if compression fails
            }
          }

          const isVideo =
            processedFile.type.startsWith("video/") ||
            SUPPORTED_VIDEO_FORMATS.some((format) =>
              processedFile.name.toLowerCase().endsWith(format),
            );

          // Check video duration if it's a video
          if (isVideo) {
            try {
              const duration = await getVideoDuration(processedFile);
              if (duration > MAX_VIDEO_DURATION) {
                setPostStatus({
                  type: "error",
                  message: `Video duration (${Math.round(duration)}s) exceeds maximum of ${MAX_VIDEO_DURATION} seconds (3 minutes)`,
                });
                setTimeout(() => setPostStatus({ type: "idle" }), 3000);
                continue;
              }
            } catch (error) {
              logger.error("Failed to get video duration:", error);
              setPostStatus({
                type: "error",
                message: "Failed to validate video duration",
              });
              setTimeout(() => setPostStatus({ type: "idle" }), 3000);
              continue;
            }
          }

          const previewUrl = URL.createObjectURL(processedFile);
          mediaUrlsRef.current.add(previewUrl);
          const newMedia: UploadedMedia = {
            id: Math.random().toString(36).substr(2, 9),
            file: processedFile,
            preview: previewUrl,
            alt: "",
            type: isVideo ? "video" : "image",
          };
          setMedia((prev) => [...prev, newMedia]);

          // Auto-generate alt text if enabled and it's an image
          if (
            autoGenerateAltText &&
            newMedia.type === "image" &&
            autoGenerateAltTextRef.current
          ) {
            setTimeout(() => {
              autoGenerateAltTextRef.current?.(newMedia.id);
            }, 100);
          }
        }
      }

      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [media, autoGenerateAltText, isDev],
  );

  const removeMedia = useCallback(
    (id: string) => {
      setMedia((prev) => {
        const removed = prev.find((m) => m.id === id);
        if (removed) {
          URL.revokeObjectURL(removed.preview);
          mediaUrlsRef.current.delete(removed.preview);

          // If removing a video, cancel any active upload
          if (removed.type === "video" && videoUploadManager.isUploading) {
            videoUploadManager.cancelUpload();
          }
        }
        return prev.filter((m) => m.id !== id);
      });
    },
    [videoUploadManager],
  );

  const updateMediaAlt = useCallback((id: string, alt: string) => {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt } : m)));
  }, []);

  const autoGenerateAltTextForMedia = useCallback(
    async (mediaId: string) => {
      const mediaItem = media.find((m) => m.id === mediaId);
      if (!mediaItem || mediaItem.type !== "image") return;

      setGeneratingAltTextFor(mediaId);

      try {
        const anthropicService = await loadAnthropicService();
        const altText = await anthropicService.generateAltText(
          mediaItem.preview,
        );
        updateMediaAlt(mediaId, altText);
        setGeneratingAltTextFor(null);
        debug.log("Alt text generated successfully", {
          mediaId,
          altTextLength: altText.length,
        });
      } catch (error) {
        logger.error("Failed to generate alt text:", error);
        debug.error("Alt text generation failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          mediaId,
          hasApiKey: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
        });
        setGeneratingAltTextFor(null);

        // Show more specific error message
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to generate alt text";
        setPostStatus({ type: "error", message: errorMessage });
        setTimeout(() => setPostStatus(null), 3000);
      }
    },
    [media, updateMediaAlt],
  );

  // Store the function in a ref so it can be used in other callbacks
  useEffect(() => {
    autoGenerateAltTextRef.current = autoGenerateAltTextForMedia;
  }, [autoGenerateAltTextForMedia]);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, media: UploadedMedia) => {
      setDraggedMedia(media);
      e.dataTransfer.effectAllowed = "move";
      // Add visual feedback
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedMedia(null);
    setDragOverPostIndex(null);
    setDragOverMediaId(null);
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, postIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverPostIndex(postIndex);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverPostIndex(null);
    setDragOverMediaId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPostIndex: number) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent post reordering when dropping media

      if (!draggedMedia) return;

      // Update the media's post index
      setMedia((prev) =>
        prev.map((m) =>
          m.id === draggedMedia.id ? { ...m, postIndex: targetPostIndex } : m,
        ),
      );

      setDraggedMedia(null);
      setDragOverPostIndex(null);
    },
    [draggedMedia],
  );

  // Handlers for reordering within a post
  const handleMediaDragOver = useCallback(
    (e: React.DragEvent, targetMedia: UploadedMedia) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedMedia || draggedMedia.id === targetMedia.id) return;

      // Only allow reordering within the same post
      const draggedPostIndex = draggedMedia.postIndex ?? 0;
      const targetPostIndex = targetMedia.postIndex ?? 0;

      if (draggedPostIndex === targetPostIndex) {
        e.dataTransfer.dropEffect = "move";
        setDragOverMediaId(targetMedia.id);
      }
    },
    [draggedMedia],
  );

  const handleMediaDrop = useCallback(
    (e: React.DragEvent, targetMedia: UploadedMedia) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedMedia || draggedMedia.id === targetMedia.id) return;

      const draggedPostIndex = draggedMedia.postIndex ?? 0;
      const targetPostIndex = targetMedia.postIndex ?? 0;

      if (draggedPostIndex !== targetPostIndex) return;

      // Reorder media within the same post
      setMedia((prev) => {
        const newMedia = [...prev];
        const draggedIndex = newMedia.findIndex(
          (m) => m.id === draggedMedia.id,
        );
        const targetIndex = newMedia.findIndex((m) => m.id === targetMedia.id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Remove dragged item
          const [removed] = newMedia.splice(draggedIndex, 1);
          // Insert at new position
          newMedia.splice(targetIndex, 0, removed);
        }

        return newMedia;
      });

      setDraggedMedia(null);
      setDragOverMediaId(null);
    },
    [draggedMedia],
  );

  // Post reordering handlers
  const handlePostDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedPostIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Add visual feedback
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [],
  );

  const handlePostDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedPostIndex(null);
    setDragOverPostOrderIndex(null);
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handlePostDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverPostOrderIndex(index);
    },
    [],
  );

  const handlePostDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();

      if (draggedPostIndex === null || draggedPostIndex === targetIndex) return;

      // Set flag FIRST to prevent post order reset
      setIsReorderingPosts(true);

      // Create new order array
      const currentOrder =
        postOrder.length > 0 ? postOrder : posts.map((_, i) => i);
      const newOrder = [...currentOrder];
      const [removed] = newOrder.splice(draggedPostIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      // Create reordered posts array
      const reorderedPosts = newOrder.map((i) => posts[i]);

      // Build a mapping from old post index to new post index
      const indexMap = new Map<number, number>();
      newOrder.forEach((oldIdx, newIdx) => {
        indexMap.set(oldIdx, newIdx);
      });

      // Update media postIndex values to match the new order
      setMedia((prev) =>
        prev.map((m) => ({
          ...m,
          postIndex: indexMap.get(m.postIndex ?? 0) ?? m.postIndex ?? 0,
        })),
      );

      // Update all state values together
      setPosts(reorderedPosts);
      setPostOrder(reorderedPosts.map((_, i) => i)); // Reset to sequential order since posts are already reordered

      // Reconstruct text with the new order
      const newText = reorderedPosts.join("\n---\n");
      setText(newText);

      setDraggedPostIndex(null);
      setDragOverPostOrderIndex(null);

      // Reset flag after React has processed the updates
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsReorderingPosts(false);
        }, 100);
      });
    },
    [draggedPostIndex, postOrder, posts],
  );

  const saveDraftHandler = useCallback(async () => {
    if (!text.trim()) {
      setPostStatus({ type: "error", message: "Cannot save empty draft" });
      return;
    }

    try {
      // Build composer state for draft API
      const composerState = {
        text,
        images:
          media
            .filter((m) => m.type === "image")
            .map((m) => ({
              uri: m.preview,
              altText: m.alt,
              mimeType: m.file.type || "image/jpeg",
            })) || undefined,
        videos:
          media
            .filter((m) => m.type === "video")
            .map((m) => ({
              uri: m.preview,
              mimeType: m.file.type || "video/mp4",
            })) || undefined,
      };

      // Create or update draft
      if (currentDraftId) {
        await updateDraftMutation.mutateAsync({
          draftId: currentDraftId,
          state: composerState,
        });
      } else {
        const newDraftId = await createDraftMutation.mutateAsync(composerState);
        setCurrentDraftId(newDraftId);
      }

      setPostStatus({ type: "success", message: "Draft saved!" });

      setTimeout(() => {
        setPostStatus({ type: "idle" });
      }, 2000);
    } catch (error) {
      console.error("Failed to save draft:", error);
      setPostStatus({
        type: "error",
        message: "Failed to save draft. Please try again.",
      });
    }
  }, [text, media, currentDraftId, createDraftMutation, updateDraftMutation]);

  const loadDraft = useCallback(
    async (draft: EnrichedDraft) => {
      try {
        setPostStatus({ type: "posting", message: "Loading draft..." });

        // Convert draft to composer state
        const composerState = await loadDraftMutation.mutateAsync(draft);

        setText(composerState.text);
        setCurrentDraftId(draft.id);
        setShowDrafts(false);

        // Clear existing media previews before setting new ones
        media.forEach((m) => {
          if (m.preview && !m.preview.startsWith("data:")) {
            URL.revokeObjectURL(m.preview);
            mediaUrlsRef.current.delete(m.preview);
          }
        });

        // Load images
        const loadedMedia: UploadedMedia[] = [];
        if (composerState.images) {
          for (const img of composerState.images) {
            if (img.uri) {
              const response = await fetch(img.uri);
              const blob = await response.blob();
              const filename = `draft-image-${Date.now()}.jpg`;
              const file = new File([blob], filename, {
                type: blob.type || "image/jpeg",
              });

              loadedMedia.push({
                id: Math.random().toString(36).substr(2, 9),
                file,
                preview: img.uri,
                alt: img.altText || "",
                type: "image",
              });
            }
          }
        }

        // Load videos
        if (composerState.videos) {
          for (const video of composerState.videos) {
            if (video.uri) {
              const response = await fetch(video.uri);
              const blob = await response.blob();
              const filename = `draft-video-${Date.now()}.mp4`;
              const file = new File([blob], filename, {
                type: blob.type || video.mimeType,
              });

              loadedMedia.push({
                id: Math.random().toString(36).substr(2, 9),
                file,
                preview: video.uri,
                alt: "",
                type: "video",
              });
            }
          }
        }

        setMedia(loadedMedia);
        setPostStatus({ type: "success", message: "Draft loaded!" });

        setTimeout(() => {
          setPostStatus({ type: "idle" });
        }, 1000);
      } catch (error) {
        console.error("Failed to load draft:", error);
        setPostStatus({
          type: "error",
          message: "Failed to load draft. Please try again.",
        });
      }
    },
    [media, loadDraftMutation],
  );

  const deleteDraftHandler = useCallback(
    async (id: string) => {
      try {
        await deleteDraftMutation.mutateAsync({ draftId: id });
        if (currentDraftId === id) {
          setCurrentDraftId(null);
        }
      } catch (error) {
        console.error("Failed to delete draft:", error);
        setPostStatus({
          type: "error",
          message: "Failed to delete draft. Please try again.",
        });
      }
    },
    [currentDraftId, deleteDraftMutation],
  );

  const cancelDelayedSend = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    if (sendTimeout.current) {
      clearTimeout(sendTimeout.current);
      sendTimeout.current = null;
    }
    setCountdown(null);
    setPendingPost(null);
    setIsPosting(false);
    setPostStatus({ type: "idle" });
  }, []);

  const executePost = async (
    postsToSend?: string[],
    mediaToSend?: UploadedMedia[],
  ) => {
    if (!agent) {
      logger.error("No agent available");
      setPostStatus({ type: "error", message: "Not logged in" });
      setIsPosting(false);
      return;
    }

    // Use passed data or fall back to pendingPost
    const originalPosts = postsToSend || pendingPost?.posts || [];
    const originalMedia = mediaToSend || pendingPost?.media || [];

    if (originalPosts.length === 0) {
      logger.error("No posts to send");
      setPostStatus({ type: "error", message: "No content to post" });
      setIsPosting(false);
      return;
    }

    // Clear countdown state
    setCountdown(null);

    const numberedPosts = applyNumbering(originalPosts, postOrder);

    try {
      setPostStatus({ type: "posting", message: "Creating thread..." });

      // Prepare media for each post - need to map original indices to reordered indices
      const postMediaMap = new Map<
        number,
        Array<{
          data: Uint8Array;
          mimeType: string;
          alt?: string;
          type: "image" | "video";
          file?: File;
        }>
      >();

      for (const m of originalMedia) {
        const originalPostIndex = m.postIndex ?? 0; // Default to first post if not specified
        // Find the new position of this post after reordering
        const reorderedIndex =
          postOrder.length > 0
            ? postOrder.indexOf(originalPostIndex)
            : originalPostIndex;

        if (!postMediaMap.has(reorderedIndex)) {
          postMediaMap.set(reorderedIndex, []);
        }

        const mediaData = {
          data: new Uint8Array(await m.file.arrayBuffer()),
          mimeType: m.file.type,
          alt: m.alt,
          type: m.type,
          file: m.file, // Include file reference for upload manager
        };

        postMediaMap.get(reorderedIndex)!.push(mediaData);
      }

      let rootPost: { uri: string; cid: string } | undefined;
      let lastPost: { uri: string; cid: string } | undefined;

      for (let i = 0; i < numberedPosts.length; i++) {
        setPostStatus({
          type: "posting",
          message: `Posting ${i + 1}/${numberedPosts.length}...`,
        });

        let result: { uri: string; cid: string };
        const postMedia = postMediaMap.get(i) || [];

        // Create base post object with facet detection
        const rt = new RichText({ text: numberedPosts[i] });
        await rt.detectFacets(agent);

        const postData: any = {
          text: rt.text,
          facets: rt.facets,
        };

        // Add reply info for subsequent posts
        // root = first post in thread (stays constant)
        // parent = previous post in thread (changes each iteration)
        if (i > 0 && rootPost && lastPost) {
          postData.reply = {
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
            parent: {
              uri: lastPost.uri,
              cid: lastPost.cid,
            },
          };
        }

        // Add media if available for this post
        if (postMedia.length > 0) {
          logger.log(
            "Post media:",
            postMedia.map((m) => ({ type: m.type, mimeType: m.mimeType })),
          );
          const videoMedia = postMedia.find((m) => m.type === "video");

          if (videoMedia) {
            logger.log("Found video media, uploading as video");

            // Use the video upload manager to handle the upload with proper state management
            const videoBlob = await videoUploadManager.startUpload(
              videoMedia.data,
              videoMedia.mimeType,
              videoMedia.file?.name || "video.mp4",
              (progress) => {
                logger.log(`Upload progress: ${progress}%`);
              },
            );

            // Check if upload was cancelled or failed
            if (!videoBlob) {
              const error = videoUploadManager.uploadState.error;
              if (error) {
                throw new Error(error.message);
              }
              // Upload was cancelled
              throw new Error("Video upload was cancelled");
            }

            postData.embed = {
              $type: "app.bsky.embed.video",
              video: videoBlob.blob,
              aspectRatio: videoBlob.aspectRatio,
            };
          } else {
            logger.log("No video found, uploading as images");
            // Upload images with retry logic
            const images = await Promise.all(
              postMedia.map(async (img) => {
                const uploadResult = await uploadBlobWithRetry(
                  agent,
                  img.data,
                  {
                    encoding: img.mimeType,
                  },
                );
                return {
                  alt: img.alt || "",
                  image: uploadResult.data.blob,
                };
              }),
            );

            postData.embed = {
              $type: "app.bsky.embed.images",
              images,
            };
          }
        }

        // Add external link embed if no media and post contains a URL
        // For the first post, use cached linkPreview if available
        // For other posts, extract URL and fetch metadata dynamically
        if (!postData.embed && linkPreviewEnabled) {
          let metadata = null;
          const postText = numberedPosts[i];
          const postUrl = extractFirstLinkUrl(postText);

          if (i === 0 && linkPreview.metadata) {
            // Use cached metadata for first post
            metadata = linkPreview.metadata;
          } else if (postUrl) {
            // Fetch metadata for URLs in other posts
            try {
              logger.log(`Fetching link metadata for post ${i + 1}:`, postUrl);
              metadata = await fetchLinkMetadata(postUrl);
            } catch (metadataError) {
              logger.error(
                `Failed to fetch link metadata for post ${i + 1}:`,
                metadataError,
              );
            }
          }

          if (metadata) {
            logger.log("Adding external link embed:", metadata.url);

            const externalEmbed: {
              $type: string;
              external: {
                uri: string;
                title: string;
                description: string;
                thumb?: any;
              };
            } = {
              $type: "app.bsky.embed.external",
              external: {
                uri: metadata.url,
                title: metadata.title,
                description: metadata.description,
              },
            };

            // Upload thumbnail if available
            if (metadata.imageUrl) {
              try {
                // Fetch the image
                const imageResponse = await fetch(metadata.imageUrl);
                if (imageResponse.ok) {
                  const imageBlob = await imageResponse.blob();
                  const imageData = new Uint8Array(
                    await imageBlob.arrayBuffer(),
                  );

                  const uploadResult = await uploadBlobWithRetry(
                    agent,
                    imageData,
                    { encoding: imageBlob.type || "image/jpeg" },
                  );

                  externalEmbed.external.thumb = uploadResult.data.blob;
                  logger.log("Uploaded link preview thumbnail");
                }
              } catch (thumbError) {
                logger.error(
                  "Failed to upload link preview thumbnail:",
                  thumbError,
                );
                // Continue without thumbnail
              }
            }

            postData.embed = externalEmbed;
          }
        }

        result = await agent.post(postData);
        const currentPost = {
          uri: result.uri,
          cid: result.cid,
        };

        // First post becomes the root for all subsequent posts
        if (i === 0) {
          rootPost = currentPost;
        }
        lastPost = currentPost;

        // Create threadgate for the first post if reply permissions are set
        if (i === 0 && replyPermission !== "everyone") {
          try {
            const threadgateService = new ThreadgateService(agent);
            await threadgateService.createThreadgate(result.uri, {
              permission: replyPermission,
            });
            logger.log(
              "Threadgate created for post with permission:",
              replyPermission,
            );
          } catch (error) {
            logger.error("Failed to create threadgate:", error);
            // Don't fail the whole post if threadgate creation fails
          }
        }

        // Small delay between posts to avoid rate limiting
        if (i < numberedPosts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Construct the Bluesky URL for the thread
      const postUrl =
        rootPost && session?.handle
          ? `https://bsky.app/profile/${session.handle}/post/${rootPost.uri.split("/").pop()}`
          : undefined;

      setPostStatus({
        type: "success",
        message: "Thread posted!",
        postUrl,
      });

      setText("");
      setPosts([]);
      setPostOrder([]);
      setMedia([]);
      setCurrentDraftId(null);
      setPendingPost(null);
      setCountdown(null);
      setReplyPermission("everyone"); // Reset reply permission
      videoUploadManager.resetUpload(); // Reset video upload state
      setLinkPreviewEnabled(true); // Reset link preview state
      linkPreview.clearPreview();

      // Delete draft if it was loaded
      if (currentDraftId) {
        await deleteDraftMutation.mutateAsync({ draftId: currentDraftId });
        setCurrentDraftId(null);
      }

      // Reset status after 3 seconds
      setTimeout(() => {
        setPostStatus({ type: "idle" });
      }, 3000);
    } catch (error) {
      logger.error("Error posting thread:", error);
      setPostStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to post thread",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSend = async () => {
    if (!agent || posts.length === 0) return;

    // Check if posting to multiple accounts
    const isMultiAccountPost = selectedPostingAccounts.length > 1;
    const skipConfirmation =
      localStorage.getItem("shadowsky_skip_multi_account_confirm") === "true";

    if (isMultiAccountPost && !skipConfirmation) {
      // Show confirmation dialog
      setPendingMultiAccountPost({ posts, media });
      setShowMultiAccountConfirm(true);
      return;
    }

    // Proceed with posting
    await performSend(posts, media);
  };

  const performSend = async (
    postsToSend: string[],
    mediaToSend: UploadedMedia[],
  ) => {
    if (!agent) return;

    setPendingPost({ posts: postsToSend, media: mediaToSend });
    setIsPosting(true);

    // Check if multi-account posting
    const isMultiAccountPost = selectedPostingAccounts.length > 1;

    if (isMultiAccountPost) {
      // Multi-account posting - skip delay for simplicity
      setPostStatus({
        type: "posting",
        message: "Posting to multiple accounts...",
      });
      await executeMultiAccountPost(postsToSend, mediaToSend);
    } else if (delaySeconds > 0) {
      // Start delayed send
      setCountdown(delaySeconds);
      setPostStatus({
        type: "posting",
        message: `Sending in ${delaySeconds} seconds...`,
      });

      // Start countdown
      let timeLeft = delaySeconds;
      countdownInterval.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);

        if (timeLeft <= 0) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          setPostStatus({
            type: "posting",
            message: "Sending now...",
          });
        } else {
          setPostStatus({
            type: "posting",
            message: `Sending in ${timeLeft} second${timeLeft !== 1 ? "s" : ""}...`,
          });
        }
      }, 1000);

      // Schedule the actual send
      sendTimeout.current = setTimeout(async () => {
        await executePost(postsToSend, mediaToSend);
      }, delaySeconds * 1000);
    } else {
      // Send immediately (no delay)
      setPostStatus({ type: "posting", message: "Creating thread..." });
      await executePost(postsToSend, mediaToSend);
    }
  };

  const handleMultiAccountConfirm = async () => {
    setShowMultiAccountConfirm(false);
    if (pendingMultiAccountPost) {
      await performSend(
        pendingMultiAccountPost.posts,
        pendingMultiAccountPost.media,
      );
      setPendingMultiAccountPost(null);
    }
  };

  const handleMultiAccountCancel = () => {
    setShowMultiAccountConfirm(false);
    setPendingMultiAccountPost(null);
  };

  const executeMultiAccountPost = async (
    postsToSend?: string[],
    mediaToSend?: UploadedMedia[],
  ) => {
    if (!agent || !session?.did) {
      logger.error("No agent or session available");
      setPostStatus({ type: "error", message: "Not logged in" });
      setIsPosting(false);
      return;
    }

    const originalPosts = postsToSend || pendingPost?.posts || [];
    const originalMedia = mediaToSend || pendingPost?.media || [];

    if (originalPosts.length === 0) {
      logger.error("No posts to send");
      setPostStatus({ type: "error", message: "No content to post" });
      setIsPosting(false);
      return;
    }

    // Clear countdown state
    setCountdown(null);

    const numberedPosts = applyNumbering(originalPosts, postOrder);

    try {
      // For multi-account posting, we only support single posts (not threads) for now
      // This is a simplification - threads would require more complex logic
      if (numberedPosts.length > 1) {
        setPostStatus({
          type: "error",
          message:
            "Thread posting to multiple accounts is not yet supported. Please post a single post.",
        });
        setIsPosting(false);
        return;
      }

      // Prepare the post content
      const postContent: PostContent = {
        text: numberedPosts[0],
      };

      // Prepare media
      if (originalMedia.length > 0) {
        const mediaItems = await Promise.all(
          originalMedia.map(async (m) => ({
            data: new Uint8Array(await m.file.arrayBuffer()),
            mimeType: m.file.type,
            alt: m.alt,
            type: m.type,
          })),
        );
        postContent.media = mediaItems;
      }

      // Add external embed if link preview enabled
      if (
        !postContent.media?.length &&
        linkPreviewEnabled &&
        linkPreview.metadata
      ) {
        const metadata = linkPreview.metadata;
        let thumbData: Uint8Array | undefined;
        let thumbMimeType: string | undefined;

        if (metadata.imageUrl) {
          try {
            const imageResponse = await fetch(metadata.imageUrl);
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              thumbData = new Uint8Array(await imageBlob.arrayBuffer());
              thumbMimeType = imageBlob.type || "image/jpeg";
            }
          } catch {
            // Continue without thumbnail
          }
        }

        postContent.embed = {
          type: "external",
          uri: metadata.url,
          title: metadata.title,
          description: metadata.description,
          thumbData,
          thumbMimeType,
        };
      }

      // Store for retry purposes
      setLastPostContent(postContent);

      // Initialize progress
      const initialStatuses: AccountPostStatus[] = selectedPostingAccounts.map(
        (did) => ({
          did,
          status: "pending" as const,
        }),
      );
      setAccountPostStatuses(initialStatuses);

      // Post to all selected accounts
      const results = await postToMultipleAccounts(
        selectedPostingAccounts,
        postContent,
        agent,
        session.did,
        (progress: MultiPostProgress[]) => {
          setAccountPostStatuses(
            progress.map((p) => ({
              did: p.did,
              status: p.status,
              error: p.error,
              postUrl: p.postUrl,
            })),
          );
        },
      );

      // Check results
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        // All succeeded
        const postUrl = results.find((r) => r.did === session.did)?.postUrl;
        setPostStatus({
          type: "success",
          message: `Posted to ${successCount} account${successCount > 1 ? "s" : ""}!`,
          postUrl,
        });

        // Reset form
        setText("");
        setPosts([]);
        setPostOrder([]);
        setMedia([]);
        setCurrentDraftId(null);
        setPendingPost(null);
        setCountdown(null);
        setReplyPermission("everyone");
        videoUploadManager.resetUpload();
        setLinkPreviewEnabled(true);
        linkPreview.clearPreview();
        setAccountPostStatuses([]);
        setLastPostContent(null);

        // Delete draft if it was loaded
        if (currentDraftId) {
          await deleteDraftMutation.mutateAsync({ draftId: currentDraftId });
          setCurrentDraftId(null);
        }

        // Reset status after 3 seconds
        setTimeout(() => {
          setPostStatus({ type: "idle" });
        }, 3000);
      } else if (successCount === 0) {
        // All failed
        setPostStatus({
          type: "error",
          message: `Failed to post to all ${failCount} accounts`,
        });
      } else {
        // Partial success
        const postUrl = results.find(
          (r) => r.success && r.did === session.did,
        )?.postUrl;
        setPostStatus({
          type: "success",
          message: `Posted to ${successCount}/${selectedPostingAccounts.length} accounts. ${failCount} failed.`,
          postUrl,
        });

        // Keep the form content in case user wants to retry the failed ones
      }
    } catch (error) {
      logger.error("Error in multi-account posting:", error);
      setPostStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to post",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleRetryAccount = async (did: string) => {
    if (!agent || !session?.did || !lastPostContent) return;

    // Update status to posting
    setAccountPostStatuses((prev) =>
      prev.map((s) =>
        s.did === did
          ? { ...s, status: "posting" as const, error: undefined }
          : s,
      ),
    );

    const result = await retryPostToAccount(
      did,
      lastPostContent,
      agent,
      session.did,
    );

    // Update status
    setAccountPostStatuses((prev) =>
      prev.map((s) =>
        s.did === did
          ? {
              ...s,
              status: result.success
                ? ("success" as const)
                : ("error" as const),
              error: result.error,
              postUrl: result.postUrl,
            }
          : s,
      ),
    );

    // Check if all are now successful
    const allStatuses = accountPostStatuses.map((s) =>
      s.did === did
        ? { ...s, status: result.success ? "success" : "error" }
        : s,
    );
    const allSuccessful = allStatuses.every((s) => s.status === "success");

    if (allSuccessful) {
      // Clear form since all posts succeeded
      setText("");
      setPosts([]);
      setPostOrder([]);
      setMedia([]);
      setCurrentDraftId(null);
      setPendingPost(null);
      setAccountPostStatuses([]);
      setLastPostContent(null);
      setPostStatus({
        type: "success",
        message: "All posts successful!",
      });
      setTimeout(() => setPostStatus({ type: "idle" }), 3000);
    }
  };

  const displayPosts = applyNumbering(posts, postOrder);

  // Handle GIF selection
  const handleSelectGif = useCallback(async (gifUrl: string) => {
    try {
      setPostStatus({ type: "posting", message: "Converting GIF to video..." });

      // Use server endpoint to fetch and convert GIF
      const response = await fetch("http://localhost:3002/api/convert-gif", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gifUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || "Failed to convert GIF");
      }

      const videoBlob = await response.blob();
      logger.log(
        "Received converted video, size:",
        videoBlob.size,
        "type:",
        videoBlob.type,
      );

      // Check if converted video is within size limit
      if (videoBlob.size > MAX_VIDEO_SIZE) {
        setPostStatus({
          type: "error",
          message: `Converted video is too large (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 500MB.`,
        });
        setTimeout(() => setPostStatus({ type: "idle" }), 3000);
        return;
      }

      const fileName = "giphy.mp4";
      const mediaType: "image" | "video" = "video";

      // Create a File object from the blob
      const file = new File([videoBlob], fileName, {
        type: mediaType === "video" ? "video/mp4" : "image/gif",
      });

      // Add to media
      const previewUrl = URL.createObjectURL(videoBlob);
      mediaUrlsRef.current.add(previewUrl);
      const newMedia: UploadedMedia = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: previewUrl,
        alt: "GIF from Giphy",
        type: mediaType,
      };

      setMedia((prev) => [...prev, newMedia]);
      setPostStatus({
        type: "success",
        message:
          mediaType === "video" ? "GIF converted to video!" : "GIF added!",
      });
      setTimeout(() => setPostStatus({ type: "idle" }), 2000);
    } catch (error) {
      logger.error("Error adding GIF:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setPostStatus({
        type: "error",
        message: `Failed to add GIF: ${errorMessage}`,
      });
      setTimeout(() => setPostStatus({ type: "idle" }), 5000);
    }
  }, []);

  // Handle emoji selection
  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newText = text.substring(0, start) + emoji + text.substring(end);
        setText(newText);

        // Set cursor position after emoji
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
              start + emoji.length,
              start + emoji.length,
            );
          }
        }, 0);
      }
      setShowEmojiPicker(false);
    },
    [text],
  );

  // Handle manual thread split
  const insertThreadSplit = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const splitMarker = "\n---\n";
      const newText =
        text.substring(0, start) + splitMarker + text.substring(end);
      setText(newText);

      // Set cursor position after split marker
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            start + splitMarker.length,
            start + splitMarker.length,
          );
        }
      }, 0);
    }
  }, [text]);

  // Handle tone adjustment
  const handleToneAdjustment = useCallback(
    async (tone: ToneOption) => {
      if (!text.trim()) {
        setPostStatus({
          type: "error",
          message: "Please write some text first",
        });
        return;
      }

      setIsAdjustingTone(true);
      setSelectedTone(tone);

      try {
        const anthropicService = await loadAnthropicService();
        const result = await anthropicService.adjustTone(text, tone);
        setTonePreview(result.adjustedText);
        setShowTonePreview(true);
        setShowToneOptions(false);
        debug.log("Tone adjusted successfully", {
          tone,
          originalLength: text.length,
          adjustedLength: result.adjustedText.length,
        });
      } catch (error) {
        logger.error("Failed to adjust tone:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to adjust tone";
        setPostStatus({ type: "error", message: errorMessage });
        setSelectedTone(null);
      } finally {
        setIsAdjustingTone(false);
      }
    },
    [text, posts.length],
  );

  // Apply tone adjustment
  const applyToneAdjustment = useCallback(() => {
    if (tonePreview && selectedTone) {
      setText(tonePreview);
      setTonePreview(null);
      setShowTonePreview(false);
      setSelectedTone(null);
      setPostStatus({ type: "success", message: "Tone adjusted!" });
      setTimeout(() => setPostStatus({ type: "idle" }), 2000);
    }
  }, [tonePreview, selectedTone]);

  // Cancel tone adjustment
  const cancelToneAdjustment = useCallback(() => {
    setTonePreview(null);
    setShowTonePreview(false);
    setSelectedTone(null);
  }, []);

  // Handle thread optimization (currently disabled)
  // const handleThreadOptimization = useCallback(async () => {
  //   if (!text.trim()) {
  //     setPostStatus({
  //       type: "error",
  //       message: "Please write some text to optimize",
  //     });
  //     return;
  //   }

  //   // Track optimization request
  //   analytics.trackEvent({
  //     category: "composer",
  //     action: "thread_optimization_requested",
  //     custom_parameters: {
  //       text_length: text.length,
  //       current_posts: posts.length,
  //     },
  //   });

  //   try {
  //     const result = await optimizeThread(text, MAX_POST_LENGTH);
  //     setThreadOptimizationResult(result);
  //     setShowThreadPreview(true);
  //     debug.log("Thread optimized successfully", {
  //       segmentCount: result.segments.length,
  //       format: result.suggestedFormat,
  //     });

  //     // Track successful optimization
  //     analytics.trackEvent({
  //       category: "composer",
  //       action: "thread_optimization_success",
  //       label: result.suggestedFormat,
  //       custom_parameters: {
  //         original_length: text.length,
  //         segments_count: result.segments.length,
  //         suggested_format: result.suggestedFormat,
  //       },
  //     });
  //   } catch (error) {
  //     logger.error("Failed to optimize thread:", error);
  //     const errorMessage =
  //       error instanceof Error ? error.message : "Failed to optimize thread";
  //     setPostStatus({ type: "error", message: errorMessage });

  //     // Track optimization error
  //     analytics.trackEvent({
  //       category: "composer",
  //       action: "thread_optimization_error",
  //       custom_parameters: {
  //         error_message: errorMessage,
  //       },
  //     });
  //   }
  // }, [text, posts.length]);

  // Apply thread optimization
  const applyThreadOptimization = useCallback(() => {
    if (threadOptimizationResult) {
      // Create the optimized text with manual splits
      const optimizedText = threadOptimizationResult.segments
        .map((s) => s.text)
        .join("\n---\n");

      setText(optimizedText);
      // Update numbering format to match suggestion
      setNumberingFormat(threadOptimizationResult.suggestedFormat);

      setThreadOptimizationResult(null);
      setShowThreadPreview(false);

      setPostStatus({
        type: "success",
        message: `Thread optimized into ${threadOptimizationResult.segments.length} posts!`,
      });
      setTimeout(() => setPostStatus({ type: "idle" }), 2000);
    }
  }, [threadOptimizationResult]);

  // Cancel thread optimization
  const cancelThreadOptimization = useCallback(() => {
    setThreadOptimizationResult(null);
    setShowThreadPreview(false);
  }, []);

  // Handle hashtag application
  const applyHashtag = useCallback(
    (tag: string) => {
      // Add hashtag at the end of the text with proper spacing
      const currentText = text.trim();
      const hashtag = `#${tag}`;

      // Check if hashtag already exists
      if (currentText.includes(hashtag)) {
        return;
      }

      // Add space if text doesn't end with space or newline
      const spacer = currentText && !currentText.match(/[\s\n]$/) ? " " : "";
      setText(currentText + spacer + hashtag);
    },
    [text],
  );

  // Handle writing feedback request
  const handleWritingFeedback = useCallback(async () => {
    debug.log("Writing feedback button clicked", { text, agent });
    if (!text.trim()) {
      setPostStatus({
        type: "error",
        message: "Please write some text to get feedback",
      });
      return;
    }

    setIsLoadingFeedback(true);

    try {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      const anthropicService = await loadAnthropicService();
      const feedback = await anthropicService.getStyleMatchedWritingFeedback(
        text,
        agent,
      );
      setWritingFeedback(feedback);
      setShowWritingFeedback(true);
      debug.log("Writing feedback received", feedback);
    } catch (error) {
      logger.error("Failed to get writing feedback:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get feedback";
      setPostStatus({ type: "error", message: errorMessage });
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [text, agent]);

  // Apply corrected version from writing feedback
  const applyCorrectedVersion = useCallback(() => {
    if (writingFeedback) {
      setText(writingFeedback.correctedVersion.text);
      setShowWritingFeedback(false);
      setWritingFeedback(null);
    }
  }, [writingFeedback]);

  // Apply enhanced version from writing feedback
  const applyEnhancedVersion = useCallback(() => {
    if (writingFeedback) {
      setText(writingFeedback.enhancedVersion.text);
      setShowWritingFeedback(false);
      setWritingFeedback(null);
    }
  }, [writingFeedback]);

  // Track media URLs for cleanup
  useEffect(() => {
    media.forEach((m) => {
      if (m.preview && !m.preview.startsWith("data:")) {
        mediaUrlsRef.current.add(m.preview);
      }
    });
  }, [media]);

  // Cleanup all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      mediaUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      mediaUrlsRef.current.clear();
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <div className="asph-card mb-6 p-4 md:p-6">
        <div
          className="mb-3 flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm md:gap-4">
            {showSettings ? (
              <>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="numbering-format"
                    className="text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Format:
                  </label>
                  <select
                    id="numbering-format"
                    value={numberingFormat}
                    onChange={(e) =>
                      setNumberingFormat(
                        e.target.value as
                          | "none"
                          | "simple"
                          | "brackets"
                          | "thread"
                          | "dots",
                      )
                    }
                    className="rounded px-2 py-1 text-sm"
                    style={{
                      background: "var(--asph-bg-secondary)",
                      border: "1px solid var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                      outline: "none",
                    }}
                  >
                    {NUMBERING_FORMATS.map((format) => (
                      <option key={format.id} value={format.id}>
                        {format.name} {format.example && `(${format.example})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="numbering-position"
                    className="text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Position:
                  </label>
                  <select
                    id="numbering-position"
                    value={numberingPosition}
                    onChange={(e) =>
                      setNumberingPosition(
                        e.target.value as "beginning" | "end",
                      )
                    }
                    className="rounded px-2 py-1 text-sm"
                    style={{
                      background: "var(--asph-bg-secondary)",
                      border: "1px solid var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                      outline: "none",
                    }}
                  >
                    <option value="beginning">Beginning</option>
                    <option value="end">End</option>
                  </select>
                </div>

                {/* AI Settings */}
                <div
                  className="mt-2 border-t pt-2"
                  style={{ borderColor: "var(--asph-border-primary)" }}
                >
                  <AISettingsPanel
                    settings={{
                      autoGenerateAltText,
                      enableHashtagSuggestions,
                    }}
                    onChange={async (newSettings) => {
                      setAutoGenerateAltText(newSettings.autoGenerateAltText);
                      setEnableHashtagSuggestions(
                        newSettings.enableHashtagSuggestions,
                      );

                      // Save to app preferences
                      await appPreferencesService.updatePreferences({
                        aiSettings: newSettings,
                      });
                    }}
                    compact={true}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="send-delay"
                    className="text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Delay:
                  </label>
                  <input
                    id="send-delay"
                    type="number"
                    value={delaySeconds}
                    onChange={(e) =>
                      setDelaySeconds(
                        Math.max(
                          0,
                          Math.min(300, parseInt(e.target.value) || 0),
                        ),
                      )
                    }
                    min="0"
                    max="300"
                    className="w-16 rounded px-2 py-1 text-center text-sm"
                    style={{
                      background: "var(--asph-bg-secondary)",
                      border: "1px solid var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    sec
                  </span>
                </div>
              </>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {numberingFormat !== "none" &&
                  `${NUMBERING_FORMATS.find((f) => f.id === numberingFormat)?.name} • `}
                {numberingPosition === "beginning" ? "Start" : "End"} •
                {delaySeconds > 0 ? ` ${delaySeconds}s delay` : " Instant"}
                {autoGenerateAltText && " • Auto-alt"}
              </span>
            )}
          </div>

          <button
            className="touch-target-icon asph-button-secondary p-1.5"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Toggle settings"
          >
            <Settings size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="touch-target-sm asph-button-secondary flex items-center gap-2 px-4 py-2 text-sm font-medium"
              onClick={() => setShowThreadComposer(true)}
            >
              <MessageSquare size={16} />
              Create Thread
            </button>
            {/* Multi-account selector - only shows if multiple accounts */}
            <MultiAccountSelector
              selectedAccounts={selectedPostingAccounts}
              onSelectionChange={setSelectedPostingAccounts}
              disabled={isPosting}
              postStatuses={
                accountPostStatuses.length > 0 ? accountPostStatuses : undefined
              }
              onRetry={handleRetryAccount}
              currentAccountDid={session?.did}
            />
          </div>
          <button
            className="touch-target-sm asph-button-primary flex items-center gap-2 px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSend}
            disabled={posts.length === 0 || isPosting}
            aria-label={
              posts.length > 1
                ? `Post thread with ${posts.length} posts${media.some((m) => m.type === "image" && !m.alt) ? ". Warning: some images are missing alt text" : ""}`
                : `Post${media.some((m) => m.type === "image" && !m.alt) ? ". Warning: some images are missing alt text" : ""}`
            }
          >
            <Send size={20} aria-hidden="true" />
            {isPosting && countdown
              ? `Sending in ${countdown}s...`
              : isPosting
                ? "Posting..."
                : posts.length > 1
                  ? `Post Thread (${posts.length} posts)`
                  : selectedPostingAccounts.length > 1
                    ? `Post to ${selectedPostingAccounts.length} Accounts`
                    : "Post"}
          </button>
        </div>

        {/* Text Area with Link Preview and Hashtag Suggestions */}
        <Suspense
          fallback={
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader className="animate-spin" size={24} />
            </div>
          }
        >
          <ComposerTextArea
            text={text}
            onTextChange={setText}
            onPaste={handlePaste}
            isPosting={isPosting}
            textareaRef={textareaRef}
            linkPreviewEnabled={linkPreviewEnabled}
            linkPreview={{
              metadata: linkPreview.metadata,
              isLoading: linkPreview.isLoading,
              error: linkPreview.error,
              clearPreview: linkPreview.clearPreview,
            }}
            mediaCount={media.length}
            onLinkPreviewRemove={() => {
              setLinkPreviewEnabled(false);
              linkPreview.clearPreview();
            }}
            showHashtagSuggestions={showHashtagSuggestions}
            hashtagSuggestions={hashtagSuggestions}
            isLoadingHashtags={isLoadingHashtags}
            onApplyHashtag={applyHashtag}
          />
        </Suspense>

        <div className="mb-3 mt-3 flex items-center gap-2">
          <button
            className="touch-target-sm asph-button-secondary flex items-center gap-2 px-3 py-2 text-sm"
            onClick={saveDraftHandler}
            disabled={!text.trim()}
          >
            <Save size={14} />
            <span className="hidden sm:inline">
              {currentDraftId ? "Update" : "Save Draft"}
            </span>
          </button>

          <button
            className="touch-target-sm asph-button-secondary flex items-center gap-2 px-3 py-2 text-sm"
            onClick={() => setShowDrafts(!showDrafts)}
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Drafts ({drafts.length})</span>
          </button>

          {currentDraftId && (
            <button
              className="touch-target-sm asph-button-secondary p-2 text-sm"
              onClick={() => {
                // Clear everything to start a new draft
                setText("");
                setPosts([]);
                setPostOrder([]);
                // Clean up media previews
                media.forEach((m) => {
                  URL.revokeObjectURL(m.preview);
                  mediaUrlsRef.current.delete(m.preview);
                });
                setMedia([]);
                setCurrentDraftId(null);
                videoUploadManager.resetUpload(); // Reset video upload state
                setPostStatus({
                  type: "success",
                  message: "Ready for new draft",
                });
                setTimeout(() => setPostStatus({ type: "idle" }), 2000);
              }}
              title="New Draft"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span style={{ color: "var(--asph-text-secondary)" }}>
              {text.length} <span className="hidden sm:inline">characters</span>
            </span>
            {posts.length > 1 && (
              <>
                <span style={{ color: "var(--asph-text-tertiary)" }}>•</span>
                <span
                  className="flex items-center gap-1.5 font-medium"
                  style={{ color: "var(--asph-primary)" }}
                >
                  <Split size={14} />
                  {posts.length} posts
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <div className="group relative">
              <button
                className="touch-target-sm asph-button-secondary flex items-center gap-2"
                onClick={insertThreadSplit}
                disabled={isPosting}
                aria-label="Insert thread split"
              >
                <Plus size={20} />
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Split Thread Here</div>
                  <div>Insert manual break (---)</div>
                  <div className="mt-1 text-gray-300">
                    Forces a new post at cursor
                  </div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <button
                className="touch-target-sm asph-button-secondary relative flex items-center gap-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.multiple = true;
                    fileInputRef.current.click();
                  }
                }}
                disabled={
                  isPosting ||
                  media.length >= MAX_IMAGES_PER_POST ||
                  media.some((m) => m.type === "video") ||
                  videoUploadManager.isUploading
                }
                aria-label="Add images"
              >
                <Image size={20} />
                {media.filter((m) => m.type === "image").length > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{ background: "var(--asph-primary)" }}
                  >
                    {media.filter((m) => m.type === "image").length}
                  </span>
                )}
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Add Images</div>
                  <div>Up to 4 images, max 1MB each</div>
                  <div className="mt-1 text-gray-300">
                    Tip: You can paste images from clipboard!
                  </div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <button
                className="touch-target-sm asph-button-secondary relative flex items-center gap-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept =
                      "video/*,.mp4,.mpeg,.webm,.mov";
                    fileInputRef.current.multiple = false;
                    fileInputRef.current.click();
                  }
                }}
                disabled={
                  isPosting ||
                  media.length > 0 ||
                  videoUploadManager.isUploading
                }
                aria-label="Add video"
              >
                <Video size={20} />
                {media.some((m) => m.type === "video") && (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{ background: "var(--asph-primary)" }}
                  >
                    1
                  </span>
                )}
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Add Video</div>
                  <div>1 video per post, max 500MB, 3 min</div>
                  <div className="mt-1 text-gray-300">
                    Processed on Bluesky servers
                  </div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>

            {isDev && (
              <div className="group relative">
                <button
                  className="touch-target-sm asph-button-secondary flex items-center gap-2"
                  onClick={() => setShowGiphySearch(true)}
                  disabled={
                    isPosting ||
                    media.length >= MAX_IMAGES_PER_POST ||
                    media.some((m) => m.type === "video")
                  }
                  aria-label="Search GIFs"
                >
                  <span className="text-sm font-bold">GIF</span>
                </button>
                <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                  <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                    <div className="mb-1 font-semibold">
                      Search GIFs (Dev Only)
                    </div>
                    <div>Powered by GIPHY</div>
                    <div className="mt-1 text-gray-300">
                      Requires local server
                    </div>
                    <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                  </div>
                </div>
              </div>
            )}

            <div className="group relative">
              <button
                className="touch-target-sm asph-button-secondary flex items-center gap-2"
                onClick={() => setShowEmojiPicker(true)}
                disabled={isPosting}
                aria-label="Add emoji"
              >
                <Smile size={20} />
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Add Emoji</div>
                  <div>Insert emoji at cursor</div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <button
                className={`touch-target asph-button-secondary flex items-center gap-2 ${selectedTone ? "ring-2 ring-blue-400" : ""}`}
                onClick={() => setShowToneOptions(!showToneOptions)}
                disabled={isPosting || isAdjustingTone}
                aria-label="Adjust tone"
              >
                <Wand2 size={20} />
                {selectedTone && (
                  <span className="hidden text-xs sm:inline">
                    {TONE_OPTIONS.find((t) => t.value === selectedTone)?.icon}
                  </span>
                )}
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Adjust Tone</div>
                  <div>AI-powered tone adjustment</div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <button
                className={`touch-target asph-button-secondary flex items-center gap-2 ${isLoadingFeedback ? "animate-pulse" : ""}`}
                onClick={handleWritingFeedback}
                disabled={isPosting || isLoadingFeedback || !text.trim()}
                aria-label="Get writing feedback"
              >
                <MessageSquare size={20} />
                <span className="hidden text-xs sm:inline">Feedback</span>
              </button>
              <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">
                  <div className="mb-1 font-semibold">Writing Feedback</div>
                  <div>Get AI feedback on your post</div>
                  <div className="mt-1 text-gray-300">
                    Check clarity, tone, and engagement
                  </div>
                  <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-gray-900"></div>
                </div>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleMediaSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* Reply Controls */}
        <div className="mt-4">
          <ReplyControls
            value={replyPermission}
            onChange={setReplyPermission}
            disabled={isPosting}
            compact
          />
        </div>
      </div>

      {/* Media Upload Section */}
      <Suspense fallback={null}>
        <ComposerMediaUpload
          media={media}
          posts={posts}
          isPosting={isPosting}
          onRemoveMedia={removeMedia}
          onUpdateAlt={updateMediaAlt}
          onAutoGenerateAlt={autoGenerateAltTextForMedia}
          draggedMedia={draggedMedia}
          dragOverMediaId={dragOverMediaId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onMediaDragOver={handleMediaDragOver}
          onMediaDrop={handleMediaDrop}
          onDragLeave={() => setDragOverMediaId(null)}
          generatingAltTextFor={generatingAltTextFor}
        />
      </Suspense>

      {posts.length > 0 && (
        <div className="mb-6">
          {posts.length > 1 && (
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Thread Preview
            </h3>
          )}
          <div className="space-y-3">
            {displayPosts.map((post, displayIndex) => {
              // Find the original index before reordering
              const originalIndex =
                postOrder.length > 0 ? postOrder[displayIndex] : displayIndex;
              const postMedia = media.filter(
                (m) => m.postIndex === originalIndex,
              );
              const hasMedia =
                postMedia.length > 0 ||
                (originalIndex === 0 &&
                  media.filter((m) => m.postIndex === undefined).length > 0);

              return (
                <div
                  key={originalIndex}
                  className={`asph-card relative cursor-move p-4 transition-all hover:shadow-sm ${
                    dragOverPostIndex === originalIndex
                      ? "ring-2 ring-blue-400"
                      : ""
                  } ${dragOverPostOrderIndex === displayIndex ? "border-t-4 border-blue-500" : ""}`}
                  draggable
                  onDragStart={(e) => handlePostDragStart(e, displayIndex)}
                  onDragEnd={handlePostDragEnd}
                  onDragOver={(e) => {
                    handleDragOver(e, originalIndex);
                    handlePostDragOver(e, displayIndex);
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    // Check if we're dragging media or a post
                    if (draggedMedia) {
                      handleDrop(e, originalIndex);
                    } else if (draggedPostIndex !== null) {
                      handlePostDrop(e, displayIndex);
                    }
                  }}
                >
                  {dragOverPostIndex === originalIndex && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-blue-50 bg-opacity-50">
                      <div className="font-medium text-blue-600">
                        Drop attachment here
                      </div>
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <GripVertical
                        size={16}
                        className="text-gray-400 dark:text-gray-500"
                      />
                      {posts.length > 1 && (
                        <span
                          className="font-semibold"
                          style={{ color: "var(--asph-primary)" }}
                        >
                          Post {displayIndex + 1}
                        </span>
                      )}
                      {hasMedia && (
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                          style={{
                            background: "var(--asph-bg-secondary)",
                            color: "var(--asph-text-secondary)",
                          }}
                        >
                          {media.some(
                            (m) =>
                              m.type === "video" &&
                              (m.postIndex === originalIndex ||
                                (originalIndex === 0 &&
                                  m.postIndex === undefined)),
                          ) ? (
                            <Video size={12} />
                          ) : (
                            <Image size={12} />
                          )}
                          {originalIndex === 0
                            ? media.filter(
                                (m) =>
                                  m.postIndex === undefined ||
                                  m.postIndex === 0,
                              ).length
                            : postMedia.length}
                        </span>
                      )}
                    </span>
                    <span
                      className="font-mono text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      {post.length}/{MAX_POST_LENGTH}
                    </span>
                  </div>
                  <div
                    className="mb-3 whitespace-pre-wrap break-words"
                    style={{
                      color: "var(--asph-text-primary)",
                      lineHeight: "1.5",
                    }}
                  >
                    {post}
                  </div>

                  {/* Show if this post was created by manual split */}
                  {text.includes("\n---\n") && originalIndex > 0 && (
                    <div
                      className="mb-2 flex items-center gap-2 text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      <Split size={14} />
                      <span>Manual split</span>
                    </div>
                  )}

                  {/* Link preview (if post has a URL and no media) */}
                  {!hasMedia && <InlinePostLinkPreview postText={post} />}

                  {/* Quote post preview (if post has a Bluesky URL) */}
                  <InlinePostQuotePreview postText={post} />

                  {/* Show attachments for this post */}
                  {(originalIndex === 0
                    ? media.filter(
                        (m) => m.postIndex === undefined || m.postIndex === 0,
                      )
                    : postMedia
                  ).length > 0 && (
                    <div
                      className="mt-3 grid grid-cols-4 gap-2 border-t pt-3"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    >
                      {(originalIndex === 0
                        ? media.filter(
                            (m) =>
                              m.postIndex === undefined || m.postIndex === 0,
                          )
                        : postMedia
                      ).map((m) => (
                        <div
                          key={m.id}
                          className={`relative cursor-move overflow-hidden rounded border ${dragOverMediaId === m.id ? "ring-2 ring-blue-400" : ""}`}
                          style={{
                            borderColor:
                              dragOverMediaId === m.id
                                ? "var(--asph-primary)"
                                : "var(--asph-border-primary)",
                            background: "var(--asph-bg-secondary)",
                            transition: "border-color 0.2s",
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, m)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleMediaDragOver(e, m)}
                          onDrop={(e) => handleMediaDrop(e, m)}
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
            })}
          </div>
        </div>
      )}

      {showDrafts && (
        <div className="asph-card mb-6 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Saved Drafts
            </h3>
            <button
              className="touch-target-icon asph-button-secondary p-2"
              onClick={() => {
                setShowDrafts(false);
              }}
            >
              <X size={20} />
            </button>
          </div>

          {showDrafts && (
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <p
                  className="py-8 text-center"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  No saved drafts
                </p>
              ) : (
                drafts.map((draftView) => {
                  const draft = draftView.draft;
                  const postCount = draft.posts?.length || 1;
                  const firstPost = draft.posts?.[0];
                  const draftText = firstPost?.text || "";
                  const draftTitle =
                    draftText.substring(0, 50) +
                    (draftText.length > 50 ? "..." : "");

                  // Count media from the draft
                  const imageCount = firstPost?.embedImages?.length || 0;
                  const videoCount = firstPost?.embedVideos?.length || 0;
                  const mediaCount = imageCount + videoCount;

                  return (
                    <div
                      key={draftView.id}
                      className="cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                        background: "var(--asph-bg-secondary)",
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <h4
                          className="font-medium"
                          style={{ color: "var(--asph-text-primary)" }}
                        >
                          {draftTitle}
                        </h4>
                        <button
                          className="touch-target-icon rounded p-1 text-red-600 hover:bg-red-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDraftHandler(draftView.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p
                        className="mb-2 line-clamp-2 text-sm"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        {draftText}
                      </p>
                      <div className="mb-2 flex items-center gap-3">
                        {postCount > 1 && (
                          <span
                            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                            style={{
                              background: "var(--asph-bg-tertiary)",
                              color: "var(--asph-primary)",
                            }}
                          >
                            <Split size={12} />
                            {postCount} posts
                          </span>
                        )}
                        {mediaCount > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                            style={{
                              background: "var(--asph-bg-tertiary)",
                              color: "var(--asph-text-secondary)",
                            }}
                          >
                            <Image size={12} />
                            {mediaCount} media
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          Updated{" "}
                          {new Date(draftView.updatedAt).toLocaleString()}
                        </span>
                        <button
                          className="touch-target-sm asph-button-secondary px-3 py-1 text-sm"
                          onClick={() => loadDraft(draftView)}
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-end gap-4">
        {postStatus && postStatus.type !== "idle" && (
          <div
            className={`flex w-full items-center gap-3 rounded-lg border p-4 ${
              postStatus.type === "posting"
                ? "border-blue-200 bg-blue-50"
                : postStatus.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            {postStatus.type === "posting" && (
              <Loader className="animate-spin text-blue-600" size={16} />
            )}
            {postStatus.type === "success" && (
              <CheckCircle className="text-green-600" size={16} />
            )}
            {postStatus.type === "error" && (
              <AlertCircle className="text-red-600" size={16} />
            )}
            {postStatus.type === "success" && postStatus.postUrl ? (
              <a
                href={postStatus.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center gap-1 text-sm text-green-700 hover:underline"
              >
                {postStatus.message}
                <ExternalLink size={12} />
              </a>
            ) : (
              <span
                className={`flex-1 text-sm ${
                  postStatus.type === "posting"
                    ? "text-blue-700"
                    : postStatus.type === "success"
                      ? "text-green-700"
                      : "text-red-700"
                }`}
              >
                {postStatus.message}
              </span>
            )}
            {postStatus.type === "posting" && countdown && (
              <button
                className="touch-target-sm flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                onClick={cancelDelayedSend}
              >
                <Undo size={14} />
                Undo
              </button>
            )}
          </div>
        )}

        {videoUploadManager.uploadState.uploadId && (
          <UploadProgressBar
            uploadId={videoUploadManager.uploadState.uploadId}
            fileName={videoUploadManager.uploadState.fileName}
            onRetry={() => videoUploadManager.retryUpload()}
            onCancel={() => videoUploadManager.cancelUpload()}
          />
        )}
      </div>

      {/* Lazy-loaded modals (Emoji, Giphy, AI features) */}
      <Suspense fallback={null}>
        <ComposerModals
          // Emoji picker
          showEmojiPicker={showEmojiPicker}
          onSelectEmoji={handleSelectEmoji}
          onCloseEmojiPicker={() => setShowEmojiPicker(false)}
          // Giphy search
          showGiphySearch={showGiphySearch}
          onSelectGif={handleSelectGif}
          onCloseGiphySearch={() => setShowGiphySearch(false)}
          // AI features
          text={text}
          onTextChange={setText}
          showToneOptions={showToneOptions}
          onToggleToneOptions={() => setShowToneOptions(false)}
          selectedTone={selectedTone}
          isAdjustingTone={isAdjustingTone}
          tonePreview={tonePreview}
          showTonePreview={showTonePreview}
          onToneAdjustment={handleToneAdjustment}
          onApplyTone={applyToneAdjustment}
          onCancelTone={cancelToneAdjustment}
          threadOptimizationResult={threadOptimizationResult}
          showThreadPreview={showThreadPreview}
          onApplyThreadOptimization={applyThreadOptimization}
          onCancelThreadOptimization={cancelThreadOptimization}
          onNumberingFormatChange={setNumberingFormat}
          showWritingFeedback={showWritingFeedback}
          writingFeedback={writingFeedback}
          isLoadingFeedback={isLoadingFeedback}
          onRequestFeedback={handleWritingFeedback}
          onCloseFeedback={() => {
            setShowWritingFeedback(false);
            setWritingFeedback(null);
          }}
          onApplyCorrected={applyCorrectedVersion}
          onApplyEnhanced={applyEnhancedVersion}
        />
      </Suspense>

      {/* Thread Composer Modal */}
      <ThreadComposer
        isOpen={showThreadComposer}
        onClose={() => setShowThreadComposer(false)}
        onThreadPosted={() => {
          setPostStatus({ type: "success", message: "Thread posted!" });
          setTimeout(() => setPostStatus({ type: "idle" }), 3000);
        }}
      />

      {/* Multi-Account Confirmation Dialog */}
      <MultiAccountConfirmDialog
        isOpen={showMultiAccountConfirm}
        onClose={handleMultiAccountCancel}
        onConfirm={handleMultiAccountConfirm}
        selectedAccountDids={selectedPostingAccounts}
        postCount={posts.length}
        hasMedia={media.length > 0}
      />
    </div>
  );
}

/**
 * Link preview component for inline thread preview
 */
const InlinePostLinkPreview: React.FC<{ postText: string }> = ({
  postText,
}) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = extractFirstLinkUrl(postText);

  useEffect(() => {
    if (!url) {
      setMetadata(null);
      return;
    }

    let cancelled = false;
    const fetchMetadataAsync = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLinkMetadata(url);
        if (!cancelled) {
          setMetadata(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load preview");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchMetadataAsync, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
        style={{
          borderColor: "var(--asph-border-primary)",
          color: "var(--asph-text-secondary)",
        }}
      >
        <Loader size={14} className="animate-spin" />
        <span>Loading link preview...</span>
      </div>
    );
  }

  if (error || !metadata) {
    if (error) {
      return (
        <div
          className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
          style={{
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-tertiary)",
          }}
        >
          <Link size={14} />
          <span className="truncate">{url}</span>
        </div>
      );
    }
    return null;
  }

  let domain = "";
  try {
    domain = new URL(metadata.url).hostname.replace("www.", "");
  } catch {
    domain = metadata.url;
  }

  return (
    <div
      className="mt-2 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      {metadata.imageUrl && (
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${metadata.imageUrl})` }}
        />
      )}
      <div className="p-3">
        <div
          className="mb-1 text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          {domain}
        </div>
        <div
          className="line-clamp-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {metadata.title}
        </div>
        {metadata.description && (
          <div
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {metadata.description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Quote post preview component for inline thread preview
 */
const InlinePostQuotePreview: React.FC<{ postText: string }> = ({
  postText,
}) => {
  const { agent } = useAuth();
  const [quotedPost, setQuotedPost] = useState<AppBskyFeedDefs.PostView | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const bskyUrl = extractFirstBskyPostUrl(postText);

  useEffect(() => {
    if (!bskyUrl) {
      setQuotedPost(null);
      return;
    }

    let cancelled = false;
    const fetchQuotedPost = async () => {
      const parsed = parseBskyUrl(bskyUrl);
      if (!parsed || !parsed.postId) return;

      if (!agent) return;

      setLoading(true);
      try {
        let did = parsed.did;
        if (!did && parsed.handle) {
          try {
            const profileResponse = await agent.getProfile({
              actor: parsed.handle,
            });
            did = profileResponse.data.did;
          } catch {
            return;
          }
        }

        if (!did) return;

        const uri = `at://${did}/app.bsky.feed.post/${parsed.postId}`;
        const response = await agent.app.bsky.feed.getPosts({ uris: [uri] });

        if (!cancelled && response.data.posts.length > 0) {
          setQuotedPost(response.data.posts[0]);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchQuotedPost, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bskyUrl, agent]);

  if (!bskyUrl) return null;

  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
        style={{
          borderColor: "var(--asph-border-primary)",
          color: "var(--asph-text-secondary)",
        }}
      >
        <Loader size={14} className="animate-spin" />
        <span>Loading quoted post...</span>
      </div>
    );
  }

  if (!quotedPost) return null;

  const record = quotedPost.record as { text?: string };
  return (
    <div
      className="mt-2 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs"
        style={{
          backgroundColor: "var(--asph-bg-tertiary)",
          borderBottom: "1px solid var(--asph-border-primary)",
          color: "var(--asph-text-secondary)",
        }}
      >
        <MessageCircle size={12} />
        <span>Quoted post</span>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <img
              src={quotedPost.author.avatar || "/default-avatar.svg"}
              alt=""
              className="h-5 w-5 cursor-pointer rounded-full"
            />
          </ProfileHoverCard>
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <span
              className="cursor-pointer text-sm font-semibold hover:underline"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {quotedPost.author.displayName || quotedPost.author.handle}
            </span>
          </ProfileHoverCard>
          <span
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            @{quotedPost.author.handle}
          </span>
        </div>
        <p
          className="line-clamp-3 text-sm"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {record?.text || ""}
        </p>
      </div>
    </div>
  );
};
