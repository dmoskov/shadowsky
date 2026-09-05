/**
 * AI Token Budgets
 *
 * Request-count rate limits (middleware/rate-limit.js) bound how OFTEN a
 * caller can hit the AI routes; this bounds how MUCH they can spend. Three
 * independent caps, all in tokens:
 *
 *   - per request: estimated input size, rejected before calling Anthropic
 *   - per user per UTC day: actual input+output tokens reported by the API
 *   - global per UTC day: the service-wide circuit breaker
 *
 * Counters are in-memory (one ECS task today; see api_desired_count). If the
 * service scales out, move them to DynamoDB/Redis — as with the rate limiter,
 * each task otherwise gets its own full budget.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Rough chars-per-token for English prose; used only for the pre-call check.
const CHARS_PER_TOKEN = 4;

/**
 * Read a positive integer from the environment, falling back to a default.
 *
 * @param {string} name
 * @param {number} fallback
 */
function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

class AiBudgetExceededError extends Error {
  /**
   * @param {"request" | "user" | "global"} scope
   * @param {string} message
   * @param {number} retryAfterSeconds
   */
  constructor(scope, message, retryAfterSeconds) {
    super(message);
    this.name = "AiBudgetExceededError";
    this.code = "AI_BUDGET_EXCEEDED";
    this.scope = scope;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Estimate the token count of a prompt for the pre-call check.
 *
 * @param {number} chars - Total characters of text content
 * @param {number} [images] - Number of image blocks (~1.6k tokens each at
 *   Anthropic's max image size)
 */
function estimateTokens(chars, images = 0) {
  return Math.ceil(chars / CHARS_PER_TOKEN) + images * 1600;
}

/**
 * @typedef {Object} BudgetOptions
 * @property {number} userDailyTokens
 * @property {number} globalDailyTokens
 * @property {number} maxRequestTokens
 * @property {() => number} [now]
 */

/**
 * Create an isolated budget tracker.
 *
 * @param {BudgetOptions} options
 */
function createAiBudget(options) {
  const { userDailyTokens, globalDailyTokens, maxRequestTokens } = options;
  const now = options.now || Date.now;

  /** @type {Map<string, { day: number, tokens: number }>} */
  const userUsage = new Map();
  let globalUsage = { day: -1, tokens: 0 };

  function currentDay() {
    return Math.floor(now() / DAY_MS);
  }

  function secondsUntilReset() {
    const nextDayStart = (currentDay() + 1) * DAY_MS;
    return Math.max(1, Math.ceil((nextDayStart - now()) / 1000));
  }

  function userTokensToday(userId) {
    const entry = userUsage.get(userId);
    return entry && entry.day === currentDay() ? entry.tokens : 0;
  }

  function globalTokensToday() {
    return globalUsage.day === currentDay() ? globalUsage.tokens : 0;
  }

  /**
   * Throw if `estimatedTokens` would push the request, user, or service over
   * budget. Call before contacting Anthropic.
   *
   * @param {string} userId
   * @param {number} estimatedTokens
   */
  function check(userId, estimatedTokens) {
    if (estimatedTokens > maxRequestTokens) {
      throw new AiBudgetExceededError(
        "request",
        `Request too large: ~${estimatedTokens} tokens exceeds the ${maxRequestTokens}-token limit`,
        0,
      );
    }

    if (globalTokensToday() + estimatedTokens > globalDailyTokens) {
      throw new AiBudgetExceededError(
        "global",
        "AI features are temporarily unavailable: the daily service budget has been reached",
        secondsUntilReset(),
      );
    }

    if (userTokensToday(userId) + estimatedTokens > userDailyTokens) {
      throw new AiBudgetExceededError(
        "user",
        "You have reached your daily AI usage limit",
        secondsUntilReset(),
      );
    }
  }

  /**
   * Record actual usage reported by the API.
   *
   * @param {string} userId
   * @param {number} tokens - input + output tokens
   */
  function record(userId, tokens) {
    const day = currentDay();

    const entry = userUsage.get(userId);
    if (entry && entry.day === day) {
      entry.tokens += tokens;
    } else {
      userUsage.set(userId, { day, tokens });
    }

    if (globalUsage.day === day) {
      globalUsage.tokens += tokens;
    } else {
      globalUsage = { day, tokens };
    }
  }

  /** Drop counters from previous days so the map doesn't grow unbounded. */
  function prune() {
    const day = currentDay();
    for (const [userId, entry] of userUsage) {
      if (entry.day !== day) userUsage.delete(userId);
    }
  }

  function stats(userId) {
    return {
      userTokensToday: userTokensToday(userId),
      userDailyTokens,
      globalTokensToday: globalTokensToday(),
      globalDailyTokens,
      maxRequestTokens,
    };
  }

  return { check, record, prune, stats };
}

// Defaults are deliberately generous so legitimate heavy users are not cut
// off; they exist to cap the blast radius of a leaked credential or a bug,
// not to meter normal use. Tune via env in infra/site/ecs.tf.
const defaultAiBudget = createAiBudget({
  userDailyTokens: envInt("AI_USER_DAILY_TOKEN_BUDGET", 500_000),
  globalDailyTokens: envInt("AI_GLOBAL_DAILY_TOKEN_BUDGET", 25_000_000),
  maxRequestTokens: envInt("AI_MAX_REQUEST_TOKENS", 120_000),
});

const pruneTimer = setInterval(() => defaultAiBudget.prune(), 60 * 60 * 1000);
pruneTimer.unref?.();

module.exports = {
  AiBudgetExceededError,
  createAiBudget,
  defaultAiBudget,
  estimateTokens,
};
