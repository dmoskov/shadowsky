/**
 * Pure formatting helpers shared by the web and mobile apps.
 *
 * These are deliberately dependency-free so they bundle identically under Vite
 * (web) and Metro (mobile). They consolidate copies previously duplicated across
 * both codebases. Names are intentionally specific to avoid the historical
 * collision where two different "formatDate" helpers coexisted (a month-year
 * formatter and a relative-time formatter).
 */

/** Format a count with K/M suffixes, e.g. 1500 -> "1.5K". */
export function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/** Format a date as a "Month YYYY" label, e.g. "January 2026" (e.g. join date). */
export function formatJoinDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a date as a compact relative time, e.g. "just now", "5m", "3h", "2d".
 * Falls back to a locale date string after a week.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return d.toLocaleDateString();
}
