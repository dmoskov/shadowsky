/**
 * Cache Management Utilities
 *
 * Provides in-memory caching for API responses to reduce load on AI services
 * and improve response times for repeated requests.
 */

const crypto = require("crypto");

// =============================================================================
// Thread Summary Cache (10-minute TTL)
// =============================================================================
const threadSummaryCache = new Map();
const THREAD_SUMMARY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

function generateCacheKey(posts, format) {
  // Create a stable cache key from posts content and format
  const postsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(posts.map((p) => p.text).sort()))
    .digest("hex")
    .slice(0, 16);
  return `${format}:${postsHash}`;
}

function getCachedSummary(cacheKey) {
  const cached = threadSummaryCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < THREAD_SUMMARY_CACHE_TTL) {
    return cached;
  }
  // Clean up expired entry
  if (cached) {
    threadSummaryCache.delete(cacheKey);
  }
  return null;
}

function setCachedSummary(cacheKey, result) {
  threadSummaryCache.set(cacheKey, {
    ...result,
    generatedAt: Date.now(),
  });
}

// Periodic cache cleanup (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of threadSummaryCache.entries()) {
      if (now - value.generatedAt >= THREAD_SUMMARY_CACHE_TTL) {
        threadSummaryCache.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

// =============================================================================
// Profile Analysis Cache (48-hour TTL)
// =============================================================================
const profileAnalysisCache = new Map();
const PROFILE_ANALYSIS_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

function generateProfileCacheKey(posts, analysisType) {
  // Create a stable cache key from posts content and analysis type
  const postsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(posts.map((p) => p.text).sort()))
    .digest("hex")
    .slice(0, 16);
  return `profile:${analysisType}:${postsHash}`;
}

function getCachedProfileAnalysis(cacheKey) {
  const cached = profileAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < PROFILE_ANALYSIS_CACHE_TTL) {
    return cached;
  }
  // Clean up expired entry
  if (cached) {
    profileAnalysisCache.delete(cacheKey);
  }
  return null;
}

function setCachedProfileAnalysis(cacheKey, result) {
  profileAnalysisCache.set(cacheKey, {
    ...result,
    generatedAt: Date.now(),
  });
}

// Periodic cache cleanup for profile analysis (every hour)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of profileAnalysisCache.entries()) {
      if (now - value.generatedAt >= PROFILE_ANALYSIS_CACHE_TTL) {
        profileAnalysisCache.delete(key);
      }
    }
  },
  60 * 60 * 1000,
);

module.exports = {
  // Thread summary cache
  generateCacheKey,
  getCachedSummary,
  setCachedSummary,

  // Profile analysis cache
  generateProfileCacheKey,
  getCachedProfileAnalysis,
  setCachedProfileAnalysis,
};
