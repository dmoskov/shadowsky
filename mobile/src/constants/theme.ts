// Dark mode colors
export const darkColors = {
  background: "#0a0a0f",
  surface: "#1a1a24",
  surfaceAlt: "#1f1f23",
  surfaceElevated: "#1f2937",
  border: "#1f2937",
  borderLight: "#374151",
  borderDark: "#000000",
  primary: "#c9a84c",
  primaryDark: "#8a7230",
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
  accent: "#F91880",
  accentGreen: "#4ade80",
  editorBackground: "#1a1a1a",
  editorBorder: "#444444",
  editorControl: "#2a2a2a",
  editorText: "#999999",
  modalOverlay: "rgba(0, 0, 0, 0.6)",
} as const;

// Light mode colors
export const lightColors = {
  background: "#ffffff",
  surface: "#f9fafb",
  surfaceAlt: "#f3f4f6",
  surfaceElevated: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#d1d5db",
  borderDark: "#111827",
  primary: "#c9a84c",
  primaryDark: "#8a7230",
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
  accent: "#F91880",
  accentGreen: "#4ade80",
  editorBackground: "#f3f4f6",
  editorBorder: "#d1d5db",
  editorControl: "#e5e7eb",
  editorText: "#6b7280",
  modalOverlay: "rgba(0, 0, 0, 0.4)",
} as const;

// For backwards compatibility
export const colors = darkColors;

export const darkTheme = {
  dark: true,
  colors: {
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.background,
    text: darkColors.text,
    border: darkColors.border,
    notification: darkColors.primary,
  },
} as const;

export const lightTheme = {
  dark: false,
  colors: {
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.background,
    text: lightColors.text,
    border: lightColors.border,
    notification: lightColors.primary,
  },
} as const;
