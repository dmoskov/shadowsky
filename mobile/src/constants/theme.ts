// Theme colors are generated from packages/tokens/tokens.mjs (the design
// token source of truth shared with web and the native iOS modules).
// Edit that file and run `npm run tokens:build` from the repo root.
import { darkColors, lightColors } from "./generated/tokens";

export { darkColors, lightColors };

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
