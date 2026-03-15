/**
 * IP-based Rate Limiting Middleware for Express
 *
 * Provides configurable rate limiting to protect expensive API endpoints
 * from abuse while allowing legitimate usage.
 */

// In-memory store for rate limiting (consider Redis for production multi-instance)
const ipRequestCounts = new Map();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of ipRequestCounts.entries()) {
    if (now > data.windowEnd) {
      ipRequestCounts.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client IP address, handling proxies
 *
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  // Check X-Forwarded-For header (set by load balancers/proxies)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }

  // Fall back to direct connection IP
  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
}

/**
 * Create rate limiting middleware
 *
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.maxRequests - Maximum requests per window (default: 10)
 * @param {string} options.keyPrefix - Prefix for the rate limit key (default: "default")
 * @param {Function} options.keyGenerator - Custom function to generate rate limit key (default: uses IP)
 * @param {string} options.message - Error message when rate limited (default: "Too many requests")
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests (default: false)
 * @param {Function} options.skip - Function to skip rate limiting for certain requests (default: null)
 * @returns {Function} Express middleware function
 */
function rateLimit(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 10,
    keyPrefix = "default",
    keyGenerator = null,
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
    skip = null,
  } = options;

  return async (req, res, next) => {
    // Allow skipping rate limiting for certain requests
    if (skip && (await skip(req))) {
      return next();
    }

    // Generate rate limit key
    const ip = getClientIp(req);
    const key = keyGenerator ? keyGenerator(req) : `${keyPrefix}:${ip}`;

    const now = Date.now();
    let data = ipRequestCounts.get(key);

    // Initialize or reset window
    if (!data || now > data.windowEnd) {
      data = {
        count: 0,
        windowEnd: now + windowMs,
        firstRequest: now,
      };
    }

    // Increment count
    data.count++;
    ipRequestCounts.set(key, data);

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, maxRequests - data.count);
    const resetTime = Math.ceil((data.windowEnd - now) / 1000);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);

    // Check if rate limited
    if (data.count > maxRequests) {
      res.setHeader("Retry-After", resetTime);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message,
          retryAfter: resetTime,
        },
      });
    }

    // Decrement count on successful response if configured
    if (skipSuccessfulRequests) {
      res.on("finish", () => {
        if (res.statusCode < 400) {
          const currentData = ipRequestCounts.get(key);
          if (currentData && currentData.count > 0) {
            currentData.count--;
            ipRequestCounts.set(key, currentData);
          }
        }
      });
    }

    next();
  };
}

/**
 * Preconfigured rate limiters for different endpoint types
 */

// Rate limiting for AI endpoints (30 requests per minute)
const aiEndpointLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
  keyPrefix: "ai",
  message:
    "AI generation rate limit exceeded. Please wait before making more requests.",
});

// Moderate rate limiting for semi-expensive endpoints (60 requests per minute)
const moderateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 60,
  keyPrefix: "moderate",
  message: "Rate limit exceeded. Please slow down.",
});

// Lenient rate limiting for general endpoints (100 requests per minute)
const generalLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 100,
  keyPrefix: "general",
  message: "Rate limit exceeded. Please try again later.",
});

// Very strict limiter for auth-related endpoints (3 requests per minute)
const authLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 3,
  keyPrefix: "auth",
  message: "Too many authentication attempts. Please wait before trying again.",
});

/**
 * Get current rate limit stats for an IP
 *
 * @param {string} keyPrefix - The rate limit key prefix
 * @param {string} ip - The IP address to check
 * @returns {Object|null} Rate limit data or null if not found
 */
function getRateLimitStats(keyPrefix, ip) {
  const key = `${keyPrefix}:${ip}`;
  return ipRequestCounts.get(key) || null;
}

module.exports = {
  rateLimit,
  getClientIp,
  aiEndpointLimiter,
  moderateLimiter,
  generalLimiter,
  authLimiter,
  getRateLimitStats,
};
