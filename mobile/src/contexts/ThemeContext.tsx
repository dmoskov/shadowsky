import React, {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { usePreferences } from "./PreferencesContext";
import { darkColors, lightColors } from "../constants/theme";

export type ThemeColors = {
  [K in keyof typeof darkColors]: (typeof darkColors)[K] | (typeof lightColors)[K];
};

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    // Determine the effective theme based on user preference
    let isDark: boolean;

    if (preferences?.theme === "system") {
      // Use system preference
      isDark = systemColorScheme === "dark";
    } else if (preferences?.theme === "light") {
      isDark = false;
    } else {
      // Default to dark
      isDark = true;
    }

    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
    };
  }, [preferences?.theme, systemColorScheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
