/**
 * Hook for managing inline post translation state.
 *
 * Encapsulates the translation logic: whether to show the translate button,
 * loading state, translated text, and toggle between original/translated.
 */

import { useCallback, useMemo, useState } from "react";

import {
  type TranslationResult,
  getCachedTranslation,
  getLanguageName,
  getUserLanguage,
  needsTranslation,
  translatePost,
} from "../services/translation-service";

interface UsePostTranslationOptions {
  postUri: string;
  postText: string;
  postLangs?: string[];
}

interface UsePostTranslationReturn {
  /** Whether the translate button should be shown */
  showTranslateButton: boolean;
  /** Whether a translation is currently loading */
  isTranslating: boolean;
  /** The translated text, or null if not yet translated */
  translatedText: string | null;
  /** Whether we're currently showing the translation */
  isShowingTranslation: boolean;
  /** Error message if translation failed */
  translationError: string | null;
  /** Human-readable source language name (e.g., "Japanese") */
  sourceLanguageName: string;
  /** Trigger translation or toggle between original/translated */
  handleTranslate: () => void;
}

export function usePostTranslation({
  postUri,
  postText,
  postLangs,
}: UsePostTranslationOptions): UsePostTranslationReturn {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] =
    useState<TranslationResult | null>(null);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const userLang = useMemo(() => getUserLanguage(), []);

  const showTranslateButton = useMemo(
    () => needsTranslation(postLangs, userLang) && postText.length > 0,
    [postLangs, userLang, postText],
  );

  const sourceLanguageName = useMemo(() => {
    if (!postLangs || postLangs.length === 0) return "";
    return getLanguageName(postLangs[0]);
  }, [postLangs]);

  // Check for cached translation on mount
  const cachedResult = useMemo(() => {
    if (!showTranslateButton) return null;
    return getCachedTranslation(postUri) || null;
  }, [showTranslateButton, postUri]);

  const handleTranslate = useCallback(async () => {
    // If we already have a translation, toggle display
    if (translationResult || cachedResult) {
      setIsShowingTranslation((prev) => !prev);
      if (!translationResult && cachedResult) {
        setTranslationResult(cachedResult);
      }
      return;
    }

    // Perform translation
    setIsTranslating(true);
    setTranslationError(null);

    try {
      const sourceLang =
        postLangs && postLangs.length > 0 ? postLangs[0] : "auto";
      const result = await translatePost(postText, sourceLang, postUri);
      setTranslationResult(result);
      setIsShowingTranslation(true);
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : "Translation failed",
      );
    } finally {
      setIsTranslating(false);
    }
  }, [translationResult, cachedResult, postText, postLangs, postUri]);

  return {
    showTranslateButton,
    isTranslating,
    translatedText: translationResult?.translatedText ?? null,
    isShowingTranslation,
    translationError,
    sourceLanguageName,
    handleTranslate,
  };
}
