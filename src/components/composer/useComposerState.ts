/**
 * useComposerState - Custom hook for managing Composer state
 * Centralizes all state management for the Composer component
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLinkPreview } from "../../hooks/useLinkPreview";
import { useVideoUploadManager } from "../../hooks/useVideoUploadManager";
import { appPreferencesService } from "../../services/app-preferences-service";
import {
  getComposerSettings,
  getDrafts,
  saveComposerSettings,
  type ThreadDraft,
} from "../../services/drafts";
import {
  composeFromSharedContent,
  parseReceivedShare,
} from "../../services/share-service";
import { debug } from "../../shared/debug";
import type { ReplyPermission } from "../ReplyControls";
import {
  type ComposerAISettings,
  type HashtagSuggestion,
  type NumberingFormatType,
  type NumberingPosition,
  type PendingPost,
  type PostStatus,
  type ThreadProgress,
  type ToneOption,
  type UploadedMedia,
} from "./types";
import { splitTextIntoPosts } from "./utils";

let anthropicServiceModule: typeof import("../../services/anthropic") | null =
  null;

async function loadAnthropicService() {
  if (!anthropicServiceModule) {
    anthropicServiceModule = await import("../../services/anthropic");
  }
  return anthropicServiceModule;
}

export interface UseComposerStateReturn {
  // Text state
  text: string;
  setText: (text: string) => void;
  posts: string[];
  postOrder: number[];
  setPostOrder: (order: number[]) => void;

  // Settings
  numberingFormat: NumberingFormatType;
  setNumberingFormat: (format: NumberingFormatType) => void;
  numberingPosition: NumberingPosition;
  setNumberingPosition: (position: NumberingPosition) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  delaySeconds: number;
  setDelaySeconds: (seconds: number) => void;

  // Media state
  media: UploadedMedia[];
  setMedia: React.Dispatch<React.SetStateAction<UploadedMedia[]>>;
  mediaUrlsRef: React.MutableRefObject<Set<string>>;

  // Draft state
  currentDraftId: string | null;
  setCurrentDraftId: (id: string | null) => void;
  draftTitle: string;
  setDraftTitle: (title: string) => void;
  drafts: ThreadDraft[];
  setDrafts: (drafts: ThreadDraft[]) => void;
  showDrafts: boolean;
  setShowDrafts: (show: boolean) => void;

  // Posting state
  isPosting: boolean;
  setIsPosting: (posting: boolean) => void;
  postStatus: PostStatus | null;
  setPostStatus: (status: PostStatus | null) => void;
  countdown: number | null;
  setCountdown: (count: number | null) => void;
  pendingPost: PendingPost | null;
  setPendingPost: (post: PendingPost | null) => void;
  threadProgress: ThreadProgress | null;
  setThreadProgress: (progress: ThreadProgress | null) => void;

  // AI features state
  autoGenerateAltText: boolean;
  setAutoGenerateAltText: (enabled: boolean) => void;
  enableHashtagSuggestions: boolean;
  setEnableHashtagSuggestions: (enabled: boolean) => void;
  selectedTone: ToneOption | null;
  setSelectedTone: (tone: ToneOption | null) => void;
  isAdjustingTone: boolean;
  setIsAdjustingTone: (adjusting: boolean) => void;
  tonePreview: string | null;
  setTonePreview: (preview: string | null) => void;
  showTonePreview: boolean;
  setShowTonePreview: (show: boolean) => void;
  showToneOptions: boolean;
  setShowToneOptions: (show: boolean) => void;

  // Hashtag suggestions
  showHashtagSuggestions: boolean;
  setShowHashtagSuggestions: (show: boolean) => void;
  hashtagSuggestions: HashtagSuggestion[];
  setHashtagSuggestions: (suggestions: HashtagSuggestion[]) => void;
  isLoadingHashtags: boolean;
  setIsLoadingHashtags: (loading: boolean) => void;

  // Writing feedback
  showWritingFeedback: boolean;
  setShowWritingFeedback: (show: boolean) => void;
  writingFeedback:
    | import("../../services/anthropic").StyleMatchedWritingFeedback
    | null;
  setWritingFeedback: (
    feedback:
      | import("../../services/anthropic").StyleMatchedWritingFeedback
      | null,
  ) => void;
  isLoadingFeedback: boolean;
  setIsLoadingFeedback: (loading: boolean) => void;

  // Reply controls
  replyPermission: ReplyPermission;
  setReplyPermission: (permission: ReplyPermission) => void;

  // Quote controls (postgate)
  quotingDisabled: boolean;
  setQuotingDisabled: (disabled: boolean) => void;

  // Link preview
  linkPreviewEnabled: boolean;
  setLinkPreviewEnabled: (enabled: boolean) => void;
  linkPreview: ReturnType<typeof useLinkPreview>;

  // UI state
  showGiphySearch: boolean;
  setShowGiphySearch: (show: boolean) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (show: boolean) => void;
  showThreadComposer: boolean;
  setShowThreadComposer: (show: boolean) => void;

  // GIF embed
  gifEmbed: import("./types").GifEmbed | null;
  setGifEmbed: (embed: import("./types").GifEmbed | null) => void;

  // Drag and drop state
  draggedMedia: UploadedMedia | null;
  setDraggedMedia: (media: UploadedMedia | null) => void;
  dragOverPostIndex: number | null;
  setDragOverPostIndex: (index: number | null) => void;
  dragOverMediaId: string | null;
  setDragOverMediaId: (id: string | null) => void;
  draggedPostIndex: number | null;
  setDraggedPostIndex: (index: number | null) => void;
  dragOverPostOrderIndex: number | null;
  setDragOverPostOrderIndex: (index: number | null) => void;
  isReorderingPosts: boolean;
  setIsReorderingPosts: (reordering: boolean) => void;

  // Alt text generation
  generatingAltTextFor: string | null;
  setGeneratingAltTextFor: (id: string | null) => void;

  // Thread optimization
  threadOptimizationResult:
    | import("../../services/anthropic").ThreadOptimizationResult
    | null;
  setThreadOptimizationResult: (
    result: import("../../services/anthropic").ThreadOptimizationResult | null,
  ) => void;
  showThreadPreview: boolean;
  setShowThreadPreview: (show: boolean) => void;

  // Refs
  countdownInterval: React.MutableRefObject<NodeJS.Timeout | null>;
  sendTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  autoGenerateAltTextRef: React.MutableRefObject<
    ((mediaId: string) => Promise<void>) | null
  >;

  // Video upload manager
  videoUploadManager: ReturnType<typeof useVideoUploadManager>;

  // Auth
  agent: ReturnType<typeof useAuth>["agent"];

  // Utilities
  isDev: boolean;
  loadAnthropicService: typeof loadAnthropicService;

  // Actions
  resetComposer: () => void;
  saveAISettings: (settings: ComposerAISettings) => Promise<void>;
}

export function useComposerState(): UseComposerStateReturn {
  const { agent } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Text state
  const [text, setTextInternal] = useState("");
  const [posts, setPosts] = useState<string[]>([]);
  const [postOrder, setPostOrder] = useState<number[]>([]);
  const [isReorderingPosts, setIsReorderingPosts] = useState(false);

  // Settings
  const [numberingFormat, setNumberingFormat] =
    useState<NumberingFormatType>("simple");
  const [numberingPosition, setNumberingPosition] =
    useState<NumberingPosition>("end");
  const [showSettings, setShowSettings] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(3);

  // Media state
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const mediaUrlsRef = useRef<Set<string>>(new Set());

  // Video upload manager
  const videoUploadManager = useVideoUploadManager(agent);

  // Link preview
  const linkPreview = useLinkPreview(text);
  const [linkPreviewEnabled, setLinkPreviewEnabled] = useState(true);
  const lastDetectedUrl = useRef<string | null>(null);

  // Draft state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [drafts, setDrafts] = useState<ThreadDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // Posting state
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<PostStatus | null>({
    type: "idle",
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingPost, setPendingPost] = useState<PendingPost | null>(null);
  const [threadProgress, setThreadProgress] = useState<ThreadProgress | null>(
    null,
  );
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const sendTimeout = useRef<NodeJS.Timeout | null>(null);

  // AI features state
  const [autoGenerateAltText, setAutoGenerateAltText] = useState(false);
  const autoGenerateAltTextRef = useRef<
    ((mediaId: string) => Promise<void>) | null
  >(null);
  const [enableHashtagSuggestions, setEnableHashtagSuggestions] =
    useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneOption | null>(null);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [tonePreview, setTonePreview] = useState<string | null>(null);
  const [showTonePreview, setShowTonePreview] = useState(false);
  const [showToneOptions, setShowToneOptions] = useState(false);

  // Hashtag suggestions
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<
    HashtagSuggestion[]
  >([]);
  const [isLoadingHashtags, setIsLoadingHashtags] = useState(false);
  const [hashtagDebounceTimer, setHashtagDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  // Writing feedback
  const [showWritingFeedback, setShowWritingFeedback] = useState(false);
  const [writingFeedback, setWritingFeedback] = useState<
    import("../../services/anthropic").StyleMatchedWritingFeedback | null
  >(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Thread optimization
  const [threadOptimizationResult, setThreadOptimizationResult] = useState<
    import("../../services/anthropic").ThreadOptimizationResult | null
  >(null);
  const [showThreadPreview, setShowThreadPreview] = useState(false);

  // Reply controls
  const [replyPermission, setReplyPermission] =
    useState<ReplyPermission>("everyone");

  // Quote controls (postgate)
  const [quotingDisabled, setQuotingDisabled] = useState(false);

  // UI state
  const [showGiphySearch, setShowGiphySearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThreadComposer, setShowThreadComposer] = useState(false);

  // GIF embed state
  const [gifEmbed, setGifEmbed] = useState<import("./types").GifEmbed | null>(
    null,
  );

  // Drag and drop state
  const [draggedMedia, setDraggedMedia] = useState<UploadedMedia | null>(null);
  const [dragOverPostIndex, setDragOverPostIndex] = useState<number | null>(
    null,
  );
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null);
  const [draggedPostIndex, setDraggedPostIndex] = useState<number | null>(null);
  const [dragOverPostOrderIndex, setDragOverPostOrderIndex] = useState<
    number | null
  >(null);

  // Alt text generation
  const [generatingAltTextFor, setGeneratingAltTextFor] = useState<
    string | null
  >(null);

  const isDev = import.meta.env.DEV;

  // setText wrapper that also updates posts and clears stale thread progress
  const setText = useCallback((newText: string) => {
    setTextInternal(newText);
    // If user edits text after a partial thread failure, the progress
    // may no longer match the new posts, so clear it
    setThreadProgress(null);
  }, []);

  // Auto-split text into posts when it changes
  useEffect(() => {
    if (isReorderingPosts) return;

    const newPosts = splitTextIntoPosts(text, numberingFormat);
    setPosts(newPosts);

    // Initialize post order if it doesn't match
    if (postOrder.length !== newPosts.length) {
      setPostOrder(newPosts.map((_, index) => index));
    }
  }, [text, numberingFormat, isReorderingPosts, postOrder.length]);

  // Load settings on mount
  useEffect(() => {
    const settings = getComposerSettings();
    setNumberingFormat(settings.numberingFormat);
    setShowSettings(settings.showSettingsPanel);
    setDelaySeconds(settings.defaultDelaySeconds);
    setNumberingPosition(settings.numberingPosition || "end");

    // Load AI settings from app preferences
    const loadAiSettings = async () => {
      const prefs = await appPreferencesService.getPreferences();
      if (prefs?.aiSettings) {
        setAutoGenerateAltText(prefs.aiSettings.autoGenerateAltText);
        setEnableHashtagSuggestions(prefs.aiSettings.enableHashtagSuggestions);
      }
    };

    loadAiSettings();
  }, []);

  // Handle shared content from Web Share Target API
  useEffect(() => {
    const sharedContent = parseReceivedShare(searchParams);
    if (sharedContent) {
      const composedText = composeFromSharedContent(sharedContent);
      if (composedText) {
        setText(composedText);
        setSearchParams({}, { replace: true });
        debug.log("[Composer] Received shared content:", sharedContent);
      }
    }
  }, [searchParams, setSearchParams, setText]);

  // Save thread settings when they change
  useEffect(() => {
    saveComposerSettings({
      numberingFormat,
      showSettingsPanel: showSettings,
      defaultDelaySeconds: delaySeconds,
      numberingPosition,
    });
  }, [numberingFormat, showSettings, delaySeconds, numberingPosition]);

  // Save AI settings to app preferences
  const saveAISettings = useCallback(async (settings: ComposerAISettings) => {
    const prefs = await appPreferencesService.getPreferences();
    if (prefs) {
      await appPreferencesService.updatePreferences({
        aiSettings: settings,
      });
    }
  }, []);

  // Save AI settings when they change
  useEffect(() => {
    saveAISettings({ autoGenerateAltText, enableHashtagSuggestions });
  }, [autoGenerateAltText, enableHashtagSuggestions, saveAISettings]);

  // Load drafts
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

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

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      if (sendTimeout.current) {
        clearTimeout(sendTimeout.current);
      }
      if (hashtagDebounceTimer) {
        clearTimeout(hashtagDebounceTimer);
      }
      document.body.style.overflow = "";
    };
  }, [hashtagDebounceTimer]);

  // Load hashtag suggestions with debounce
  useEffect(() => {
    if (hashtagDebounceTimer) {
      clearTimeout(hashtagDebounceTimer);
    }

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
      } catch {
        // Silently fail
      } finally {
        setIsLoadingHashtags(false);
      }
    }, 1000);

    setHashtagDebounceTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [text, enableHashtagSuggestions, hashtagDebounceTimer]);

  // Track media URLs for cleanup
  useEffect(() => {
    media.forEach((m) => {
      if (m.preview && !m.preview.startsWith("data:")) {
        mediaUrlsRef.current.add(m.preview);
      }
    });
  }, [media]);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      mediaUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      mediaUrlsRef.current.clear();
    };
  }, []);

  // Reset composer to initial state
  const resetComposer = useCallback(() => {
    setText("");
    setPosts([]);
    setPostOrder([]);
    media.forEach((m) => {
      URL.revokeObjectURL(m.preview);
      mediaUrlsRef.current.delete(m.preview);
    });
    setMedia([]);
    setCurrentDraftId(null);
    setDraftTitle("");
    setPendingPost(null);
    setThreadProgress(null);
    setCountdown(null);
    setReplyPermission("everyone");
    setQuotingDisabled(false);
    videoUploadManager.resetUpload();
    setLinkPreviewEnabled(true);
    linkPreview.clearPreview();
    setGifEmbed(null);
  }, [media, linkPreview, videoUploadManager, setText]);

  return {
    // Text state
    text,
    setText,
    posts,
    postOrder,
    setPostOrder,

    // Settings
    numberingFormat,
    setNumberingFormat,
    numberingPosition,
    setNumberingPosition,
    showSettings,
    setShowSettings,
    delaySeconds,
    setDelaySeconds,

    // Media state
    media,
    setMedia,
    mediaUrlsRef,

    // Draft state
    currentDraftId,
    setCurrentDraftId,
    draftTitle,
    setDraftTitle,
    drafts,
    setDrafts,
    showDrafts,
    setShowDrafts,

    // Posting state
    isPosting,
    setIsPosting,
    postStatus,
    setPostStatus,
    countdown,
    setCountdown,
    pendingPost,
    setPendingPost,
    threadProgress,
    setThreadProgress,

    // AI features state
    autoGenerateAltText,
    setAutoGenerateAltText,
    enableHashtagSuggestions,
    setEnableHashtagSuggestions,
    selectedTone,
    setSelectedTone,
    isAdjustingTone,
    setIsAdjustingTone,
    tonePreview,
    setTonePreview,
    showTonePreview,
    setShowTonePreview,
    showToneOptions,
    setShowToneOptions,

    // Hashtag suggestions
    showHashtagSuggestions,
    setShowHashtagSuggestions,
    hashtagSuggestions,
    setHashtagSuggestions,
    isLoadingHashtags,
    setIsLoadingHashtags,

    // Writing feedback
    showWritingFeedback,
    setShowWritingFeedback,
    writingFeedback,
    setWritingFeedback,
    isLoadingFeedback,
    setIsLoadingFeedback,

    // Reply controls
    replyPermission,
    setReplyPermission,

    // Quote controls (postgate)
    quotingDisabled,
    setQuotingDisabled,

    // Link preview
    linkPreviewEnabled,
    setLinkPreviewEnabled,
    linkPreview,

    // UI state
    showGiphySearch,
    setShowGiphySearch,
    showEmojiPicker,
    setShowEmojiPicker,
    showThreadComposer,
    setShowThreadComposer,

    // GIF embed
    gifEmbed,
    setGifEmbed,

    // Drag and drop state
    draggedMedia,
    setDraggedMedia,
    dragOverPostIndex,
    setDragOverPostIndex,
    dragOverMediaId,
    setDragOverMediaId,
    draggedPostIndex,
    setDraggedPostIndex,
    dragOverPostOrderIndex,
    setDragOverPostOrderIndex,
    isReorderingPosts,
    setIsReorderingPosts,

    // Alt text generation
    generatingAltTextFor,
    setGeneratingAltTextFor,

    // Thread optimization
    threadOptimizationResult,
    setThreadOptimizationResult,
    showThreadPreview,
    setShowThreadPreview,

    // Refs
    countdownInterval,
    sendTimeout,
    autoGenerateAltTextRef,

    // Video upload manager
    videoUploadManager,

    // Auth
    agent,

    // Utilities
    isDev,
    loadAnthropicService,

    // Actions
    resetComposer,
    saveAISettings,
  };
}
