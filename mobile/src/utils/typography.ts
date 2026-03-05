import {Platform, PixelRatio} from 'react-native';

/**
 * Semantic font size constants aligned with iOS Dynamic Type text styles.
 * These base sizes match Apple's default (Large) Dynamic Type sizes.
 * React Native's allowFontScaling (true by default) will scale these
 * according to the user's system font size preference.
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/typography
 */
export const fontSize = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  callout: 16,
  subheadline: 15,
  footnote: 13,
  caption1: 12,
  caption2: 11,
} as const;

/**
 * Legacy typography presets — prefer `fontSize.*` for new code.
 * Mapped to iOS Dynamic Type equivalents.
 */
export const typography = {
  // Headings
  h1: fontSize.largeTitle,
  h2: fontSize.title1,
  h3: fontSize.title2,
  h4: fontSize.title3,
  h5: fontSize.headline,
  h6: fontSize.callout,

  // Body text
  body: fontSize.subheadline,
  bodyLarge: fontSize.body,
  bodySmall: fontSize.footnote,

  // UI elements
  caption: fontSize.caption1,
  button: fontSize.subheadline,
  label: fontSize.callout,

  // Special — minimum readable size per Apple HIG is 11pt
  tiny: fontSize.caption2,
} as const;

/**
 * Get scaled font size for Dynamic Type support
 * On iOS, React Native handles scaling via allowFontScaling (default true).
 * On Android, use fontScale from PixelRatio for manual scaling when needed.
 */
export function getScaledFontSize(baseSize: number): number {
  if (Platform.OS === 'ios') {
    return baseSize;
  }
  const fontScale = PixelRatio.getFontScale();
  return baseSize * fontScale;
}

/**
 * Get scaled typography size by name.
 *
 * @example
 * fontSize: getTypographySize('body')
 */
export function getTypographySize(
  size: keyof typeof typography,
): number {
  return getScaledFontSize(typography[size]);
}

/**
 * Minimum touch target size for accessibility (iOS HIG and Android Material)
 */
export const MIN_TOUCH_TARGET_SIZE = Platform.select({
  ios: 44,
  android: 48,
  default: 44,
});

/**
 * Ensure a component meets minimum touch target size
 */
export function ensureMinTouchTarget(size: number): number {
  return Math.max(size, MIN_TOUCH_TARGET_SIZE);
}
