import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccessibilityProvider,
  useAccessibility,
  usePrefersReducedMotion,
} from "../AccessibilityContext";

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
    return <AccessibilityProvider>{children}</AccessibilityProvider>;
  };
}

// Helper to ensure matchMedia mock is properly set up
function ensureMatchMediaMock(prefersReducedMotion: boolean = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === "(prefers-reduced-motion: reduce)"
          ? prefersReducedMotion
          : false,
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

describe("AccessibilityContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    ensureMatchMediaMock();
    // Reset document attributes
    document.documentElement.removeAttribute("data-high-contrast");
    document.documentElement.removeAttribute("data-reduce-motion");
    document.documentElement.classList.remove("enhanced-focus");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useAccessibility hook", () => {
    it("should throw error when used outside AccessibilityProvider", () => {
      expect(() => {
        renderHook(() => useAccessibility());
      }).toThrow(
        "useAccessibility must be used within an AccessibilityProvider",
      );
    });
  });

  describe("Default values", () => {
    it("should provide default accessibility settings", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings).toEqual({
        highContrast: false,
        reduceMotion: "system",
        focusIndicators: "default",
        videoAutoplay: "muted",
      });
    });

    it("should provide updateSettings function", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.updateSettings).toBe("function");
    });

    it("should provide effectiveReduceMotion boolean", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.effectiveReduceMotion).toBe("boolean");
    });

    it("should provide systemPrefersReducedMotion boolean", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.systemPrefersReducedMotion).toBe("boolean");
    });
  });

  describe("Restoring saved settings", () => {
    it("should restore settings from storage", () => {
      mockStorage.set(
        "bsky_accessibility_preferences",
        JSON.stringify({
          highContrast: true,
          reduceMotion: "on",
          focusIndicators: "enhanced",
          videoAutoplay: "off",
        }),
      );

      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings.highContrast).toBe(true);
      expect(result.current.settings.reduceMotion).toBe("on");
      expect(result.current.settings.focusIndicators).toBe("enhanced");
      expect(result.current.settings.videoAutoplay).toBe("off");
    });

    it("should merge partial saved settings with defaults", () => {
      mockStorage.set(
        "bsky_accessibility_preferences",
        JSON.stringify({
          highContrast: true,
        }),
      );

      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings.highContrast).toBe(true);
      // Other settings should have defaults
      expect(result.current.settings.reduceMotion).toBe("system");
      expect(result.current.settings.focusIndicators).toBe("default");
      expect(result.current.settings.videoAutoplay).toBe("muted");
    });

    it("should use defaults when storage contains invalid JSON", () => {
      mockStorage.set("bsky_accessibility_preferences", "not-json");

      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings).toEqual({
        highContrast: false,
        reduceMotion: "system",
        focusIndicators: "default",
        videoAutoplay: "muted",
      });
    });
  });

  describe("State updates", () => {
    it("should update highContrast setting", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ highContrast: true });
      });

      expect(result.current.settings.highContrast).toBe(true);
    });

    it("should update reduceMotion setting", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ reduceMotion: "on" });
      });

      expect(result.current.settings.reduceMotion).toBe("on");
    });

    it("should update focusIndicators setting", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ focusIndicators: "enhanced" });
      });

      expect(result.current.settings.focusIndicators).toBe("enhanced");
    });

    it("should update videoAutoplay setting", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ videoAutoplay: "off" });
      });

      expect(result.current.settings.videoAutoplay).toBe("off");
    });

    it("should allow updating multiple settings at once", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({
          highContrast: true,
          focusIndicators: "enhanced",
        });
      });

      expect(result.current.settings.highContrast).toBe(true);
      expect(result.current.settings.focusIndicators).toBe("enhanced");
      // Unchanged settings should remain at defaults
      expect(result.current.settings.reduceMotion).toBe("system");
    });

    it("should not reset other settings when updating one", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ highContrast: true });
      });

      act(() => {
        result.current.updateSettings({ reduceMotion: "on" });
      });

      expect(result.current.settings.highContrast).toBe(true);
      expect(result.current.settings.reduceMotion).toBe("on");
    });
  });

  describe("Persistence", () => {
    it("should save settings to storage when updated", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ highContrast: true });
      });

      expect(batchedStorage.setItem).toHaveBeenCalledWith(
        "bsky_accessibility_preferences",
        expect.stringContaining('"highContrast":true'),
      );
    });
  });

  describe("Effective reduce motion", () => {
    it("should return false when reduceMotion is off", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ reduceMotion: "off" });
      });

      expect(result.current.effectiveReduceMotion).toBe(false);
    });

    it("should return true when reduceMotion is on", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ reduceMotion: "on" });
      });

      expect(result.current.effectiveReduceMotion).toBe(true);
    });

    it("should follow system preference when reduceMotion is system", () => {
      // matchMedia is mocked to return matches: false
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      // With system setting and matchMedia returning false, effectiveReduceMotion should be false
      expect(result.current.settings.reduceMotion).toBe("system");
      expect(result.current.effectiveReduceMotion).toBe(false);
    });
  });

  describe("DOM effects", () => {
    it("should set data-high-contrast attribute", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ highContrast: true });
      });

      expect(document.documentElement.getAttribute("data-high-contrast")).toBe(
        "true",
      );
    });

    it("should set data-reduce-motion attribute", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ reduceMotion: "on" });
      });

      expect(document.documentElement.getAttribute("data-reduce-motion")).toBe(
        "true",
      );
    });

    it("should add enhanced-focus class when focusIndicators is enhanced", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ focusIndicators: "enhanced" });
      });

      expect(
        document.documentElement.classList.contains("enhanced-focus"),
      ).toBe(true);
    });

    it("should remove enhanced-focus class when focusIndicators is default", () => {
      document.documentElement.classList.add("enhanced-focus");

      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateSettings({ focusIndicators: "default" });
      });

      expect(
        document.documentElement.classList.contains("enhanced-focus"),
      ).toBe(false);
    });
  });

  describe("usePrefersReducedMotion", () => {
    it("should return false outside provider when system prefers no reduction", () => {
      ensureMatchMediaMock(false);
      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(false);
    });

    it("should return effective value when used inside provider", () => {
      const { result } = renderHook(() => usePrefersReducedMotion(), {
        wrapper: createWrapper(),
      });

      // Default system + matchMedia(false) = false
      expect(result.current).toBe(false);
    });
  });

  describe("Provider renders children", () => {
    it("should render children within provider", () => {
      const { result } = renderHook(() => useAccessibility(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.settings).toBeDefined();
    });
  });
});
