/**
 * Translation Service for Web
 *
 * Provides inline post translation using Google Translate API (free tier).
 * Caches translations to avoid redundant API calls.
 * Uses the AT Protocol `langs` field on posts for language detection.
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("TranslationService");

export interface TranslationResult {
  translatedText: string;
  detectedSourceLang: string;
  targetLang: string;
}

// In-memory translation cache keyed by `${postUri}:${targetLang}`
const translationCache = new Map<string, TranslationResult>();

// Maximum cache entries to prevent unbounded memory growth
const MAX_CACHE_SIZE = 500;

/**
 * Get the user's preferred language from the browser.
 * Returns a 2-letter ISO 639-1 code (e.g., "en", "ja", "es").
 */
export function getUserLanguage(): string {
  const lang =
    navigator.language ||
    (navigator as Navigator & { userLanguage?: string }).userLanguage ||
    "en";
  // Extract the primary language subtag (e.g., "en-US" → "en")
  return lang.split("-")[0].toLowerCase();
}

/**
 * Determine if a post needs translation based on its `langs` field.
 * Returns true if the post's language doesn't match the user's language.
 */
export function needsTranslation(
  postLangs: string[] | undefined,
  userLang?: string,
): boolean {
  if (!postLangs || postLangs.length === 0) {
    // No language tags → don't show translate button
    return false;
  }

  const targetLang = userLang || getUserLanguage();

  // Check if any of the post's languages match the user's language
  return !postLangs.some((lang) => {
    const postLangCode = lang.split("-")[0].toLowerCase();
    return postLangCode === targetLang;
  });
}

/**
 * Get a human-readable language name from an ISO 639-1 code.
 */
export function getLanguageName(langCode: string): string {
  const names: Record<string, string> = {
    af: "Afrikaans",
    ar: "Arabic",
    bg: "Bulgarian",
    bn: "Bengali",
    ca: "Catalan",
    cs: "Czech",
    da: "Danish",
    de: "German",
    el: "Greek",
    en: "English",
    es: "Spanish",
    et: "Estonian",
    fa: "Persian",
    fi: "Finnish",
    fr: "French",
    gu: "Gujarati",
    he: "Hebrew",
    hi: "Hindi",
    hr: "Croatian",
    hu: "Hungarian",
    id: "Indonesian",
    it: "Italian",
    ja: "Japanese",
    kn: "Kannada",
    ko: "Korean",
    lt: "Lithuanian",
    lv: "Latvian",
    mk: "Macedonian",
    ml: "Malayalam",
    mr: "Marathi",
    ms: "Malay",
    nb: "Norwegian",
    nl: "Dutch",
    no: "Norwegian",
    pl: "Polish",
    pt: "Portuguese",
    ro: "Romanian",
    ru: "Russian",
    sk: "Slovak",
    sl: "Slovenian",
    sq: "Albanian",
    sr: "Serbian",
    sv: "Swedish",
    sw: "Swahili",
    ta: "Tamil",
    te: "Telugu",
    th: "Thai",
    tl: "Filipino",
    tr: "Turkish",
    uk: "Ukrainian",
    ur: "Urdu",
    vi: "Vietnamese",
    zh: "Chinese",
  };
  const code = langCode.split("-")[0].toLowerCase();
  return names[code] || langCode.toUpperCase();
}

/**
 * Translate text using the server-side translation API.
 * Results are cached by post URI + target language.
 */
export async function translatePost(
  text: string,
  sourceLang: string,
  postUri: string,
  targetLang?: string,
): Promise<TranslationResult> {
  const target = targetLang || getUserLanguage();
  const cacheKey = `${postUri}:${target}`;

  // Check cache first
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use the Google Translate free API endpoint
    // This uses the same approach as Graysky's free tier
    const encodedText = encodeURIComponent(text);
    const sourceLangCode = sourceLang.split("-")[0].toLowerCase();
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLangCode}&tl=${target}&dt=t&q=${encodedText}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Translation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    // Google Translate returns nested arrays: [[["translated text","source text",...],...],...]
    let translatedText = "";
    if (Array.isArray(data) && Array.isArray(data[0])) {
      translatedText = (data[0] as Array<string[] | null>)
        .filter((segment): segment is string[] => !!segment && !!segment[0])
        .map((segment) => segment[0])
        .join("");
    }

    if (!translatedText) {
      throw new Error("Translation returned empty result");
    }

    const result: TranslationResult = {
      translatedText,
      detectedSourceLang: sourceLangCode,
      targetLang: target,
    };

    // Evict oldest entries if cache is full
    if (translationCache.size >= MAX_CACHE_SIZE) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) {
        translationCache.delete(firstKey);
      }
    }

    // Cache the result
    translationCache.set(cacheKey, result);

    return result;
  } catch (error) {
    logger.error("Translation error:", error);
    throw error;
  }
}

/**
 * Get a cached translation if available.
 */
export function getCachedTranslation(
  postUri: string,
  targetLang?: string,
): TranslationResult | undefined {
  const target = targetLang || getUserLanguage();
  return translationCache.get(`${postUri}:${target}`);
}

/**
 * Clear the translation cache.
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
