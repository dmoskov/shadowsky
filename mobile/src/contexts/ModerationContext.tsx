import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { MMKV } from "react-native-mmkv";
import {
  DEFAULT_CONTENT_FILTER_PREFERENCES,
  shouldHideContent as coreShouldHideContent,
  shouldWarnContent as coreShouldWarnContent,
  shouldBlurImages as coreShouldBlurImages,
  getContentWarningText as coreGetContentWarningText,
} from '@bsky/core';
import type {
  ContentFilterPreferences,
  FilterableLabelType,
  LabelPreference,
} from '@bsky/core';

import { createLogger } from '../utils/logger';

const logger = createLogger('ModerationContext');

// Label evaluation logic lives in @bsky/core (moderation/labels) so it is
// single-sourced with web. This context binds it to MMKV-persisted prefs.
export type LabelType = FilterableLabelType;
export type { ContentFilterPreferences, LabelPreference };
export { DEFAULT_CONTENT_FILTER_PREFERENCES };

type LabelLike = import('@bsky/core').LabelLike;

/**
 * MMKV instance for moderation preferences.
 * Replaces AsyncStorage for synchronous reads on cold start.
 */
let _mmkvModeration: InstanceType<typeof MMKV> | null = null;
function getMMKVModeration() {
  if (!_mmkvModeration) {
    _mmkvModeration = new MMKV({ id: 'shadowsky-moderation' });
  }
  return _mmkvModeration;
}
const CONTENT_FILTER_KEY = "content_filter_preferences";

interface ModerationContextType {
  contentFilterPreferences: ContentFilterPreferences;
  setContentFilterPreference: (
    labelType: LabelType,
    preference: LabelPreference,
  ) => Promise<void>;
  resetContentFilterPreferences: () => Promise<void>;
  shouldHideContent: (labels?: LabelLike[]) => boolean;
  shouldWarnContent: (labels?: LabelLike[]) => boolean;
  shouldBlurImages: (labels?: LabelLike[]) => boolean;
  getContentWarningText: (labels?: LabelLike[]) => string;
}

const ModerationContext = createContext<ModerationContextType | undefined>(
  undefined,
);

/**
 * Load content filter preferences synchronously from MMKV.
 */
function loadPreferencesSync(): ContentFilterPreferences {
  try {
    const stored = getMMKVModeration().getString(CONTENT_FILTER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ContentFilterPreferences;
      return {
        ...DEFAULT_CONTENT_FILTER_PREFERENCES,
        ...parsed,
      };
    }
  } catch (error) {
    logger.error('Failed to load content filter preferences:', error);
  }
  return DEFAULT_CONTENT_FILTER_PREFERENCES;
}

export function ModerationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize synchronously from MMKV — no async gap on cold start
  const [contentFilterPreferences, setContentFilterPreferences] =
    useState<ContentFilterPreferences>(() => loadPreferencesSync());

  // One-time migration from AsyncStorage to MMKV
  useEffect(() => {
    if (getMMKVModeration().getString(CONTENT_FILTER_KEY)) {
      return; // Already migrated
    }
    (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const stored = await AsyncStorage.getItem('@shadowsky_content_filter_preferences');
        if (stored) {
          getMMKVModeration().set(CONTENT_FILTER_KEY, stored);
          setContentFilterPreferences(loadPreferencesSync());
          await AsyncStorage.removeItem('@shadowsky_content_filter_preferences');
        }
      } catch (error) {
        logger.error('Failed to migrate moderation preferences:', error);
      }
    })();
  }, []);

  const setContentFilterPreference = useCallback(
    async (labelType: LabelType, preference: LabelPreference) => {
      try {
        const updated = {
          ...contentFilterPreferences,
          [labelType]: preference,
        };
        getMMKVModeration().set(CONTENT_FILTER_KEY, JSON.stringify(updated));
        setContentFilterPreferences(updated);
      } catch (error) {
        logger.error('Failed to save content filter preference:', error);
        throw error;
      }
    },
    [contentFilterPreferences],
  );

  const resetContentFilterPreferences = useCallback(async () => {
    try {
      getMMKVModeration().delete(CONTENT_FILTER_KEY);
      setContentFilterPreferences(DEFAULT_CONTENT_FILTER_PREFERENCES);
    } catch (error) {
      logger.error('Failed to reset content filter preferences:', error);
      throw error;
    }
  }, []);

  const shouldHideContent = useCallback(
    (labels?: LabelLike[]) =>
      coreShouldHideContent(labels, contentFilterPreferences),
    [contentFilterPreferences],
  );

  const shouldWarnContent = useCallback(
    (labels?: LabelLike[]) =>
      coreShouldWarnContent(labels, contentFilterPreferences),
    [contentFilterPreferences],
  );

  const shouldBlurImages = useCallback(
    (labels?: LabelLike[]) =>
      coreShouldBlurImages(labels, contentFilterPreferences),
    [contentFilterPreferences],
  );

  const getContentWarningText = useCallback(
    (labels?: LabelLike[]) => coreGetContentWarningText(labels),
    [],
  );

  const value = useMemo(
    () => ({
      contentFilterPreferences,
      setContentFilterPreference,
      resetContentFilterPreferences,
      shouldHideContent,
      shouldWarnContent,
      shouldBlurImages,
      getContentWarningText,
    }),
    [
      contentFilterPreferences,
      setContentFilterPreference,
      resetContentFilterPreferences,
      shouldHideContent,
      shouldWarnContent,
      shouldBlurImages,
      getContentWarningText,
    ],
  );

  return (
    <ModerationContext.Provider value={value}>
      {children}
    </ModerationContext.Provider>
  );
}

export function useModeration() {
  const context = useContext(ModerationContext);
  if (context === undefined) {
    throw new Error("useModeration must be used within a ModerationProvider");
  }
  return context;
}
