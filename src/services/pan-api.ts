/**
 * Shared Pan API client.
 *
 * Pan (the firehose narrative/sentiment service) backs trending and Network
 * Weather. All callers share one circuit breaker: when every endpoint fails
 * (404 because the routes aren't deployed, 5xx, or network errors), Pan is
 * skipped entirely with exponential backoff so prod consoles and the API
 * hosts aren't hammered with doomed requests. Success resets the breaker.
 */

import { debug } from "@bsky/shared";

const PAN_API_URLS = ["https://api.shadowsky.io", "https://api.asphodel.is"];

const FETCH_TIMEOUT = 8000;
const BACKOFF_BASE_MS = 5 * 60 * 1000; // 5 min
const BACKOFF_MAX_MS = 60 * 60 * 1000; // 1 hour cap

let failedUntil = 0;
let consecutiveFailures = 0;

/** True while the breaker is open and Pan calls are being skipped. */
export function panUnavailable(): boolean {
  return Date.now() < failedUntil;
}

/**
 * Fetch JSON from the first reachable Pan endpoint, or null when Pan is
 * unavailable (breaker open or all endpoints failed). Callers treat null as
 * "feature degrades silently".
 */
export async function fetchFromPan(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown | null> {
  if (panUnavailable()) return null;

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  const qs = query.toString() ? `?${query.toString()}` : "";

  for (const baseUrl of PAN_API_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const resp = await fetch(`${baseUrl}${path}${qs}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        debug.log(`Pan API ${baseUrl}${path} returned ${resp.status}`);
        continue;
      }
      consecutiveFailures = 0;
      return await resp.json();
    } catch {
      debug.log(`Pan API ${baseUrl} unreachable for ${path}`);
    }
  }

  consecutiveFailures++;
  const backoff = Math.min(
    BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1),
    BACKOFF_MAX_MS,
  );
  failedUntil = Date.now() + backoff;
  debug.log(
    `Pan API unavailable; backing off ${Math.round(backoff / 60000)}min`,
  );
  return null;
}
