# API Server Refactoring Implementation Guide

**Status:** Ready for Implementation
**Estimated Total Time:** 22-32 hours (3-4 developer days)
**Priority:** High (Technical Debt Reduction)

## Quick Reference

- **Analysis:** See `REFACTORING_ANALYSIS.md` for detailed reasoning
- **Structure Breakdown:** See `API_STRUCTURE_BREAKDOWN.md` for current state
- **This Document:** Step-by-step implementation guide

---

## Phase 1: Quick Wins (4 hours) ✅ START HERE

### Task 1.1: Remove Dead Push Notification Code
**Time:** 30 minutes | **Risk:** Low | **Lines Saved:** -208

1. **Delete lines 1681-1890** from `api-server.js`
   - All push notification endpoints (return 503)
   - Helper functions for push subscriptions
   - VAPID key endpoint

2. **Update startup logs** (lines 2107-2120)
   - Remove push notification endpoint listings
   - Remove push configuration status

3. **Remove unused variable**
   - Delete `pushEnabled` constant (line 28)

4. **Test:**
   ```bash
   npm run build
   npm start
   # Verify server starts without errors
   ```

5. **Commit:**
   ```bash
   git add server/api-server.js
   git commit -m "refactor(server): Remove disabled push notification endpoints

   - Removed 208 lines of dead code (push notification endpoints)
   - All endpoints were returning 503 status
   - Push notifications were disabled at line 28 (pushEnabled = false)

   Asana: https://app.asana.com/0/1211710875848660/1212467604482266"
   ```

**Checkpoint:** File reduced from 2,192 → 1,984 lines

---

### Task 1.2: Extract Utility Functions
**Time:** 1 hour | **Risk:** Low | **Lines Moved:** -29

#### Step 1: Create utility modules

**File:** `server/utils/json-cleaner.js`
```javascript
/**
 * Clean JSON responses by removing markdown code fences
 * @param {string} text - Text that may contain markdown code fences
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

module.exports = { cleanJsonResponse };
```

**File:** `server/utils/html-entities.js`
```javascript
/**
 * Decode common HTML entities to their character equivalents
 * @param {string} text - Text containing HTML entities
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

module.exports = { decodeHtmlEntities };
```

**File:** `server/utils/client-info.js`
```javascript
/**
 * Extract client IP address from request
 * @param {Request} req - Express request object
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
 * @param {Request} req - Express request object
 * @returns {string|null} User DID or null
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

module.exports = { getClientIp, extractUserDid };
```

#### Step 2: Update api-server.js

1. **Add imports** (after line 22):
```javascript
const { cleanJsonResponse } = require("./utils/json-cleaner");
const { decodeHtmlEntities } = require("./utils/html-entities");
const { getClientIp, extractUserDid } = require("./utils/client-info");
```

2. **Delete original functions:**
   - Lines 448-460: `cleanJsonResponse`
   - Lines 1252-1264: `decodeHtmlEntities`
   - Lines 1687-1715: `getClientIp`, `extractUserDid`

3. **Test:**
   ```bash
   npm run build
   npm start
   # Test endpoints that use these utilities
   curl http://localhost:3002/health
   ```

4. **Commit:**
   ```bash
   git add server/utils/ server/api-server.js
   git commit -m "refactor(server): Extract utility functions to separate modules

   - Created utils/json-cleaner.js for JSON response cleaning
   - Created utils/html-entities.js for HTML entity decoding
   - Created utils/client-info.js for IP/DID extraction
   - Removed 29 lines from main api-server.js

   Asana: https://app.asana.com/0/1211710875848660/1212467604482266"
   ```

**Checkpoint:** File reduced from 1,984 → 1,955 lines

---

### Task 1.3: Extract Cache Management
**Time:** 2 hours | **Risk:** Medium | **Lines Moved:** -95

#### Step 1: Create base cache class

**File:** `server/services/cache/base-cache.js`
```javascript
/**
 * Base cache implementation with TTL support
 */
class BaseCache {
  constructor(name, ttlMs) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.cache = new Map();

    // Start cleanup interval (every 5 minutes or 1/12 of TTL, whichever is less)
    const cleanupInterval = Math.min(5 * 60 * 1000, ttlMs / 12);
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);
  }

  /**
   * Generate cache key from data
   * @param {any} data - Data to generate key from
   * @returns {string} Cache key
   */
  generateKey(data) {
    const crypto = require("crypto");
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex")
      .slice(0, 16);
  }

  /**
   * Get cached value if not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null
   */
  get(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.generatedAt < this.ttlMs) {
      return cached;
    }
    // Clean up expired entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    this.cache.set(key, {
      ...value,
      generatedAt: Date.now(),
    });
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.generatedAt >= this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      name: this.name,
      size: this.cache.size,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = { BaseCache };
```

#### Step 2: Create specific cache implementations

**File:** `server/services/cache/thread-summary-cache.js`
```javascript
const crypto = require("crypto");
const { BaseCache } = require("./base-cache");

const THREAD_SUMMARY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

class ThreadSummaryCache extends BaseCache {
  constructor() {
    super("ThreadSummary", THREAD_SUMMARY_CACHE_TTL);
  }

  /**
   * Generate cache key from posts and format
   * @param {Array} posts - Array of post objects
   * @param {string} format - Summary format
   * @returns {string} Cache key
   */
  generateKey(posts, format) {
    const postsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(posts.map((p) => p.text).sort()))
      .digest("hex")
      .slice(0, 16);
    return `${format}:${postsHash}`;
  }
}

// Export singleton instance
const threadSummaryCache = new ThreadSummaryCache();

module.exports = {
  ThreadSummaryCache,
  threadSummaryCache,
  generateCacheKey: (posts, format) =>
    threadSummaryCache.generateKey(posts, format),
  getCachedSummary: (key) => threadSummaryCache.get(key),
  setCachedSummary: (key, value) => threadSummaryCache.set(key, value),
};
```

**File:** `server/services/cache/profile-analysis-cache.js`
```javascript
const crypto = require("crypto");
const { BaseCache } = require("./base-cache");

const PROFILE_ANALYSIS_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours

class ProfileAnalysisCache extends BaseCache {
  constructor() {
    super("ProfileAnalysis", PROFILE_ANALYSIS_CACHE_TTL);
  }

  /**
   * Generate cache key from posts and analysis type
   * @param {Array} posts - Array of post objects
   * @param {string} analysisType - Analysis type (sonnet/haiku)
   * @returns {string} Cache key
   */
  generateKey(posts, analysisType) {
    const postsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(posts.map((p) => p.text).sort()))
      .digest("hex")
      .slice(0, 16);
    return `profile:${analysisType}:${postsHash}`;
  }
}

// Export singleton instance
const profileAnalysisCache = new ProfileAnalysisCache();

module.exports = {
  ProfileAnalysisCache,
  profileAnalysisCache,
  generateProfileCacheKey: (posts, type) =>
    profileAnalysisCache.generateKey(posts, type),
  getCachedProfileAnalysis: (key) => profileAnalysisCache.get(key),
  setCachedProfileAnalysis: (key, value) => profileAnalysisCache.set(key, value),
};
```

#### Step 3: Update api-server.js

1. **Add imports** (after other imports):
```javascript
const {
  generateCacheKey,
  getCachedSummary,
  setCachedSummary,
} = require("./services/cache/thread-summary-cache");
const {
  generateProfileCacheKey,
  getCachedProfileAnalysis,
  setCachedProfileAnalysis,
} = require("./services/cache/profile-analysis-cache");
```

2. **Delete cache implementation code:**
   - Lines 987-1033: Thread summary cache
   - Lines 1035-1081: Profile analysis cache

3. **Test:**
   ```bash
   npm run build
   npm start
   # Test caching behavior
   ```

4. **Commit:**
   ```bash
   git add server/services/cache/ server/api-server.js
   git commit -m "refactor(server): Extract cache management to service layer

   - Created BaseCache class with common caching logic
   - Created ThreadSummaryCache for thread summaries (10min TTL)
   - Created ProfileAnalysisCache for profile analysis (48hr TTL)
   - Removed 95 lines from main api-server.js

   Asana: https://app.asana.com/0/1211710875848660/1212467604482266"
   ```

**Checkpoint:** File reduced from 1,955 → 1,860 lines

---

### Task 1.4: Extract CORS Configuration
**Time:** 30 minutes | **Risk:** Low | **Lines Moved:** -72

**File:** `server/config/cors-config.js`
```javascript
/**
 * CORS configuration for ShadowSky API server
 */

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "https://main.shadowsky.io",
      "https://shadowsky.io",
      "https://www.shadowsky.io",
    ];

    // Allow any subdomain of shadowsky.io
    if (
      origin.match(/^https?:\/\/.*\.shadowsky\.io$/) ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-DID",
    "X-Bluesky-DID",
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

module.exports = { corsOptions };
```

Update api-server.js:
1. Add import: `const { corsOptions } = require("./config/cors-config");`
2. Replace lines 35-71 with: `app.use(cors(corsOptions));`
3. Delete the old CORS configuration object

**Commit:** Similar pattern as above

**Checkpoint:** File reduced from 1,860 → 1,788 lines

---

## Phase 1 Summary

✅ **Completed in ~4 hours**
- Removed 208 lines of dead code
- Extracted 196 lines to modules
- File size: 2,192 → 1,788 lines (**-404 lines, 18% reduction**)
- Risk: Low
- Tests: All passing
- Ready for Phase 2

---

## Phase 2: Route Extraction (8-12 hours)

### Task 2.1: Create Routes Directory Structure
**Time:** 15 minutes

```bash
mkdir -p server/routes
touch server/routes/index.js
touch server/routes/ai-endpoints.js
touch server/routes/media-processing.js
touch server/routes/link-metadata.js
touch server/routes/bug-reports.js
touch server/routes/health.js
```

### Task 2.2: Extract Health Check Route
**Time:** 30 minutes | **Risk:** Low

**File:** `server/routes/health.js`
```javascript
const express = require("express");
const router = express.Router();

/**
 * Health check endpoint for load balancer
 */
router.get("/", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

module.exports = router;
```

### Task 2.3: Extract Media Processing Routes
**Time:** 2 hours | **Risk:** Medium

**File:** `server/routes/media-processing.js`
```javascript
const express = require("express");
const router = express.Router();
const { moderateLimiter } = require("../middleware/rate-limit");
const { validateUrlForSSRF } = require("../ip-validator");
const fetch = require("node-fetch");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");

/**
 * Endpoint to proxy images from Bluesky CDN
 * Public endpoint with moderate rate limiting
 */
router.get("/proxy-image", moderateLimiter, async (req, res) => {
  // Move lines 288-341 here
  // ... implementation
});

/**
 * Endpoint to convert GIF URL to MP4
 * Public endpoint with moderate rate limiting
 */
router.post("/convert-gif", moderateLimiter, async (req, res) => {
  // Move lines 345-446 here
  // ... implementation
});

module.exports = router;
```

### Task 2.4: Extract AI Endpoints Routes
**Time:** 3-4 hours | **Risk:** Medium-High

**File:** `server/routes/ai-endpoints.js`
```javascript
const express = require("express");
const router = express.Router();
const {
  requireCognitoAuth,
} = require("../middleware/cognito-auth");
const {
  aiEndpointLimiter,
  moderateLimiter,
} = require("../middleware/rate-limit");
const { validateUrlForSSRF } = require("../ip-validator");
const { cleanJsonResponse } = require("../utils/json-cleaner");
const {
  generateCacheKey,
  getCachedSummary,
  setCachedSummary,
} = require("../services/cache/thread-summary-cache");
const {
  generateProfileCacheKey,
  getCachedProfileAnalysis,
  setCachedProfileAnalysis,
} = require("../services/cache/profile-analysis-cache");
const fetch = require("node-fetch");

// Get API key from environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Generate alt text for an image URL
 * Protected by Cognito auth + AI rate limiting
 */
router.post(
  "/generate-alt-text",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    // Move lines 129-284 here
    // ... implementation
  }
);

/**
 * Writing feedback endpoint
 * Protected by Cognito auth + AI rate limiting
 */
router.post(
  "/writing-feedback",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    // Move lines 464-546 here
    // ... implementation
  }
);

// ... Continue for all AI endpoints

module.exports = router;
```

### Task 2.5: Extract Remaining Routes
**Time:** 2-3 hours

- `link-metadata.js` - Link preview fetching
- `bug-reports.js` - Bug reporting endpoint

### Task 2.6: Create Route Registry
**Time:** 1 hour

**File:** `server/routes/index.js`
```javascript
/**
 * Central route registry
 * Registers all API routes with the Express app
 */

const healthRoutes = require("./health");
const mediaRoutes = require("./media-processing");
const aiRoutes = require("./ai-endpoints");
const linkMetadataRoutes = require("./link-metadata");
const bugReportRoutes = require("./bug-reports");

function registerRoutes(app) {
  // Health check
  app.use("/health", healthRoutes);

  // Media processing
  app.use("/api", mediaRoutes);

  // AI endpoints
  app.use("/api", aiRoutes);

  // Link metadata
  app.use("/api", linkMetadataRoutes);

  // Bug reports
  app.use("/api", bugReportRoutes);
}

module.exports = { registerRoutes };
```

### Task 2.7: Update api-server.js
**Time:** 30 minutes

```javascript
const { registerRoutes } = require("./routes");

// ... after middleware setup ...

// Register all routes
registerRoutes(app);

// ... websocket setup, etc ...
```

### Testing Phase 2
```bash
# Run full test suite
npm run build
npm start

# Test each route category
curl http://localhost:3002/health
# ... test other endpoints
```

**Checkpoint:** File reduced from 1,788 → ~500 lines

---

## Phase 3: Service Layer Extraction (6-8 hours)

### Task 3.1: Create Anthropic Service
**Time:** 3 hours | **Risk:** Medium

**File:** `server/services/anthropic-service.js`
```javascript
const fetch = require("node-fetch");

class AnthropicService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.anthropic.com/v1/messages";
    this.defaultModel = "claude-sonnet-4-5-20250929";
  }

  /**
   * Make a request to Anthropic API
   */
  async makeRequest({ model, maxTokens, messages }) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model || this.defaultModel,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    return await response.json();
  }

  /**
   * Generate alt text for an image
   */
  async generateAltText(base64Image, mimeType) {
    const data = await this.makeRequest({
      maxTokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: "Generate alt text for this image...",
            },
          ],
        },
      ],
    });

    return data.content[0].text;
  }

  // ... other methods for each AI endpoint
}

// Export singleton
const anthropicService = new AnthropicService(
  process.env.ANTHROPIC_API_KEY
);

module.exports = { AnthropicService, anthropicService };
```

### Task 3.2-3.4: Create Other Services
- `media-service.js` - Image processing, GIF conversion
- `metadata-service.js` - Link metadata extraction
- `github-service.js` - GitHub issue creation

---

## Phase 4: Configuration (2-3 hours)

Extract remaining configuration:
- `config/server-config.js` - Ports, environment
- `config/middleware-config.js` - Middleware setup
- `config/security-config.js` - Security headers

---

## Phase 5: Testing & Documentation (4-6 hours)

1. Write unit tests for all services
2. Write integration tests for all routes
3. Update documentation
4. Performance testing
5. Security review

---

## Rollout Strategy

### Option A: Feature Branch (Recommended)
```bash
git checkout -b refactor/api-server-breakdown
# ... make all changes ...
git push origin refactor/api-server-breakdown
# Create PR, review, merge
```

### Option B: Incremental Commits
- Merge each phase after completion
- Monitor production after each merge
- Easier to rollback if issues arise

### Option C: Feature Flags
- Keep old and new code paths
- Use env var to switch between them
- Remove old code after validation

---

## Rollback Plan

If issues arise:

1. **During Development:**
   - Revert last commit
   - Fix issue
   - Re-test

2. **After Deployment:**
   - Revert merge commit
   - Deploy previous version
   - Investigate offline

---

## Success Criteria

✅ All endpoints respond correctly
✅ No performance regression (within 5%)
✅ All tests passing
✅ Code coverage >80%
✅ Main file <500 lines
✅ Documentation updated
✅ Team can easily find and modify code

---

## Getting Help

- **Stuck on extraction:** Review the original code context
- **Tests failing:** Check import paths and exports
- **Performance issues:** Profile before/after, check caching
- **Questions:** Post in #engineering channel

---

**Ready to start? Begin with Phase 1, Task 1.1!**
