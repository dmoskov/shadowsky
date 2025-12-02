import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export interface AccessibilitySettings {
  highContrast: boolean;
  reduceMotion: "system" | "on" | "off";
  focusIndicators: "default" | "enhanced";
  videoAutoplay: "off" | "muted" | "on";
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  effectiveReduceMotion: boolean;
  systemPrefersReducedMotion: boolean;
}

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

const ACCESSIBILITY_KEY = "bsky_accessibility_preferences";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  reduceMotion: "system",
  focusIndicators: "default",
  videoAutoplay: "muted", // Default to muted autoplay for timeline videos
};

function getSystemReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem(ACCESSIBILITY_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(
    getSystemReducedMotion,
  );

  // Calculate effective reduced motion based on user preference and system setting
  const effectiveReduceMotion =
    settings.reduceMotion === "on" ||
    (settings.reduceMotion === "system" && systemPrefersReducedMotion);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Apply high contrast attribute to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-high-contrast",
      settings.highContrast ? "true" : "false",
    );
  }, [settings.highContrast]);

  // Apply reduced motion attribute to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-reduce-motion",
      effectiveReduceMotion ? "true" : "false",
    );
  }, [effectiveReduceMotion]);

  // Apply focus indicator class
  useEffect(() => {
    if (settings.focusIndicators === "enhanced") {
      document.documentElement.classList.add("enhanced-focus");
    } else {
      document.documentElement.classList.remove("enhanced-focus");
    }
  }, [settings.focusIndicators]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  const updateSettings = (updates: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSettings,
        effectiveReduceMotion,
        systemPrefersReducedMotion,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      "useAccessibility must be used within an AccessibilityProvider",
    );
  }
  return context;
}

/**
 * Hook to detect if user prefers reduced motion (combines system and user preference)
 */
export function usePrefersReducedMotion(): boolean {
  const context = useContext(AccessibilityContext);
  if (context) {
    return context.effectiveReduceMotion;
  }
  // Fallback if used outside provider
  return getSystemReducedMotion();
}
