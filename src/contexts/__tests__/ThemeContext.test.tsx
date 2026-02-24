import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../ThemeContext";

// Mock batchedStorage
const mockStorage = new Map<string, string>();

vi.mock("../../services/storage/batched-local-storage", () => ({
  batchedStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
    }),
    clear: vi.fn(() => {
      mockStorage.clear();
    }),
  },
}));

import { batchedStorage } from "../../services/storage/batched-local-storage";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider>{children}</ThemeProvider>;
  };
}

// Helper to ensure matchMedia mock is properly set up
function ensureMatchMediaMock() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("ThemeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    ensureMatchMediaMock();
    // Reset document attribute
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useTheme hook", () => {
    it("should throw error when used outside ThemeProvider", () => {
      expect(() => {
        renderHook(() => useTheme());
      }).toThrow("useTheme must be used within a ThemeProvider");
    });
  });

  describe("Default values", () => {
    it("should default to system theme when no saved preference", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("system");
    });

    it("should provide toggleTheme function", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.toggleTheme).toBe("function");
    });

    it("should provide setTheme function", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setTheme).toBe("function");
    });
  });

  describe("Restoring saved theme", () => {
    it("should restore light theme from storage", () => {
      mockStorage.set("bsky_notifications_theme_preference", "light");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("light");
    });

    it("should restore dark theme from storage", () => {
      mockStorage.set("bsky_notifications_theme_preference", "dark");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("dark");
    });

    it("should restore system theme from storage", () => {
      mockStorage.set("bsky_notifications_theme_preference", "system");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("system");
    });

    it("should default to system for invalid saved value", () => {
      mockStorage.set("bsky_notifications_theme_preference", "invalid-value");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("system");
    });
  });

  describe("Theme toggling", () => {
    it("should cycle light -> dark -> system -> light", () => {
      mockStorage.set("bsky_notifications_theme_preference", "light");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current.theme).toBe("light");

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("dark");

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("system");

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("light");
    });
  });

  describe("setTheme", () => {
    it("should set theme to light", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("light");
      });

      expect(result.current.theme).toBe("light");
    });

    it("should set theme to dark", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("dark");
      });

      expect(result.current.theme).toBe("dark");
    });

    it("should set theme to system", () => {
      mockStorage.set("bsky_notifications_theme_preference", "dark");

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("system");
      });

      expect(result.current.theme).toBe("system");
    });
  });

  describe("Persistence", () => {
    it("should save theme preference to storage on change", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("dark");
      });

      expect(batchedStorage.setItem).toHaveBeenCalledWith(
        "bsky_notifications_theme_preference",
        "dark",
      );
    });
  });

  describe("DOM effects", () => {
    it("should set data-theme attribute on document when theme changes", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("dark");
      });

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("should set data-theme to light when light theme selected", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTheme("light");
      });

      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("Provider renders children", () => {
    it("should render children within provider", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.theme).toBeDefined();
    });
  });
});
