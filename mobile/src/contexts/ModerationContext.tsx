import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { MMKV } from "react-native-mmkv";


import { createLogger } from '../utils/logger';

const logger = createLogger('ModerationContext');

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

/**
 * Content label types from AT Protocol
 */
export type LabelType =
  | "porn"
  | "sexual"
  | "nudity"
  | "graphic-media"
  | "gore"
  | "nsfl"
  | "spam"
  | "impersonation"
  | "scam"
  | "misleading";

/**
 * User preference for each label type
 */
export type LabelPreference = "show" | "warn" | "hide";

/**
 * Content filter preferences
 */
export interface ContentFilterPreferences {
  porn: LabelPreference;
  sexual: LabelPreference;
  nudity: LabelPreference;
  "graphic-media": LabelPreference;
  gore: LabelPreference;
  nsfl: LabelPreference;
  spam: LabelPreference;
  impersonation: LabelPreference;
  scam: LabelPreference;
  misleading: LabelPreference;
}

/**
 * Default content filter preferences
 */
export const DEFAULT_CONTENT_FILTER_PREFERENCES: ContentFilterPreferences = {
  porn: "hide",
  sexual: "warn",
  nudity: "warn",
  "graphic-media": "warn",
  gore: "warn",
  nsfl: "hide",
  spam: "hide",
  impersonation: "warn",
  scam: "warn",
  misleading: "warn",
};

interface ModerationContextType {
  contentFilterPreferences: ContentFilterPreferences;
  setContentFilterPreference: (
    labelType: LabelType,
    preference: LabelPreference,
  ) => Promise<void>;
  resetContentFilterPreferences: () => Promise<void>;
  shouldHideContent: (labels?: Array<{ val: string }>) => boolean;
  shouldWarnContent: (labels?: Array<{ val: string }>) => boolean;
  shouldBlurImages: (labels?: Array<{ val: string }>) => boolean;
  getContentWarningText: (labels?: Array<{ val: string }>) => string;
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

  const parseLabelType = useCallback((val: string): LabelType | null => {
    const normalized = val.toLowerCase();
    const knownLabels: LabelType[] = [
      "porn",
      "sexual",
      "nudity",
      "graphic-media",
      "gore",
      "nsfl",
      "spam",
      "impersonation",
      "scam",
      "misleading",
    ];
    return knownLabels.includes(normalized as LabelType)
      ? (normalized as LabelType)
      : null;
  }, []);

  const shouldHideContent = useCallback(
    (labels?: Array<{ val: string }>) => {
      if (!labels || labels.length === 0) return false;

      for (const label of labels) {
        const labelType = parseLabelType(label.val);
        if (labelType && contentFilterPreferences[labelType] === "hide") {
          return true;
        }
      }
      return false;
    },
    [contentFilterPreferences, parseLabelType],
  );

  const shouldWarnContent = useCallback(
    (labels?: Array<{ val: string }>) => {
      if (!labels || labels.length === 0) return false;

      for (const label of labels) {
        const labelType = parseLabelType(label.val);
        if (labelType && contentFilterPreferences[labelType] === "warn") {
          return true;
        }
      }
      return false;
    },
    [contentFilterPreferences, parseLabelType],
  );

  const shouldBlurImages = useCallback(
    (labels?: Array<{ val: string }>) => {
      if (!labels || labels.length === 0) return false;

      for (const label of labels) {
        const labelType = parseLabelType(label.val);
        if (
          labelType &&
          (contentFilterPreferences[labelType] === "warn" ||
            contentFilterPreferences[labelType] === "hide")
        ) {
          return true;
        }
      }
      return false;
    },
    [contentFilterPreferences, parseLabelType],
  );

  const getContentWarningText = useCallback(
    (labels?: Array<{ val: string }>) => {
      if (!labels || labels.length === 0) return "Sensitive Content";

      const labelMetadata: Record<string, string> = {
        porn: "Adult Content",
        sexual: "Sexually Suggestive",
        nudity: "Nudity",
        "graphic-media": "Graphic Content",
        gore: "Gore",
        nsfl: "NSFL",
        spam: "Spam",
        impersonation: "Impersonation",
        scam: "Scam",
        misleading: "Misleading",
      };

      for (const label of labels) {
        const labelType = parseLabelType(label.val);
        if (labelType) {
          return labelMetadata[labelType] || "Sensitive Content";
        }
      }

      return "Sensitive Content";
    },
    [parseLabelType],
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
