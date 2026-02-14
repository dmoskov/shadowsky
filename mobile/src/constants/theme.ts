// Dark mode colors
export const darkColors = {
  background: "#0a0a0f",
  surface: "#1a1a24",
  border: "#1f2937",
  borderLight: "#374151",
  primary: "#c9a84c",
  primaryDark: "#8a7230",
  danger: "#ef4444",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textTertiary: "#6b7280",
  textMuted: "#e5e7eb",
} as const;

// Light mode colors
export const lightColors = {
  background: "#ffffff",
  surface: "#f9fafb",
  border: "#e5e7eb",
  borderLight: "#d1d5db",
  primary: "#c9a84c",
  primaryDark: "#8a7230",
  danger: "#ef4444",
  text: "#111827",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",
  textMuted: "#374151",
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
