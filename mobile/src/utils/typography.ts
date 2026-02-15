import {Platform, PixelRatio} from 'react-native';

/**
 * Get scaled font size for Dynamic Type support
 * On iOS, this respects the user's text size preference
 * On Android, this respects the font scale from accessibility settings
 */
export function getScaledFontSize(baseSize: number): number {
  if (Platform.OS === 'ios') {
    // iOS uses the built-in Dynamic Type support
    // React Native automatically applies the multiplier based on Text Size settings
    // We return the base size and let the system handle scaling
    return baseSize;
  }

  // On Android, use fontScale from PixelRatio
  const fontScale = PixelRatio.getFontScale();
  return baseSize * fontScale;
}

/**
 * Font size presets that support Dynamic Type
 * These are base sizes that will be scaled according to user preferences
 */
export const typography = {
  // Headings
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,

  // Body text
  body: 15,
  bodyLarge: 17,
  bodySmall: 13,

  // UI elements
  caption: 12,
  button: 15,
  label: 14,

  // Special
  tiny: 10,
} as const;

/**
 * Get scaled typography size
 * Use this function to get accessible font sizes that respect user preferences
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
 * iOS HIG recommends 44x44 points
 * Android Material recommends 48x48 dp
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
