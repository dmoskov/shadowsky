/**
 * useComposerFeatureFlags - Hook for managing composer feature flags
 * Enables gradual rollout of progressive disclosure UI
 */

import { useEffect, useState } from "react";
import {
  DEFAULT_COMPOSER_FEATURE_FLAGS,
  type ComposerFeatureFlags,
  type DisclosureLevel,
} from "./types";

const FEATURE_FLAG_STORAGE_KEY = "shadowsky_composer_feature_flags";

/**
 * Load feature flags from localStorage
 */
function loadFeatureFlags(): ComposerFeatureFlags {
  try {
    const stored = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_COMPOSER_FEATURE_FLAGS,
        ...parsed,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_COMPOSER_FEATURE_FLAGS;
}

/**
 * Save feature flags to localStorage
 */
function saveFeatureFlags(flags: ComposerFeatureFlags): void {
  try {
    localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Ignore save errors
  }
}

export interface UseComposerFeatureFlagsReturn {
  featureFlags: ComposerFeatureFlags;
  enableProgressiveDisclosure: boolean;
  defaultDisclosureLevel: DisclosureLevel;
  setEnableProgressiveDisclosure: (enabled: boolean) => void;
  setDefaultDisclosureLevel: (level: DisclosureLevel) => void;
}

/**
 * Hook to manage composer feature flags
 */
export function useComposerFeatureFlags(): UseComposerFeatureFlagsReturn {
  const [featureFlags, setFeatureFlags] =
    useState<ComposerFeatureFlags>(loadFeatureFlags);

  // Persist changes to localStorage
  useEffect(() => {
    saveFeatureFlags(featureFlags);
  }, [featureFlags]);

  const setEnableProgressiveDisclosure = (enabled: boolean) => {
    setFeatureFlags((prev) => ({
      ...prev,
      enableProgressiveDisclosure: enabled,
    }));
  };

  const setDefaultDisclosureLevel = (level: DisclosureLevel) => {
    setFeatureFlags((prev) => ({
      ...prev,
      defaultDisclosureLevel: level,
    }));
  };

  return {
    featureFlags,
    enableProgressiveDisclosure: featureFlags.enableProgressiveDisclosure,
    defaultDisclosureLevel: featureFlags.defaultDisclosureLevel,
    setEnableProgressiveDisclosure,
    setDefaultDisclosureLevel,
  };
}

/**
 * Check if progressive disclosure should be enabled based on environment
 * Can be used for A/B testing or gradual rollout
 */
export function shouldEnableProgressiveDisclosure(): boolean {
  // Check for explicit override via URL param (useful for testing)
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const override = urlParams.get("progressive_disclosure");
    if (override === "true") return true;
    if (override === "false") return false;
  }

  // Check for environment variable override
  if (import.meta.env.VITE_ENABLE_PROGRESSIVE_DISCLOSURE === "true") {
    return true;
  }
  if (import.meta.env.VITE_ENABLE_PROGRESSIVE_DISCLOSURE === "false") {
    return false;
  }

  // Default: enabled
  return true;
}

export default useComposerFeatureFlags;
