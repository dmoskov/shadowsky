import { formatDistanceToNow as fnsFormatDistanceToNow, format as fnsFormat } from "date-fns";
import type { Locale } from "date-fns";
import { getDateLocale } from "./date-locale";

/**
 * Locale-aware wrapper around date-fns formatDistanceToNow.
 * Automatically uses the current app locale.
 */
export function formatDistanceToNow(
  date: Date | number,
  options?: { addSuffix?: boolean; locale?: Locale },
): string {
  return fnsFormatDistanceToNow(date, {
    locale: getDateLocale(),
    ...options,
  });
}

/**
 * Locale-aware wrapper around date-fns format.
 * Automatically uses the current app locale.
 */
export function format(
  date: Date | number,
  formatStr: string,
  options?: { locale?: Locale },
): string {
  return fnsFormat(date, formatStr, {
    locale: getDateLocale(),
    ...options,
  });
}
