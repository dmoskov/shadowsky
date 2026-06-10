// Design token source of truth for BSKY (web + mobile + native iOS).
//
// Edit this file, then run `npm run tokens:build` from the repo root to
// regenerate the checked-in consumer files:
//   - src/styles/generated-tokens.css            (web CSS variables)
//   - mobile/src/constants/generated/tokens.ts   (React Native theme objects)
//   - mobile/modules/<module>/ios/Generated/DesignTokens.swift (SwiftUI)
//
// CI runs `npm run tokens:check` to fail if generated files drift from this
// source.

// Canonical Asphodel brand colors, shared by the web and mobile palettes
// below.
export const brand = {
  primary: "#ff6b9d",
  primaryDark: "#d63a71",
  primaryLight: "#ff8fb5",
  accentLight: "#7c3aed", // deep vibrant purple (light backgrounds)
  accentDark: "#a78bfa", // bright purple (dark backgrounds)
};

// ---------------------------------------------------------------------------
// Web (CSS variables, emitted with the `--asph-` prefix).
// Keys are the CSS variable suffixes. Values are emitted verbatim.
// ---------------------------------------------------------------------------

const webLight = {
  /* Primary colors - vibrant electric gradient with modern edge */
  primary: brand.primary,
  "primary-rgb": "255, 107, 157",
  "primary-dark": brand.primaryDark,
  "primary-light": brand.primaryLight,
  accent: brand.accentLight,

  /* Background colors - crisp white with subtle warmth */
  "bg-primary": "#fafafa",
  "bg-secondary": "#ffffff",
  "bg-tertiary": "#f4f4f5",
  "bg-hover": "rgba(244, 244, 245, 0.7)",
  "bg-active": "#e4e4e7",

  /* Text colors - sharp contrast for modern readability */
  "text-primary": "#09090b",
  "text-secondary": "#52525b",
  "text-tertiary": "#71717a",
  "text-link": brand.primary,

  /* Border colors - subtle modern borders */
  "border-primary": "#e4e4e7",
  "border-secondary": "#d4d4d8",
  "border-light": "#f4f4f5",

  /* Notification type colors */
  like: "#ff1744",
  repost: "#00e676",
  follow: brand.primary,
  mention: "#9c27b0",
  reply: "#00bcd4",
  quote: "#651fff",

  /* Status colors */
  success: "#00e676",
  "success-light": "#69f0ae",
  "success-lighter": "#b9f6ca",
  "success-lightest": "#ccffd4",
  warning: "#ffc107",
  "warning-light": "#ffd54f",
  "warning-lighter": "#ffecb3",
  error: "#ff1744",
  "error-light": "#ff5252",
  "error-lighter": "#ff8a80",
  info: "#2979ff",
  "info-light": "#448aff",
  "info-lighter": "#82b1ff",

  /* Extended notification/action colors */
  orange: "#ff6d00",
  "orange-light": "#ff9100",
  pink: "#f50057",
  "pink-light": "#ff4081",
  "pink-lighter": "#ff80ab",
  "pink-lightest": "#ff99bb",
  teal: "#00bfa5",
  yellow: "#ffd600",
  "yellow-light": "#ffea00",

  /* Shadows and effects - layered, natural depth */
  "shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1)",
  "shadow-md":
    "0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 8px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.04)",
  "shadow-lg":
    "0 4px 6px rgba(0, 0, 0, 0.02), 0 10px 20px rgba(0, 0, 0, 0.06), 0 24px 48px rgba(0, 0, 0, 0.08)",
  "shadow-xl":
    "0 8px 16px rgba(0, 0, 0, 0.04), 0 24px 48px rgba(0, 0, 0, 0.08), 0 48px 96px rgba(0, 0, 0, 0.06)",
  glow: "0 0 20px rgba(255, 107, 157, 0.25), 0 0 40px rgba(255, 107, 157, 0.1)",
  "shadow-inner":
    "inset 0 1px 2px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
  "shadow-ring": "0 0 0 1px rgba(0, 0, 0, 0.05)",
  "shadow-ring-primary": "0 0 0 1px rgba(255, 107, 157, 0.3)",

  /* Typography refinements */
  "letter-spacing-tight": "-0.015em",
  "letter-spacing-heading": "-0.025em",
  "letter-spacing-wide": "0.025em",

  /* Accent backgrounds (10% opacity) */
  "primary-10": "rgba(255, 107, 157, 0.1)",
  "success-10": "rgba(0, 230, 118, 0.1)",
  "error-10": "rgba(255, 23, 68, 0.1)",
  "warning-10": "rgba(255, 193, 7, 0.1)",
  "info-10": "rgba(41, 121, 255, 0.1)",
  "orange-10": "rgba(255, 109, 0, 0.1)",
};

const webDark = {
  /* Primary colors - vibrant neon for dark mode */
  primary: brand.primary,
  "primary-rgb": "255, 107, 157",
  "primary-dark": brand.primaryDark,
  "primary-light": brand.primaryLight,
  accent: brand.accentDark,

  /* Background colors - deep modern dark with subtle blue tone */
  "bg-primary": "#0a0a0f",
  "bg-secondary": "#13131a",
  "bg-tertiary": "#1c1c26",
  "bg-hover": "rgba(40, 40, 52, 0.5)",
  "bg-active": "#2d2d3d",

  /* Text colors - crisp white for excellent contrast */
  "text-primary": "#fafafa",
  "text-secondary": "#e4e4e7",
  "text-tertiary": "#d4d4d8",
  "text-link": brand.primaryLight,

  /* Border colors - subtle with slight purple tone */
  "border-primary": "#27272a",
  "border-secondary": "#3f3f46",
  "border-light": "#18181b",

  /* Notification type colors - bright neon for dark mode */
  like: "#ff4081",
  repost: "#00e676",
  follow: brand.primary,
  mention: "#ce93d8",
  reply: "#40c4ff",
  quote: "#7c4dff",

  /* Status colors - bright neon for dark mode */
  success: "#00e676",
  "success-light": "#69f0ae",
  "success-lighter": "#b9f6ca",
  "success-lightest": "#ccffd4",
  warning: "#ffd600",
  "warning-light": "#ffea00",
  "warning-lighter": "#fff59d",
  error: "#ff1744",
  "error-light": "#ff5252",
  "error-lighter": "#ff8a80",
  info: "#2979ff",
  "info-light": "#448aff",
  "info-lighter": "#82b1ff",

  /* Extended notification/action colors - vibrant dark mode */
  orange: "#ff6d00",
  "orange-light": "#ff9100",
  pink: "#f50057",
  "pink-light": "#ff4081",
  "pink-lighter": "#ff80ab",
  "pink-lightest": "#ff99bb",
  teal: "#00bfa5",
  yellow: "#ffd600",
  "yellow-light": "#ffea00",

  /* Shadows and effects for dark theme - layered with subtle glow */
  "shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)",
  "shadow-md":
    "0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.15)",
  "shadow-lg":
    "0 4px 6px rgba(0, 0, 0, 0.2), 0 10px 20px rgba(0, 0, 0, 0.3), 0 24px 48px rgba(0, 0, 0, 0.2)",
  "shadow-xl":
    "0 8px 16px rgba(0, 0, 0, 0.25), 0 24px 48px rgba(0, 0, 0, 0.3), 0 48px 96px rgba(0, 0, 0, 0.2)",
  glow: "0 0 20px rgba(255, 107, 157, 0.3), 0 0 40px rgba(255, 107, 157, 0.15)",
  "shadow-inner":
    "inset 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.04)",
  "shadow-ring": "0 0 0 1px rgba(255, 255, 255, 0.06)",
  "shadow-ring-primary": "0 0 0 1px rgba(255, 107, 157, 0.4)",

  /* Typography refinements */
  "letter-spacing-tight": "-0.015em",
  "letter-spacing-heading": "-0.025em",
  "letter-spacing-wide": "0.025em",

  /* Accent backgrounds - dark theme with more opacity */
  "primary-10": "rgba(255, 107, 157, 0.15)",
  "success-10": "rgba(0, 230, 118, 0.15)",
  "error-10": "rgba(255, 23, 68, 0.15)",
  "warning-10": "rgba(255, 214, 0, 0.15)",
  "info-10": "rgba(41, 121, 255, 0.15)",
  "orange-10": "rgba(255, 109, 0, 0.15)",
};

/* High Contrast - Light - WCAG AAA (7:1 minimum contrast ratio) */
const webHighContrastLight = {
  primary: "#d1004b",
  "primary-rgb": "209, 0, 75",
  "primary-dark": "#a3003a",
  "primary-light": "#d1004b",
  accent: "#5b21b6",

  "bg-primary": "#ffffff",
  "bg-secondary": "#ffffff",
  "bg-tertiary": "#f5f5f5",
  "bg-hover": "#e5e5e5",
  "bg-active": "#d4d4d4",

  "text-primary": "#000000",
  "text-secondary": "#1a1a1a",
  "text-tertiary": "#2d2d2d",
  "text-link": "#8b7335",

  "border-primary": "#404040",
  "border-secondary": "#2d2d2d",
  "border-light": "#525252",

  like: "#be123c",
  repost: "#047857",
  follow: "#d1004b",
  mention: "#5b21b6",
  reply: "#0e7490",
  quote: "#4c1d95",

  success: "#047857",
  warning: "#b45309",
  error: "#b91c1c",
  info: "#1e40af",

  "shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.5)",
  "shadow-md": "0 4px 6px rgba(0, 0, 0, 0.5)",
  "shadow-lg": "0 10px 15px rgba(0, 0, 0, 0.5)",
  glow: "0 0 0 3px rgba(209, 0, 75, 0.5)",

  "primary-10": "rgba(209, 0, 75, 0.15)",
  "success-10": "rgba(4, 120, 87, 0.15)",
};

/* High Contrast - Dark - WCAG AAA (7:1 minimum contrast ratio) */
const webHighContrastDark = {
  primary: "#ff8fb5",
  "primary-rgb": "255, 143, 181",
  "primary-dark": "#ff6b9d",
  "primary-light": "#ffb3cc",
  accent: "#c4b5fd",

  "bg-primary": "#000000",
  "bg-secondary": "#0a0a0a",
  "bg-tertiary": "#171717",
  "bg-hover": "#262626",
  "bg-active": "#404040",

  "text-primary": "#ffffff",
  "text-secondary": "#f5f5f5",
  "text-tertiary": "#e5e5e5",
  "text-link": "#93c5fd",

  "border-primary": "#a3a3a3",
  "border-secondary": "#d4d4d4",
  "border-light": "#737373",

  like: "#ff5252",
  repost: "#69f0ae",
  follow: "#ff8fb5",
  mention: "#ce93d8",
  reply: "#40c4ff",
  quote: "#7c4dff",

  success: "#69f0ae",
  warning: "#ffd600",
  error: "#ff5252",
  info: "#448aff",

  "shadow-sm": "0 1px 3px rgba(255, 255, 255, 0.1)",
  "shadow-md": "0 4px 6px rgba(255, 255, 255, 0.1)",
  "shadow-lg": "0 10px 15px rgba(255, 255, 255, 0.1)",
  glow: "0 0 0 3px rgba(255, 143, 181, 0.5)",

  "primary-10": "rgba(255, 143, 181, 0.2)",
  "success-10": "rgba(105, 240, 174, 0.2)",
};

// ---------------------------------------------------------------------------
// Mobile (React Native theme objects + SwiftUI DesignTokens).
// Brand colors reference the canonical Asphodel `brand` palette above so web
// and mobile cannot drift.
// ---------------------------------------------------------------------------

const mobileDark = {
  background: "#0a0a0f",
  surface: "#1a1a24",
  surfaceAlt: "#1f1f23",
  surfaceElevated: "#1f2937",
  border: "#1f2937",
  borderLight: "#374151",
  borderDark: "#000000",
  primary: brand.primary,
  primaryDark: brand.primaryDark,
  danger: "#ef4444",
  success: "#10b981",
  info: "#3b82f6",
  warning: "#f59e0b",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textTertiary: "#6b7280",
  textMuted: "#e5e7eb",
  // Notification-specific colors
  like: "#ef4444",
  repost: "#10b981",
  mention: "#8b5cf6",
  reply: "#6366f1",
  quote: "#06b6d4",
  // Additional UI colors
  errorBackground: "#1a0a0a",
  errorBorder: "#ff4444",
  unreadBackground: "#0f172a",
  overlayBackground: "rgba(0, 0, 0, 0.7)",
  // Special colors
  accent: brand.accentDark,
  accentGreen: "#4ade80",
  accentBlue: "#3b82f6",
  accentPurple: "#8b5cf6",
  editorBackground: "#1a1a1a",
  editorBorder: "#444444",
  editorControl: "#2a2a2a",
  editorText: "#999999",
  modalOverlay: "rgba(0, 0, 0, 0.6)",
  // Visual polish colors
  primaryLight: brand.primaryLight,
  shadowLight: "rgba(0, 0, 0, 0.1)",
  shadowMedium: "rgba(0, 0, 0, 0.2)",
  shadowHeavy: "rgba(0, 0, 0, 0.4)",
  glowPrimary: "rgba(255, 107, 157, 0.15)",
  glowAccent: "rgba(167, 139, 250, 0.15)",
  cardBackground: "#16161f",
  cardBorder: "#2a2a35",
  textOnPrimary: "#ffffff",
};

const mobileLight = {
  background: "#ffffff",
  surface: "#f9fafb",
  surfaceAlt: "#f3f4f6",
  surfaceElevated: "#f3f4f6",
  border: "#e5e7eb",
  borderLight: "#d1d5db",
  borderDark: "#111827",
  primary: brand.primary,
  primaryDark: brand.primaryDark,
  danger: "#ef4444",
  success: "#10b981",
  info: "#3b82f6",
  warning: "#f59e0b",
  text: "#111827",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",
  textMuted: "#374151",
  // Notification-specific colors
  like: "#ef4444",
  repost: "#10b981",
  mention: "#8b5cf6",
  reply: "#6366f1",
  quote: "#06b6d4",
  // Additional UI colors
  errorBackground: "#fef2f2",
  errorBorder: "#ef4444",
  unreadBackground: "#f0f9ff",
  overlayBackground: "rgba(0, 0, 0, 0.5)",
  // Special colors
  accent: brand.accentLight,
  accentGreen: "#4ade80",
  accentBlue: "#3b82f6",
  accentPurple: "#8b5cf6",
  editorBackground: "#f3f4f6",
  editorBorder: "#d1d5db",
  editorControl: "#e5e7eb",
  editorText: "#6b7280",
  modalOverlay: "rgba(0, 0, 0, 0.4)",
  // Visual polish colors
  primaryLight: brand.primaryLight,
  shadowLight: "rgba(0, 0, 0, 0.05)",
  shadowMedium: "rgba(0, 0, 0, 0.1)",
  shadowHeavy: "rgba(0, 0, 0, 0.2)",
  glowPrimary: "rgba(255, 107, 157, 0.1)",
  glowAccent: "rgba(124, 58, 237, 0.1)",
  cardBackground: "#ffffff",
  cardBorder: "#e5e7eb",
  textOnPrimary: "#ffffff",
};

// Native iOS modules that receive a generated DesignTokens.swift. Add a
// module name here when its SwiftUI views need brand/semantic colors;
// system-adaptive colors (UIColor.system*) should stay as they are.
export const swiftModules = [
  "native-notifications-list",
  "rich-text-view",
  "native-feed-list",
  "native-messages",
];

export const web = {
  light: webLight,
  dark: webDark,
  highContrastLight: webHighContrastLight,
  highContrastDark: webHighContrastDark,
};

export const mobile = {
  dark: mobileDark,
  light: mobileLight,
};
