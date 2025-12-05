/**
 * Types and constants for the Composer component
 * Extracted from Composer.tsx for better modularity
 */

import type {
  HashtagSuggestion,
  StyleMatchedWritingFeedback,
  ThreadOptimizationResult,
  ToneOption,
} from "../../services/anthropic";
import type { ReplyPermission } from "../ReplyControls";

// Re-export types from anthropic service
export type { HashtagSuggestion, ThreadOptimizationResult, ToneOption };

// Constants
export const MAX_POST_LENGTH = 300;
export const MAX_IMAGE_SIZE = 1000000; // 1MB (Bluesky's exact limit)
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_VIDEO_DURATION = 180; // 3 minutes in seconds
export const MAX_IMAGES_PER_POST = 4;
export const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mpeg", ".webm", ".mov"];

// Numbering format interface and options
export interface NumberingFormat {
  id: string;
  name: string;
  format: (index: number, total: number) => string;
  example: string;
}

export const NUMBERING_FORMATS: NumberingFormat[] = [
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

export type NumberingFormatType =
  | "none"
  | "simple"
  | "brackets"
  | "thread"
  | "dots";
export type NumberingPosition = "beginning" | "end";

// Tone options for AI adjustments
export interface ToneOptionConfig {
  value: ToneOption;
  label: string;
  description: string;
  icon: string;
}

export const TONE_OPTIONS: ToneOptionConfig[] = [
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

// Media types
export interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
  postIndex?: number; // Track which post this attachment belongs to
  order?: number; // Track order within a post
}

// Post status types
export interface PostStatus {
  type: "idle" | "posting" | "success" | "error" | "loading";
  message?: string;
}

// Pending post for delayed send
export interface PendingPost {
  posts: string[];
  media: UploadedMedia[];
}

// Composer settings from localStorage
export interface ComposerSettings {
  numberingFormat: NumberingFormatType;
  showSettingsPanel: boolean;
  defaultDelaySeconds: number;
  numberingPosition?: NumberingPosition;
}

// AI settings stored in preferences
export interface ComposerAISettings {
  autoGenerateAltText: boolean;
  enableHashtagSuggestions: boolean;
}

// Main composer state interface
export interface ComposerState {
  // Text state
  text: string;
  posts: string[];
  postOrder: number[];

  // Settings
  numberingFormat: NumberingFormatType;
  numberingPosition: NumberingPosition;
  showSettings: boolean;
  delaySeconds: number;

  // Media state
  media: UploadedMedia[];

  // Draft state
  currentDraftId: string | null;
  draftTitle: string;

  // Posting state
  isPosting: boolean;
  postStatus: PostStatus | null;
  countdown: number | null;
  pendingPost: PendingPost | null;

  // AI features state
  autoGenerateAltText: boolean;
  enableHashtagSuggestions: boolean;
  selectedTone: ToneOption | null;
  isAdjustingTone: boolean;
  tonePreview: string | null;
  showTonePreview: boolean;
  showToneOptions: boolean;

  // Thread optimization
  threadOptimizationResult: ThreadOptimizationResult | null;
  showThreadPreview: boolean;

  // Hashtag suggestions
  showHashtagSuggestions: boolean;
  hashtagSuggestions: HashtagSuggestion[];
  isLoadingHashtags: boolean;

  // Writing feedback
  showWritingFeedback: boolean;
  writingFeedback: StyleMatchedWritingFeedback | null;
  isLoadingFeedback: boolean;

  // Reply controls
  replyPermission: ReplyPermission;

  // Link preview
  linkPreviewEnabled: boolean;

  // UI state
  showDrafts: boolean;
  showGiphySearch: boolean;
  showEmojiPicker: boolean;
  showThreadComposer: boolean;

  // Drag and drop state
  draggedMedia: UploadedMedia | null;
  dragOverPostIndex: number | null;
  dragOverMediaId: string | null;
  draggedPostIndex: number | null;
  dragOverPostOrderIndex: number | null;
  isReorderingPosts: boolean;

  // Alt text generation
  generatingAltTextFor: string | null;
}

// Progressive disclosure levels
export type DisclosureLevel = "primary" | "standard" | "advanced";

// Feature flag for progressive disclosure
export interface ComposerFeatureFlags {
  enableProgressiveDisclosure: boolean;
  defaultDisclosureLevel: DisclosureLevel;
}

// Default feature flags
export const DEFAULT_COMPOSER_FEATURE_FLAGS: ComposerFeatureFlags = {
  enableProgressiveDisclosure: true,
  defaultDisclosureLevel: "primary",
};
