/**
 * ComposerModals - Lazy-loaded wrapper for composer modal components
 * Handles EmojiPicker, GiphySearch, and AI feature modals
 */

import { Loader } from "lucide-react";
import React, { Suspense } from "react";
import type {
  StyleMatchedWritingFeedback,
  ThreadOptimizationResult,
  ToneOption,
} from "../../services/anthropic";
import type { NumberingFormatType } from "./types";

// Lazy load the modal components
const EmojiPicker = React.lazy(() =>
  import("../EmojiPicker").then((module) => ({
    default: module.EmojiPicker,
  })),
);

const GiphySearch = React.lazy(() =>
  import("../GiphySearch").then((module) => ({
    default: module.GiphySearch,
  })),
);

const ComposerAIFeatures = React.lazy(() =>
  import("./ComposerAIFeatures").then((module) => ({
    default: module.ComposerAIFeatures,
  })),
);

// Loading fallback component
const ModalLoadingFallback: React.FC = () => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
  >
    <div
      className="asph-card flex items-center gap-3 p-6"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <Loader className="animate-spin" size={20} />
      <span style={{ color: "var(--asph-text-primary)" }}>Loading...</span>
    </div>
  </div>
);

export interface ComposerModalsProps {
  // Emoji picker
  showEmojiPicker: boolean;
  onSelectEmoji: (emoji: string) => void;
  onCloseEmojiPicker: () => void;

  // Giphy search
  showGiphySearch: boolean;
  onSelectGif: (gifUrl: string) => void;
  onCloseGiphySearch: () => void;

  // AI features
  text: string;
  onTextChange: (text: string) => void;
  showToneOptions: boolean;
  onToggleToneOptions: () => void;
  selectedTone: ToneOption | null;
  isAdjustingTone: boolean;
  tonePreview: string | null;
  showTonePreview: boolean;
  onToneAdjustment: (tone: ToneOption) => void;
  onApplyTone: () => void;
  onCancelTone: () => void;
  threadOptimizationResult: ThreadOptimizationResult | null;
  showThreadPreview: boolean;
  onApplyThreadOptimization: () => void;
  onCancelThreadOptimization: () => void;
  onNumberingFormatChange: (format: NumberingFormatType) => void;
  showWritingFeedback: boolean;
  writingFeedback: StyleMatchedWritingFeedback | null;
  isLoadingFeedback: boolean;
  onRequestFeedback: () => void;
  onCloseFeedback: () => void;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
}

export const ComposerModals: React.FC<ComposerModalsProps> = ({
  // Emoji picker props
  showEmojiPicker,
  onSelectEmoji,
  onCloseEmojiPicker,

  // Giphy props
  showGiphySearch,
  onSelectGif,
  onCloseGiphySearch,

  // AI features props
  text,
  onTextChange,
  showToneOptions,
  onToggleToneOptions,
  selectedTone,
  isAdjustingTone,
  tonePreview,
  showTonePreview,
  onToneAdjustment,
  onApplyTone,
  onCancelTone,
  threadOptimizationResult,
  showThreadPreview,
  onApplyThreadOptimization,
  onCancelThreadOptimization,
  onNumberingFormatChange,
  showWritingFeedback,
  writingFeedback,
  isLoadingFeedback,
  onRequestFeedback,
  onCloseFeedback,
  onApplyCorrected,
  onApplyEnhanced,
}) => {
  return (
    <>
      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <EmojiPicker
            onSelectEmoji={onSelectEmoji}
            onClose={onCloseEmojiPicker}
          />
        </Suspense>
      )}

      {/* Giphy Search Modal */}
      {showGiphySearch && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <GiphySearch onSelectGif={onSelectGif} onClose={onCloseGiphySearch} />
        </Suspense>
      )}

      {/* AI Features Modals (Tone, Thread Optimization, Writing Feedback) */}
      <Suspense fallback={null}>
        <ComposerAIFeatures
          text={text}
          onTextChange={onTextChange}
          showToneOptions={showToneOptions}
          onToggleToneOptions={onToggleToneOptions}
          selectedTone={selectedTone}
          isAdjustingTone={isAdjustingTone}
          tonePreview={tonePreview}
          showTonePreview={showTonePreview}
          onToneAdjustment={onToneAdjustment}
          onApplyTone={onApplyTone}
          onCancelTone={onCancelTone}
          threadOptimizationResult={threadOptimizationResult}
          showThreadPreview={showThreadPreview}
          onApplyThreadOptimization={onApplyThreadOptimization}
          onCancelThreadOptimization={onCancelThreadOptimization}
          onNumberingFormatChange={onNumberingFormatChange}
          showWritingFeedback={showWritingFeedback}
          writingFeedback={writingFeedback}
          isLoadingFeedback={isLoadingFeedback}
          onRequestFeedback={onRequestFeedback}
          onCloseFeedback={onCloseFeedback}
          onApplyCorrected={onApplyCorrected}
          onApplyEnhanced={onApplyEnhanced}
        />
      </Suspense>
    </>
  );
};

export default ComposerModals;
