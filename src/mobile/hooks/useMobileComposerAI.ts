/**
 * useMobileComposerAI - AI features hook for mobile composer
 *
 * Manages state and actions for tone adjustment, writing feedback,
 * and style-matched suggestions. Reuses the shared anthropic service
 * via lazy dynamic import.
 */

import { useCallback, useRef, useState } from "react";
import type {
  StyleMatchedWritingFeedback,
  ToneAdjustmentResult,
  ToneOption,
} from "../../services/anthropic";

let anthropicServiceModule: typeof import("../../services/anthropic") | null =
  null;

async function loadAnthropicService() {
  if (!anthropicServiceModule) {
    anthropicServiceModule = await import("../../services/anthropic");
  }
  return anthropicServiceModule;
}

export interface UseMobileComposerAIReturn {
  // Tone adjustment
  selectedTone: ToneOption | null;
  isAdjustingTone: boolean;
  tonePreview: string | null;
  showToneOptions: boolean;
  showTonePreview: boolean;
  onToggleToneOptions: () => void;
  onToneAdjustment: (tone: ToneOption, text: string) => Promise<void>;
  onApplyTone: () => string | null;
  onCancelTone: () => void;

  // Writing feedback
  writingFeedback: StyleMatchedWritingFeedback | null;
  isLoadingFeedback: boolean;
  showWritingFeedback: boolean;
  onRequestFeedback: (text: string) => Promise<void>;
  onCloseFeedback: () => void;
  onApplyCorrected: () => string | null;
  onApplyEnhanced: () => string | null;

  // Error state
  error: string | null;
  clearError: () => void;
}

export function useMobileComposerAI(): UseMobileComposerAIReturn {
  // Tone adjustment state
  const [selectedTone, setSelectedTone] = useState<ToneOption | null>(null);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [tonePreview, setTonePreview] = useState<string | null>(null);
  const [showToneOptions, setShowToneOptions] = useState(false);
  const [showTonePreview, setShowTonePreview] = useState(false);

  // Writing feedback state
  const [writingFeedback, setWritingFeedback] =
    useState<StyleMatchedWritingFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [showWritingFeedback, setShowWritingFeedback] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Store the tone result for applying later
  const toneResultRef = useRef<ToneAdjustmentResult | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // --- Tone adjustment ---

  const onToggleToneOptions = useCallback(() => {
    setShowToneOptions((prev) => !prev);
  }, []);

  const onToneAdjustment = useCallback(
    async (tone: ToneOption, text: string) => {
      if (!text.trim()) return;
      setSelectedTone(tone);
      setIsAdjustingTone(true);
      setShowToneOptions(false);
      setError(null);

      try {
        const service = await loadAnthropicService();
        const result = await service.adjustTone(text, tone);
        toneResultRef.current = result;
        setTonePreview(result.adjustedText);
        setShowTonePreview(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to adjust tone");
        setSelectedTone(null);
      } finally {
        setIsAdjustingTone(false);
      }
    },
    [],
  );

  const onApplyTone = useCallback((): string | null => {
    const adjusted = tonePreview;
    setShowTonePreview(false);
    setTonePreview(null);
    setSelectedTone(null);
    toneResultRef.current = null;
    return adjusted;
  }, [tonePreview]);

  const onCancelTone = useCallback(() => {
    setShowTonePreview(false);
    setTonePreview(null);
    setSelectedTone(null);
    toneResultRef.current = null;
  }, []);

  // --- Writing feedback ---

  const onRequestFeedback = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsLoadingFeedback(true);
    setError(null);

    try {
      const service = await loadAnthropicService();
      // Use basic writing feedback (style-matched requires BskyAgent which
      // is a web-only auth context dependency - for mobile, basic feedback
      // covers corrections and enhancements)
      const result = await service.getWritingFeedback(text);
      const feedback: StyleMatchedWritingFeedback = {
        ...result,
        styleAnalysis: {
          userStyleSummary: "",
          matchesStyle: true,
          styleNotes: [],
        },
      };
      setWritingFeedback(feedback);
      setShowWritingFeedback(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get writing feedback",
      );
    } finally {
      setIsLoadingFeedback(false);
    }
  }, []);

  const onCloseFeedback = useCallback(() => {
    setShowWritingFeedback(false);
  }, []);

  const onApplyCorrected = useCallback((): string | null => {
    const corrected = writingFeedback?.correctedVersion.text ?? null;
    setShowWritingFeedback(false);
    return corrected;
  }, [writingFeedback]);

  const onApplyEnhanced = useCallback((): string | null => {
    const enhanced = writingFeedback?.enhancedVersion.text ?? null;
    setShowWritingFeedback(false);
    return enhanced;
  }, [writingFeedback]);

  return {
    selectedTone,
    isAdjustingTone,
    tonePreview,
    showToneOptions,
    showTonePreview,
    onToggleToneOptions,
    onToneAdjustment,
    onApplyTone,
    onCancelTone,

    writingFeedback,
    isLoadingFeedback,
    showWritingFeedback,
    onRequestFeedback,
    onCloseFeedback,
    onApplyCorrected,
    onApplyEnhanced,

    error,
    clearError,
  };
}
