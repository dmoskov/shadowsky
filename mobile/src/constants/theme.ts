export const colors = {
  background: "#0a0a0f",
  surface: "#1a1a24",
  border: "#1f2937",
  borderLight: "#374151",
  primary: "#c9a84c",
  primaryDark: "#a68a3a",
  danger: "#ef4444",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textTertiary: "#6b7280",
  textMuted: "#e5e7eb",
} as const;

export const darkTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
} as const;
