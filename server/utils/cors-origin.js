/**
 * Pure CORS origin policy.
 *
 * Extracted from api-server.js so the allow/deny decision is unit-testable.
 * Rejection must NOT throw: throwing in the cors() origin callback routes
 * every bot request through the Express 500 handler and emits a stack trace
 * per request, drowning out real errors in the logs.
 */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  // shadowsky.io (legacy — keep until all clients migrate to asphodel.is)
  "https://main.shadowsky.io",
  "https://shadowsky.io",
  "https://www.shadowsky.io",
  // asphodel.is (canonical)
  "https://asphodel.is",
  "https://www.asphodel.is",
  "https://main.asphodel.is",
];

// Any https subdomain of these zones is allowed (branch previews, etc.).
const ALLOWED_SUBDOMAIN_PATTERNS = [
  /^https:\/\/[^/]+\.shadowsky\.io$/,
  /^https:\/\/[^/]+\.asphodel\.is$/,
];

/**
 * Decide whether a request origin is allowed.
 *
 * @param {string | undefined} origin - The Origin header value; undefined for
 *   same-origin, curl, and native mobile requests (which are allowed).
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_SUBDOMAIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Build the `origin` callback for the cors() middleware.
 *
 * @param {{ log?: (line: string) => void }} [options] - Injectable logger for tests.
 * @returns {(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void}
 */
function makeCorsOriginHandler(options = {}) {
  const log = options.log || ((line) => console.log(line));
  return function corsOrigin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      // Log a single short line instead of throwing — see module comment.
      log(JSON.stringify({ t: "cors_reject", origin }));
      callback(null, false);
    }
  };
}

module.exports = { isAllowedOrigin, makeCorsOriginHandler, ALLOWED_ORIGINS };
