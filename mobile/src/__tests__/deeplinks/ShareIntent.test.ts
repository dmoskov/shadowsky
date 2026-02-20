/**
 * ShareIntent.test.ts
 *
 * Tests for the Share Intent module (modules/share-intent/).
 * The module bridges shared content from the iOS Share Extension
 * to the React Native layer via an Expo native module.
 *
 * Since the native module is only available on iOS, these tests
 * verify the TypeScript wrapper's fallback behavior and the
 * contract of the SharedContent interface.
 */

import { Platform } from "react-native";

// The share intent module lazily loads the native module via require().
// We need to control that require path in tests.
let mockNativeModule: {
  getSharedContent: jest.Mock;
  clearSharedContent: jest.Mock;
  getSharedImagePath: jest.Mock;
} | null = null;

// Mock expo-modules-core to control native module availability
jest.mock("expo-modules-core", () => ({
  requireNativeModule: jest.fn((name: string) => {
    if (name === "ShareIntent" && mockNativeModule) {
      return mockNativeModule;
    }
    throw new Error(`Module ${name} not found`);
  }),
}));

// We need to re-require the module for each test scenario because
// the native module reference is captured at require-time
function requireShareIntent() {
  // Clear the module cache so we get a fresh require
  jest.resetModules();

  // Re-apply our mocks after reset
  jest.mock("expo-modules-core", () => ({
    requireNativeModule: jest.fn((name: string) => {
      if (name === "ShareIntent" && mockNativeModule) {
        return mockNativeModule;
      }
      throw new Error(`Module ${name} not found`);
    }),
  }));

  return require("../../../modules/share-intent/src/ShareIntent");
}

describe("ShareIntent Module", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    // Restore Platform.OS
    Object.defineProperty(Platform, "OS", { value: originalPlatform });
    mockNativeModule = null;
  });

  // ---------------------------------------------------------------
  // Non-iOS platform behavior
  // ---------------------------------------------------------------
  describe("Non-iOS platforms", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "android" });
      mockNativeModule = null;
    });

    it("getSharedContent returns null on Android", () => {
      const ShareIntent = requireShareIntent();
      expect(ShareIntent.getSharedContent()).toBeNull();
    });

    it("clearSharedContent does nothing on Android", () => {
      const ShareIntent = requireShareIntent();
      // Should not throw
      expect(() => ShareIntent.clearSharedContent()).not.toThrow();
    });

    it("getSharedImagePath returns null on Android", () => {
      const ShareIntent = requireShareIntent();
      expect(ShareIntent.getSharedImagePath("image.jpg")).toBeNull();
    });

    it("getSharedContent returns null on web", () => {
      Object.defineProperty(Platform, "OS", { value: "web" });
      const ShareIntent = requireShareIntent();
      expect(ShareIntent.getSharedContent()).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // iOS with native module available
  // ---------------------------------------------------------------
  describe("iOS with native module", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "ios" });
      mockNativeModule = {
        getSharedContent: jest.fn(),
        clearSharedContent: jest.fn(),
        getSharedImagePath: jest.fn(),
      };
    });

    it("getSharedContent returns shared URL content", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        url: "https://example.com/article",
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.url).toBe("https://example.com/article");
    });

    it("getSharedContent returns shared text content", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        text: "Check out this cool post about Bluesky!",
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.text).toBe("Check out this cool post about Bluesky!");
    });

    it("getSharedContent returns shared image content", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        images: ["photo1.jpg", "photo2.jpg"],
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.images).toEqual(["photo1.jpg", "photo2.jpg"]);
    });

    it("getSharedContent returns null when no content", () => {
      mockNativeModule!.getSharedContent.mockReturnValue(null);

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).toBeNull();
    });

    it("getSharedContent returns content with URL and text", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        url: "https://example.com",
        text: "Look at this",
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.url).toBe("https://example.com");
      expect(content.text).toBe("Look at this");
    });

    it("clearSharedContent calls native module", () => {
      const ShareIntent = requireShareIntent();
      ShareIntent.clearSharedContent();
      expect(mockNativeModule!.clearSharedContent).toHaveBeenCalled();
    });

    it("getSharedImagePath returns file path for valid filename", () => {
      mockNativeModule!.getSharedImagePath.mockReturnValue(
        "file:///app-group/shared-images/abc123.jpg"
      );

      const ShareIntent = requireShareIntent();
      const path = ShareIntent.getSharedImagePath("abc123.jpg");

      expect(path).toBe("file:///app-group/shared-images/abc123.jpg");
      expect(mockNativeModule!.getSharedImagePath).toHaveBeenCalledWith("abc123.jpg");
    });

    it("getSharedImagePath returns null for missing file", () => {
      mockNativeModule!.getSharedImagePath.mockReturnValue(null);

      const ShareIntent = requireShareIntent();
      const path = ShareIntent.getSharedImagePath("nonexistent.jpg");

      expect(path).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // iOS with native module throwing errors
  // ---------------------------------------------------------------
  describe("iOS with native module errors", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "ios" });
      mockNativeModule = {
        getSharedContent: jest.fn(() => {
          throw new Error("Native module error");
        }),
        clearSharedContent: jest.fn(() => {
          throw new Error("Native module error");
        }),
        getSharedImagePath: jest.fn(() => {
          throw new Error("Native module error");
        }),
      };
    });

    it("getSharedContent returns null when native module throws", () => {
      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();
      expect(content).toBeNull();
    });

    it("clearSharedContent does not throw when native module throws", () => {
      const ShareIntent = requireShareIntent();
      expect(() => ShareIntent.clearSharedContent()).not.toThrow();
    });

    it("getSharedImagePath returns null when native module throws", () => {
      const ShareIntent = requireShareIntent();
      const path = ShareIntent.getSharedImagePath("test.jpg");
      expect(path).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // iOS when native module is not available (not built)
  // ---------------------------------------------------------------
  describe("iOS without native module", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "ios" });
      mockNativeModule = null;
    });

    it("getSharedContent returns null gracefully", () => {
      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();
      expect(content).toBeNull();
    });

    it("clearSharedContent does not throw", () => {
      const ShareIntent = requireShareIntent();
      expect(() => ShareIntent.clearSharedContent()).not.toThrow();
    });

    it("getSharedImagePath returns null", () => {
      const ShareIntent = requireShareIntent();
      const path = ShareIntent.getSharedImagePath("test.jpg");
      expect(path).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // SharedContent interface validation
  // ---------------------------------------------------------------
  describe("SharedContent interface contract", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "ios" });
      mockNativeModule = {
        getSharedContent: jest.fn(),
        clearSharedContent: jest.fn(),
        getSharedImagePath: jest.fn(),
      };
    });

    it("handles extremely long text content", () => {
      const longText = "A".repeat(50000);
      mockNativeModule!.getSharedContent.mockReturnValue({
        text: longText,
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();
      expect(content).not.toBeNull();
      expect(content.text).toBe(longText);
      expect(content.text.length).toBe(50000);
    });

    it("handles content with all fields populated", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        url: "https://example.com",
        text: "Some text",
        images: ["img1.jpg", "img2.jpg", "img3.jpg"],
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.url).toBeDefined();
      expect(content.text).toBeDefined();
      expect(content.images).toBeDefined();
      expect(content.images.length).toBe(3);
      expect(content.timestamp).toBeDefined();
    });

    it("handles content with empty strings", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        url: "",
        text: "",
        images: [],
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();

      expect(content).not.toBeNull();
      expect(content.url).toBe("");
      expect(content.text).toBe("");
      expect(content.images).toEqual([]);
    });

    it("handles content with special characters in text", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        text: "Hello 🌍! Special chars: <>&\"'\\n\\t",
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();
      expect(content).not.toBeNull();
      expect(content.text).toContain("🌍");
    });

    it("handles content with unicode URL", () => {
      mockNativeModule!.getSharedContent.mockReturnValue({
        url: "https://example.com/路径/页面",
        timestamp: Date.now() / 1000,
      });

      const ShareIntent = requireShareIntent();
      const content = ShareIntent.getSharedContent();
      expect(content).not.toBeNull();
      expect(content.url).toContain("example.com");
    });
  });
});
