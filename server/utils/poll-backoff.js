/**
 * Pure backoff/scheduling logic for notification polling.
 *
 * Extracted from websocket-server.js so the 429 exponential backoff behavior
 * (added after a production rate-limiting incident) is unit-testable.
 */

const BACKOFF_CAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Compute the next backoff after a 429 response.
 *
 * Doubles the previous backoff, seeded from the regular poll interval on the
 * first 429, and capped at BACKOFF_CAP_MS.
 *
 * @param {number} prevBackoffMs - Current backoff (0 or undefined if none).
 * @param {number} pollIntervalMs - The regular poll interval.
 * @returns {number} The next backoff in milliseconds.
 */
function nextBackoff(prevBackoffMs, pollIntervalMs) {
  const prev = prevBackoffMs || pollIntervalMs;
  return Math.min(prev * 2, BACKOFF_CAP_MS);
}

/**
 * Compute the delay until the next poll.
 *
 * When backing off, applies ±20% jitter so that many users rate-limited at
 * the same moment don't all retry simultaneously (thundering herd). When not
 * backing off, returns the regular poll interval unchanged.
 *
 * @param {number} backoffMs - Current backoff (0 when not rate limited).
 * @param {number} pollIntervalMs - The regular poll interval.
 * @param {() => number} [random] - Random source in [0, 1); injectable for tests.
 * @returns {number} Delay in milliseconds until the next poll.
 */
function computePollDelay(backoffMs, pollIntervalMs, random = Math.random) {
  if (!backoffMs || backoffMs <= 0) {
    return pollIntervalMs;
  }
  const jitter = backoffMs * 0.2 * (random() * 2 - 1);
  return Math.round(backoffMs + jitter);
}

module.exports = { nextBackoff, computePollDelay, BACKOFF_CAP_MS };
