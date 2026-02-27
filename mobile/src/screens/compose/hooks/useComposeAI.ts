import { useState } from "react";
import { Alert } from "react-native";
import { ThreadPost } from "../../../components/ThreadPostItem";
import type {
  HashtagSuggestion,
  StyleAnalysisResult,
  ThreadOptimizationResult,
  ToneOption,
  WritingFeedback,
} from "../../../services/ai-service";
import {
  adjustTone,
  analyzeWritingStyle,
  getWritingFeedback,
  optimizeThread,
  suggestHashtags,
} from "../../../services/ai-service";
import { triggerHaptic } from "../../../utils/haptics";
import { createLogger } from "../../../utils/logger";

const logger = createLogger("ComposeAI");

interface UseComposeAIParams {
  text: string;
  setText: (text: string) => void;
  setThreadPosts: (posts: ThreadPost[]) => void;
  setIsThreadMode: (mode: boolean) => void;
  clearImages: () => void;
  showToast: (message: string, options?: any) => void;
}

export function useComposeAI({
  text,
  setText,
  setThreadPosts,
  setIsThreadMode,
  clearImages,
  showToast,
}: UseComposeAIParams) {
  // AI panel state
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  const [hashtagResult, setHashtagResult] = useState<
    HashtagSuggestion[] | null
  >(null);
  const [isLoadingHashtags, setIsLoadingHashtags] = useState(false);
  const [writingFeedback, setWritingFeedback] =
    useState<WritingFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [styleAnalysis, setStyleAnalysis] =
    useState<StyleAnalysisResult | null>(null);
  const [isLoadingStyle, setIsLoadingStyle] = useState(false);
  const [threadResult, setThreadResult] =
    useState<ThreadOptimizationResult | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Tone adjustment state
  const [tonePickerVisible, setTonePickerVisible] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneOption | null>(null);
  const [tonePreviewText, setTonePreviewText] = useState<string | null>(null);

  // AI panel handlers
  const handleAIPanel = () => {
    if (!text.trim()) return;
    setAiPanelVisible(true);
  };

  const handleCloseAIPanel = () => {
    setAiPanelVisible(false);
  };

  const handleRequestHashtags = async () => {
    setIsLoadingHashtags(true);
    try {
      const existingTags =
        text.match(/#(\w+)/g)?.map((t) => t.slice(1)) || undefined;
      const result = await suggestHashtags(text, existingTags);
      setHashtagResult(result.hashtags);
    } catch (error) {
      logger.error("Failed to suggest hashtags:", error);
      Alert.alert(
        "Hashtag Suggestions Failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      triggerHaptic("error");
    } finally {
      setIsLoadingHashtags(false);
    }
  };

  const handleInsertHashtag = (tag: string) => {
    const hashtag = `#${tag}`;
    const newText =
      text.endsWith(" ") || text.length === 0
        ? `${text}${hashtag}`
        : `${text} ${hashtag}`;
    setText(newText);
    triggerHaptic("selection");
  };

  const handleRequestFeedback = async () => {
    setIsLoadingFeedback(true);
    try {
      const result = await getWritingFeedback(text);
      setWritingFeedback(result);
    } catch (error) {
      logger.error("Failed to get writing feedback:", error);
      Alert.alert(
        "Writing Feedback Failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      triggerHaptic("error");
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleApplyCorrected = () => {
    if (writingFeedback?.correctedVersion.text) {
      setText(writingFeedback.correctedVersion.text);
      triggerHaptic("success");
      showToast("Corrected version applied", { type: "success" });
      setAiPanelVisible(false);
    }
  };

  const handleApplyEnhanced = () => {
    if (writingFeedback?.enhancedVersion.text) {
      setText(writingFeedback.enhancedVersion.text);
      triggerHaptic("success");
      showToast("Enhanced version applied", { type: "success" });
      setAiPanelVisible(false);
    }
  };

  const handleRequestStyleAnalysis = async () => {
    setIsLoadingStyle(true);
    try {
      const result = await analyzeWritingStyle(text, []);
      setStyleAnalysis(result);
    } catch (error) {
      logger.error("Failed to analyze style:", error);
      Alert.alert(
        "Style Analysis Failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      triggerHaptic("error");
    } finally {
      setIsLoadingStyle(false);
    }
  };

  const handleRequestThreadOptimization = async () => {
    setIsLoadingThread(true);
    try {
      const result = await optimizeThread(text);
      setThreadResult(result);
    } catch (error) {
      logger.error("Failed to optimize thread:", error);
      Alert.alert(
        "Thread Optimization Failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      triggerHaptic("error");
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleApplyThreadOptimization = () => {
    if (threadResult) {
      const posts: ThreadPost[] = threadResult.segments.map((seg) => ({
        text: seg.text,
        images: [],
      }));
      setThreadPosts(posts);
      setText("");
      clearImages();
      setIsThreadMode(true);
      triggerHaptic("success");
      showToast("Thread optimization applied", { type: "success" });
      setAiPanelVisible(false);
      setThreadResult(null);
    }
  };

  // Tone adjustment handlers
  const handleSelectTone = async (tone: ToneOption) => {
    setSelectedTone(tone);
    setIsAdjustingTone(true);
    try {
      const result = await adjustTone(text, tone);
      setTonePreviewText(result.adjustedText);
    } catch (error) {
      logger.error("Failed to adjust tone:", error);
      Alert.alert(
        "Tone Adjustment Failed",
        error instanceof Error
          ? error.message
          : "Failed to adjust tone. Please try again.",
        [{ text: "OK" }],
      );
      triggerHaptic("error");
    } finally {
      setIsAdjustingTone(false);
    }
  };

  const handleApplyTone = () => {
    if (tonePreviewText) {
      setText(tonePreviewText);
      triggerHaptic("success");
    }
    setTonePreviewText(null);
    setSelectedTone(null);
    setTonePickerVisible(false);
  };

  const handleCancelTonePreview = () => {
    setTonePreviewText(null);
    setSelectedTone(null);
  };

  return {
    // AI panel
    aiPanelVisible,
    handleAIPanel,
    handleCloseAIPanel,

    // Hashtags
    hashtagResult,
    isLoadingHashtags,
    handleRequestHashtags,
    handleInsertHashtag,

    // Feedback
    writingFeedback,
    isLoadingFeedback,
    handleRequestFeedback,
    handleApplyCorrected,
    handleApplyEnhanced,

    // Style
    styleAnalysis,
    isLoadingStyle,
    handleRequestStyleAnalysis,

    // Thread optimization
    threadResult,
    isLoadingThread,
    handleRequestThreadOptimization,
    handleApplyThreadOptimization,

    // Tone
    tonePickerVisible,
    setTonePickerVisible,
    isAdjustingTone,
    selectedTone,
    tonePreviewText,
    handleSelectTone,
    handleApplyTone,
    handleCancelTonePreview,
  };
}
