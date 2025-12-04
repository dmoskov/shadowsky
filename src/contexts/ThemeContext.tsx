import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { batchedStorage } from "../services/storage/batched-local-storage";

interface ThemeContextType {
  theme: "light" | "dark" | "system";
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "bsky_notifications_theme_preference";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(() => {
    // Check localStorage first
    const savedTheme = batchedStorage.getItem(THEME_KEY);
    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      return savedTheme;
    }
    // Default to system
    return "system";
  });

  const getSystemTheme = () => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  };

  const getEffectiveTheme = () => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  };

  useEffect(() => {
    // Update the data-theme attribute on the root element
    const effectiveTheme = getEffectiveTheme();
    document.documentElement.setAttribute("data-theme", effectiveTheme);

    // Save to localStorage
    batchedStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Listen to system theme changes
  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const effectiveTheme = getEffectiveTheme();
        document.documentElement.setAttribute("data-theme", effectiveTheme);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  }, []);

  const setTheme = useCallback((newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
