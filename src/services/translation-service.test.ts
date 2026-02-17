import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearTranslationCache,
  getCachedTranslation,
  getLanguageName,
  getUserLanguage,
  needsTranslation,
  translatePost,
} from "./translation-service";

describe("translation-service", () => {
  afterEach(() => {
    clearTranslationCache();
    vi.restoreAllMocks();
  });

  describe("getUserLanguage", () => {
    it("returns the primary language subtag from navigator.language", () => {
      Object.defineProperty(navigator, "language", {
        value: "en-US",
        writable: true,
        configurable: true,
      });
      expect(getUserLanguage()).toBe("en");
    });

    it("handles simple language codes", () => {
      Object.defineProperty(navigator, "language", {
        value: "ja",
        writable: true,
        configurable: true,
      });
      expect(getUserLanguage()).toBe("ja");
    });
  });

  describe("needsTranslation", () => {
    it("returns false when postLangs is undefined", () => {
      expect(needsTranslation(undefined, "en")).toBe(false);
    });

    it("returns false when postLangs is empty", () => {
      expect(needsTranslation([], "en")).toBe(false);
    });

    it("returns false when post language matches user language", () => {
      expect(needsTranslation(["en"], "en")).toBe(false);
    });

    it("returns false when post has regional variant matching user language", () => {
      expect(needsTranslation(["en-US"], "en")).toBe(false);
    });

    it("returns true when post language differs from user language", () => {
      expect(needsTranslation(["ja"], "en")).toBe(true);
    });

    it("returns false when any post language matches user language", () => {
      expect(needsTranslation(["ja", "en"], "en")).toBe(false);
    });

    it("returns true when no post languages match user language", () => {
      expect(needsTranslation(["ja", "ko"], "en")).toBe(true);
    });

    it("handles case insensitivity", () => {
      expect(needsTranslation(["EN"], "en")).toBe(false);
    });
  });

  describe("getLanguageName", () => {
    it("returns human-readable name for known language codes", () => {
      expect(getLanguageName("en")).toBe("English");
      expect(getLanguageName("ja")).toBe("Japanese");
      expect(getLanguageName("es")).toBe("Spanish");
      expect(getLanguageName("de")).toBe("German");
      expect(getLanguageName("zh")).toBe("Chinese");
      expect(getLanguageName("ko")).toBe("Korean");
      expect(getLanguageName("fr")).toBe("French");
      expect(getLanguageName("pt")).toBe("Portuguese");
    });

    it("handles regional language codes", () => {
      expect(getLanguageName("en-US")).toBe("English");
      expect(getLanguageName("zh-CN")).toBe("Chinese");
      expect(getLanguageName("pt-BR")).toBe("Portuguese");
    });

    it("returns uppercase code for unknown languages", () => {
      expect(getLanguageName("zz")).toBe("ZZ");
    });
  });

  describe("translatePost", () => {
    it("calls Google Translate API and returns result", async () => {
      const mockResponse = [
        [["Hello", "Hola", null, null, null, null, null, []]],
        null,
        "es",
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await translatePost(
        "Hola",
        "es",
        "at://did:plc:abc/app.bsky.feed.post/123",
        "en",
      );

      expect(result.translatedText).toBe("Hello");
      expect(result.detectedSourceLang).toBe("es");
      expect(result.targetLang).toBe("en");
    });

    it("returns cached result on subsequent calls", async () => {
      const mockResponse = [
        [["Hello", "Hola", null, null, null, null, null, []]],
        null,
        "es",
      ];

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const postUri = "at://did:plc:abc/app.bsky.feed.post/cache-test";

      await translatePost("Hola", "es", postUri, "en");
      const cached = await translatePost("Hola", "es", postUri, "en");

      expect(cached.translatedText).toBe("Hello");
      // fetch should only be called once - second call uses cache
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("throws error on failed API response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as Response);

      await expect(
        translatePost(
          "Hola",
          "es",
          "at://did:plc:abc/app.bsky.feed.post/err",
          "en",
        ),
      ).rejects.toThrow("Translation failed: 429 Too Many Requests");
    });

    it("throws error on empty translation result", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => [[[null]]],
      } as Response);

      await expect(
        translatePost(
          "Test",
          "es",
          "at://did:plc:abc/app.bsky.feed.post/empty",
          "en",
        ),
      ).rejects.toThrow("Translation returned empty result");
    });
  });

  describe("getCachedTranslation", () => {
    it("returns undefined when no cached translation exists", () => {
      expect(
        getCachedTranslation(
          "at://did:plc:abc/app.bsky.feed.post/nocache",
          "en",
        ),
      ).toBeUndefined();
    });

    it("returns cached translation after translatePost", async () => {
      const mockResponse = [
        [["Bonjour", "Hello", null, null, null, null, null, []]],
        null,
        "en",
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const postUri = "at://did:plc:abc/app.bsky.feed.post/cached";
      await translatePost("Hello", "en", postUri, "fr");

      const cached = getCachedTranslation(postUri, "fr");
      expect(cached).toBeDefined();
      expect(cached?.translatedText).toBe("Bonjour");
    });
  });

  describe("clearTranslationCache", () => {
    it("clears all cached translations", async () => {
      const mockResponse = [
        [["Test", "Test", null, null, null, null, null, []]],
        null,
        "en",
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const postUri = "at://did:plc:abc/app.bsky.feed.post/clear";
      await translatePost("Test", "en", postUri, "fr");

      expect(getCachedTranslation(postUri, "fr")).toBeDefined();

      clearTranslationCache();

      expect(getCachedTranslation(postUri, "fr")).toBeUndefined();
    });
  });
});
