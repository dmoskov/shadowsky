import { enUS, ptBR, ja } from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "./index";

const DATE_LOCALE_MAP: Record<string, Locale> = {
  en: enUS,
  "pt-BR": ptBR,
  "ja-JP": ja,
};

/**
 * Returns the date-fns Locale object matching the current i18n language.
 * Falls back to enUS if no match is found.
 */
export function getDateLocale(): Locale {
  const lang = i18n.language;
  return DATE_LOCALE_MAP[lang] ?? enUS;
}
