// Spacing and font-weight scales for consistent layout and typography.
// Companion to the elevation/border-radius scale in ./elevation.ts.

// Base-4 spacing scale for padding, margin, and gap values
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Font weight presets matching the values used throughout the app
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
