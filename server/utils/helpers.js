/**
 * Helper Utilities
 *
 * Common utility functions used across the API server.
 */

/**
 * Clean JSON responses by removing markdown code fences
 *
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Decode HTML entities in text
 *
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

/**
 * Get client IP address from request
 *
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    "unknown"
  );
}

/**
 * Extract user DID from Authorization header
 * Supports: Bearer <jwt> or DID:<did>
 *
 * @param {Object} req - Express request object
 * @returns {string|null} DID or null if not found
 */
function extractUserDid(req) {
  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }

  // Support DID directly in header (e.g., "DID:did:plc:...")
  if (auth.startsWith("DID:")) {
    return auth.slice(4);
  }

  // Support Bearer token (would need JWT verification in production)
  // For now, client can pass DID in x-user-did header as fallback
  return req.headers["x-user-did"] || null;
}

module.exports = {
  cleanJsonResponse,
  decodeHtmlEntities,
  getClientIp,
  extractUserDid,
};
