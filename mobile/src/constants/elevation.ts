// iOS-style elevation and shadow system for consistent visual polish
// These values provide depth and hierarchy throughout the app

export const elevation = {
  // Level 0: Flat, no elevation
  none: {
    shadowColor: 'transparent',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Level 1: Subtle lift for cards and list items
  low: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Level 2: Medium elevation for buttons and interactive elements
  medium: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Level 3: High elevation for floating action buttons and prominent CTAs
  high: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  // Level 4: Maximum elevation for modals and overlays
  highest: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Colored shadows for emphasis on specific elements
export const coloredShadow = {
  primary: (opacity: number = 0.3) => ({
    shadowColor: '#c9a84c',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: opacity,
    shadowRadius: 4,
    elevation: 3,
  }),

  accent: (opacity: number = 0.3) => ({
    shadowColor: '#F91880',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: opacity,
    shadowRadius: 4,
    elevation: 3,
  }),

  danger: (opacity: number = 0.3) => ({
    shadowColor: '#ef4444',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: opacity,
    shadowRadius: 4,
    elevation: 3,
  }),

  success: (opacity: number = 0.3) => ({
    shadowColor: '#10b981',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: opacity,
    shadowRadius: 4,
    elevation: 3,
  }),
} as const;

// Border radius presets for consistent rounded corners
export const borderRadius = {
  none: 0,
  small: 4,
  medium: 8,
  large: 12,
  xlarge: 16,
  full: 9999,
} as const;
