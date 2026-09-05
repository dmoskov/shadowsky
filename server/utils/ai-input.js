/**
 * AI Route Input Validation
 *
 * Every value that ends up inside a prompt is caller-controlled (and, for
 * thread/profile analysis, controlled by OTHER Bluesky users whose posts the
 * caller is analyzing). These helpers bound size and shape before anything
 * reaches the model: over-long inputs cost money, and unconstrained enums
 * like `tone` were previously interpolated straight into the prompt.
 *
 * All helpers throw AiInputError (HTTP 400) with a message naming the field.
 */

class AiInputError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "AiInputError";
    this.code = "INVALID_INPUT";
    this.status = 400;
  }
}

/**
 * Read a string field, trimming and truncating to `max` characters (or
 * rejecting over-long values when `overflow` is "reject" — for inputs like
 * a base64 image where a silently truncated value would be corrupt).
 *
 * @param {unknown} value
 * @param {{ name: string, max: number, required?: boolean, overflow?: "truncate" | "reject" }} opts
 * @returns {string} The string, or "" when optional and absent
 */
function readString(value, opts) {
  const { name, max, required = true, overflow = "truncate" } = opts;

  if (value === undefined || value === null || value === "") {
    if (required) throw new AiInputError(`Missing ${name}`);
    return "";
  }

  if (typeof value !== "string") {
    throw new AiInputError(`${name} must be a string`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new AiInputError(`Missing ${name}`);
  }

  if (trimmed.length > max) {
    if (overflow === "reject") {
      throw new AiInputError(`${name} is too large (max ${max} characters)`);
    }
    return trimmed.slice(0, max);
  }

  return trimmed;
}

/**
 * Read an array of strings, capping item count and per-item length.
 * Non-string items are coerced with String() to match prior behavior.
 *
 * @param {unknown} value
 * @param {{ name: string, maxItems: number, maxItemChars: number, required?: boolean }} opts
 * @returns {string[]}
 */
function readStringArray(value, opts) {
  const { name, maxItems, maxItemChars, required = true } = opts;

  if (value === undefined || value === null) {
    if (required) throw new AiInputError(`Missing or invalid ${name} array`);
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AiInputError(`Missing or invalid ${name} array`);
  }

  if (required && value.length === 0) {
    throw new AiInputError(`${name} array cannot be empty`);
  }

  return value
    .slice(0, maxItems)
    .map((item) => String(item ?? "").slice(0, maxItemChars));
}

/**
 * Read a value that must be one of a fixed set of options.
 *
 * @template {string} T
 * @param {unknown} value
 * @param {{ name: string, allowed: readonly T[], fallback?: T }} opts
 * @returns {T}
 */
function readEnum(value, opts) {
  const { name, allowed, fallback } = opts;

  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new AiInputError(`Missing ${name}`);
  }

  if (typeof value !== "string" || !allowed.includes(/** @type {T} */ (value))) {
    throw new AiInputError(
      `Invalid ${name}: must be one of ${allowed.join(", ")}`,
    );
  }

  return /** @type {T} */ (value);
}

/**
 * Read an integer clamped to [min, max].
 *
 * @param {unknown} value
 * @param {{ name: string, min: number, max: number, fallback: number }} opts
 * @returns {number}
 */
function readInt(value, opts) {
  const { name, min, max, fallback } = opts;

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AiInputError(`${name} must be a number`);
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

module.exports = {
  AiInputError,
  readString,
  readStringArray,
  readEnum,
  readInt,
};
