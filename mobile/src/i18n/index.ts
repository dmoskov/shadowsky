import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import jaJP from "./locales/ja-JP.json";

const resources = {
  en: {
    translation: en,
  },
  "pt-BR": {
    translation: ptBR,
  },
  "ja-JP": {
    translation: jaJP,
  },
};

/**
 * Supported app UI locales.
 */
export const SUPPORTED_LOCALES = [
  { code: "system", label: "System", nativeLabel: "System" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "pt-BR", label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" },
  { code: "ja-JP", label: "Japanese", nativeLabel: "日本語" },
] as const;

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

/**
 * Resolve the device locale to a supported i18next language tag.
 * Matches full tags first (e.g. "pt-BR"), then base language (e.g. "pt" → "pt-BR"),
 * falling back to "en".
 */
function resolveDeviceLocale(): string {
  const deviceLocales = Localization.getLocales();
  for (const locale of deviceLocales) {
    const tag = locale.languageTag; // e.g. "pt-BR", "ja-JP", "en-US"
    // Exact match
    if (tag && resources[tag as keyof typeof resources]) {
      return tag;
    }
    // Base language match (e.g. "pt" → "pt-BR", "ja" → "ja-JP")
    const base = locale.languageCode;
    if (base) {
      const match = Object.keys(resources).find(
        (key) => key === base || key.startsWith(`${base}-`),
      );
      if (match) return match;
    }
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLocale(),
  fallbackLng: "en",
  compatibilityJSON: "v4",
  debug: false,
  interpolation: {
    escapeValue: false,
  },
});

/**
 * Change the app language at runtime. Pass "system" to auto-detect from device.
 */
export function setAppLanguage(code: string): void {
  const lng = code === "system" ? resolveDeviceLocale() : code;
  i18n.changeLanguage(lng);
}

/**
 * Get the currently active i18n language code.
 */
export function getActiveLanguage(): string {
  return i18n.language;
}

export default i18n;
