/**
 * API Version Middleware
 *
 * Adds version information to API responses and provides version negotiation.
 * This enables backward compatibility for deployed mobile clients.
 *
 * Strategy: URL-prefix versioning (/api/v1/, /api/v2/, etc.)
 * - /api/v1/* routes are the current stable API
 * - /api/* routes are aliased to /api/v1/ for backward compatibility
 * - All responses include X-API-Version header
 * - Clients should migrate to versioned endpoints (/api/v1/...)
 *
 * When a breaking change is needed:
 * 1. Create new route files or version the existing ones
 * 2. Mount them under /api/v2/
 * 3. Keep /api/v1/ routes working for deployed iOS clients
 * 4. Update /api/ alias to point to the latest version
 */

const API_VERSIONS = {
  v1: "1.0.0",
};

const CURRENT_VERSION = "v1";
const CURRENT_VERSION_STRING = API_VERSIONS[CURRENT_VERSION];

/**
 * Middleware that adds API version headers to responses
 *
 * @param {string} version - The API version (e.g., "v1")
 * @returns {Function} Express middleware
 */
function apiVersionHeader(version = CURRENT_VERSION) {
  const versionString = API_VERSIONS[version] || CURRENT_VERSION_STRING;

  return (req, res, next) => {
    res.setHeader("X-API-Version", versionString);
    res.setHeader("X-API-Version-Label", version);

    // Add deprecation warning for unversioned /api/ access
    if (!req.originalUrl.match(/^\/api\/v\d+\//)) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Sunset", "2026-12-31");
      res.setHeader("Link", `</api/v1${req.path}>; rel="successor-version"`);
    }

    next();
  };
}

module.exports = {
  apiVersionHeader,
  API_VERSIONS,
  CURRENT_VERSION,
  CURRENT_VERSION_STRING,
};
