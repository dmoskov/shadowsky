/**
 * AI Denylist
 *
 * Blocks specific authenticated identities from the AI routes. Used to cut
 * off a caller identified as abusive (via the `t: "ai"` usage logs or an
 * Anthropic report keyed on metadata.user_id) without a code change:
 *
 *   AI_BLOCKED_DIDS="did:plc:abc...,did:plc:def..."
 *
 * Must run after the auth middleware so req.auth.userId is populated.
 */

let cachedRaw = null;
/** @type {Set<string>} */
let cachedSet = new Set();

/**
 * Parse AI_BLOCKED_DIDS, re-parsing only when the raw value changes.
 *
 * @returns {Set<string>}
 */
function blockedDids() {
  const raw = process.env.AI_BLOCKED_DIDS || "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = new Set(
      raw
        .split(",")
        .map((did) => did.trim())
        .filter(Boolean),
    );
  }
  return cachedSet;
}

/**
 * Express middleware: 403 for identities on the denylist.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function aiDenylist(req, res, next) {
  const userId = req.auth?.userId;
  if (userId && blockedDids().has(userId)) {
    console.warn(
      JSON.stringify({
        t: "ai",
        event: "blocked",
        user: userId,
        route: req.originalUrl?.split("?")[0],
      }),
    );
    return res.status(403).json({
      error: { code: "AI_ACCESS_BLOCKED", message: "AI features are disabled for this account" },
    });
  }
  next();
}

module.exports = { aiDenylist, blockedDids };
