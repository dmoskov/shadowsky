/**
 * Dynamic Type Hook for iOS
 *
 * Provides scaled font sizes that respect the user's iOS Dynamic Type
 * text size preference. Uses PixelRatio.getFontScale() to detect the
 * system font scale and applies it to base font sizes.
 *
 * Font scale values:
 * - 0.82: Extra Small
 * - 0.88: Small
 * - 0.94: Medium (slightly below default)
 * - 1.0:  Default (Large)
 * - 1.06: Extra Large
 * - 1.12: Extra Extra Large
 * - 1.18: Extra Extra Extra Large
 * - 1.35+: Accessibility sizes
 *
 * Usage:
 *   const { scaledFont, fontScale } = useDynamicType();
 *   const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);
 */

import { useEffect, useMemo, useState } from "react";
import { Dimensions, PixelRatio } from "react-native";

/** Maximum font scale multiplier to prevent layouts from breaking */
const MAX_FONT_SCALE = 1.5;

/** Minimum font scale to maintain readability */
const MIN_FONT_SCALE = 0.8;

/**
 * Clamp font scale to prevent extreme sizes that break layouts.
 * Accessibility sizes above 1.5x are supported via scrollable containers
 * rather than unbounded text scaling.
 */
function clampFontScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_FONT_SCALE), MAX_FONT_SCALE);
}

/**
 * Scale a base font size by the current Dynamic Type font scale.
 * Returns a rounded integer for consistent rendering.
 */
export type ScaledFontFn = (baseSize: number) => number;

/**
 * Create a font scaling function for a given font scale factor.
 */
function createScaledFont(fontScale: number): ScaledFontFn {
  const clamped = clampFontScale(fontScale);
  return (baseSize: number) => Math.round(baseSize * clamped);
}

/**
 * Hook that provides Dynamic Type-aware font scaling.
 *
 * Listens for dimension changes (which include font scale changes
 * triggered by the user adjusting Dynamic Type settings) and
 * returns an updated scaling function.
 *
 * @returns Object with:
 *   - scaledFont: function to scale a base font size
 *   - fontScale: the current clamped font scale value
 */
export function useDynamicType() {
  const [fontScale, setFontScale] = useState(() =>
    clampFontScale(PixelRatio.getFontScale()),
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setFontScale(clampFontScale(window.fontScale));
    });
    return () => subscription.remove();
  }, []);

  const scaledFont = useMemo(() => createScaledFont(fontScale), [fontScale]);

  return { scaledFont, fontScale };
}

/**
 * Scale a line height proportionally with the font size.
 * Maintains the ratio between line height and font size.
 */
export function scaledLineHeight(
  scaledFont: ScaledFontFn,
  baseFontSize: number,
  baseLineHeight: number,
): number {
  const ratio = baseLineHeight / baseFontSize;
  return Math.round(scaledFont(baseFontSize) * ratio);
}

/**
 * Get the current font scale without subscribing to changes.
 * Useful for one-time calculations outside of React components.
 */
export function getCurrentFontScale(): number {
  return clampFontScale(PixelRatio.getFontScale());
}
