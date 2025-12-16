# API Server Structure Breakdown

**File:** `server/api-server.js`
**Total Lines:** 2,192
**Analysis Date:** 2025-12-16

## Line-by-Line Responsibility Map

```
Lines    | Responsibility                    | Size  | Complexity
---------|-----------------------------------|-------|------------
1-25     | Imports & Dependencies            | 25    | Low
26-32    | Environment & Config              | 7     | Low
34-105   | CORS Configuration                | 72    | Medium
106-118  | Security Headers Middleware       | 13    | Low
120-125  | Health Check Endpoint             | 6     | Low

=== AI/CLAUDE ENDPOINTS (859 lines) ===
127-284  | Alt Text Generation               | 158   | High
286-341  | Image Proxy                       | 56    | Medium
343-446  | GIF to MP4 Conversion            | 104   | High
448-460  | JSON Cleaner Utility              | 13    | Low
462-546  | Writing Feedback                  | 85    | Medium
548-644  | Style Analysis                    | 97    | Medium
646-708  | Adjust Tone                       | 63    | Medium
710-775  | Optimize Thread                   | 66    | Medium
777-840  | Suggest Hashtags                  | 64    | Medium
842-985  | Analyze Posts                     | 144   | High

=== CACHING (95 lines) ===
987-1033 | Thread Summary Cache              | 47    | Medium
1035-1081| Profile Analysis Cache            | 47    | Medium

=== LINK METADATA (182 lines) ===
1083-1264| Fetch Link Metadata               | 182   | High

=== THREAD SUMMARY (414 lines) ===
1266-1679| Thread Summary Endpoint           | 414   | VERY HIGH

=== PUSH NOTIFICATIONS - DISABLED (208 lines) ===
1681-1696| Push Helpers                      | 16    | Low
1736-1752| Subscription Endpoints (disabled) | 17    | Low
1748-1763| Get Subscriptions (disabled)      | 16    | Low
1771-1776| Send Notification (disabled)      | 6     | Low
1784-1796| VAPID Key Endpoint                | 13    | Low
1815-1834| Batch Notifications (disabled)    | 20    | Low
1852-1857| DM Notifications (disabled)       | 6     | Low
1872-1877| System Notifications (disabled)   | 6     | Low
1884-1890| Stats Endpoint (disabled)         | 7     | Low

=== BUG REPORTING (192 lines) ===
1892-2083| Bug Report Endpoint               | 192   | High

=== SERVER BOOTSTRAP (109 lines) ===
2085-2086| HTTP Server Creation              | 2     | Low
2088-2135| API Server Startup                | 48    | Low
2137-2166| WebSocket Server Setup            | 30    | Medium
2168-2191| Graceful Shutdown Handlers        | 24    | Low
```

## Responsibility Distribution

### By Category

| Category                  | Lines | Percentage | Complexity |
|---------------------------|-------|------------|------------|
| AI/Claude Endpoints       | 859   | 39.2%      | High       |
| Thread Summary (single!)  | 414   | 18.9%      | Very High  |
| Push Notifications (dead) | 208   | 9.5%       | Low        |
| Bug Reporting             | 192   | 8.8%       | High       |
| Link Metadata             | 182   | 8.3%       | High       |
| Server Bootstrap          | 109   | 5.0%       | Medium     |
| Caching                   | 95    | 4.3%       | Medium     |
| CORS & Security           | 85    | 3.9%       | Low        |
| Config & Setup            | 32    | 1.5%       | Low        |
| Utilities                 | 16    | 0.7%       | Low        |

### Insights

1. **Thread Summary Endpoint = 414 lines (19% of entire file!)**
   - Single endpoint handler with massive complexity
   - Complex filtering, caching, parsing logic
   - Should be broken into 5-8 smaller functions

2. **AI Endpoints = 859 lines (39% of file)**
   - 9 separate endpoints with similar patterns
   - Repeated Anthropic API call logic
   - Should be extracted to routes + service layer

3. **Dead Code = 208 lines (10% of file)**
   - Push notification endpoints that always return 503
   - Should be removed entirely
   - Easy win: -208 lines

4. **Utilities Scattered Throughout**
   - JSON cleaner at line 448
   - HTML decoder at line 1252
   - IP/DID extractors at line 1687
   - Should be consolidated

## Endpoint Count by Category

```
Health:                1 endpoint   (GET /health)
AI/Claude:            9 endpoints   (POST /api/*)
Media:                2 endpoints   (POST, GET)
Link Metadata:        1 endpoint    (POST /api/fetch-link-metadata)
Push Notifications:   9 endpoints   (all disabled)
Bug Reporting:        1 endpoint    (POST /api/bug-report)
------------------------------------------------------
Total:               23 endpoints
Active:              14 endpoints
Disabled:             9 endpoints
```

## Code Smell Indicators

### 1. Function Length
- Thread summary handler: ~414 lines (CRITICAL)
- Alt text generation: ~158 lines (HIGH)
- Link metadata fetch: ~182 lines (HIGH)
- Bug report: ~192 lines (HIGH)

**Recommendation:** No function should exceed 50 lines

### 2. Nesting Depth
- Thread summary has 4-5 levels of nesting
- Bug report has 3-4 levels of nesting
- Alt text generation has 3-4 levels of nesting

**Recommendation:** Extract nested logic to separate functions

### 3. Repeated Patterns
- Anthropic API calls: 8 occurrences with same pattern
- Cache key generation: 2 similar implementations
- Error handling: Repeated try-catch patterns
- SSRF validation: 4 occurrences

**Recommendation:** Extract to reusable functions/services

### 4. Mixed Concerns
- Routing + business logic + caching in same functions
- Configuration + implementation in same file
- Server bootstrap + route handlers in same file

**Recommendation:** Separate concerns into layers

## Complexity Hotspots

### Critical (Refactor Immediately)
1. **Thread Summary Endpoint** (lines 1266-1679)
   - 414 lines
   - Multiple responsibilities
   - Complex filtering logic
   - Cache management mixed in
   - API call + parsing

2. **Alt Text Generation** (lines 127-284)
   - 158 lines
   - Complex URL handling
   - SSRF validation
   - Base64 processing
   - API integration

### High (Refactor Soon)
3. **Bug Report Handler** (lines 1892-2083)
   - 192 lines
   - GitHub API integration
   - Complex validation
   - Multiple data transformations

4. **Link Metadata Fetch** (lines 1083-1264)
   - 182 lines
   - HTML parsing
   - URL resolution
   - Multiple regex patterns

5. **Analyze Posts** (lines 842-985)
   - 144 lines
   - Two different analysis modes
   - Cache management
   - Complex prompt construction

## Quick Wins (Low Risk, High Impact)

### 1. Remove Dead Code (-208 lines)
**Effort:** 30 minutes
**Risk:** Low
**Files:** Lines 1681-1890

```javascript
// Delete these disabled endpoints:
- POST /api/push-subscription
- DELETE /api/push-subscription/:id
- GET /api/push-subscriptions
- POST /api/push-notification/send
- POST /api/push-notification/batch
- POST /api/push-notification/dm
- POST /api/push-notification/system
- GET /api/push-notification/stats
- GET /api/push/vapid-public-key
```

### 2. Extract Utilities (-29 lines from main logic)
**Effort:** 1 hour
**Risk:** Low

```javascript
// utils/json-cleaner.js
export function cleanJsonResponse(text) { /* ... */ }

// utils/html-entities.js
export function decodeHtmlEntities(text) { /* ... */ }

// utils/client-info.js
export function getClientIp(req) { /* ... */ }
export function extractUserDid(req) { /* ... */ }
```

### 3. Extract Cache Classes (-95 lines)
**Effort:** 2 hours
**Risk:** Low-Medium

```javascript
// services/cache/thread-summary-cache.js
// services/cache/profile-analysis-cache.js
```

### 4. Extract CORS Config (-72 lines)
**Effort:** 30 minutes
**Risk:** Low

```javascript
// config/cors-config.js
export const corsOptions = { /* ... */ };
```

**Total Quick Wins: -404 lines (18% reduction) in ~4 hours**

## Dependencies Between Sections

```
Server Setup
    ├─> CORS Config
    ├─> Middleware (compression, security)
    └─> Route Handlers
            ├─> AI Endpoints
            │     └─> Anthropic API (external)
            │     └─> Caching
            ├─> Media Processing
            │     └─> ffmpeg (external)
            ├─> Link Metadata
            │     └─> fetch (external)
            └─> Bug Reporting
                  └─> GitHub API (external)

WebSocket Server (separate)
    └─> WebSocketNotificationServer (imported)

Utilities (used by all)
    ├─> cleanJsonResponse
    ├─> decodeHtmlEntities
    ├─> getClientIp
    └─> extractUserDid
```

## Refactoring Sequence

### Step 1: Non-Breaking Extractions
1. Remove dead code (push notifications)
2. Extract utilities to separate files
3. Extract cache managers
4. Extract CORS config

**Result:** Main file reduced from 2,192 → ~1,400 lines

### Step 2: Route Extraction
1. Extract AI endpoints router
2. Extract media processing router
3. Extract bug report router
4. Extract link metadata router

**Result:** Main file reduced from ~1,400 → ~500 lines

### Step 3: Service Layer
1. Create anthropic-service.js
2. Create media-service.js
3. Create github-service.js
4. Create metadata-service.js

**Result:** Business logic separated from routing

### Step 4: Cleanup
1. Organize imports
2. Add JSDoc comments
3. Create tests
4. Update documentation

**Result:** Maintainable, well-documented codebase

## Testing Checklist

Before refactoring:
- [ ] Document all endpoint responses
- [ ] Create integration test suite
- [ ] Establish performance baseline
- [ ] Document cache behavior

During refactoring:
- [ ] Unit test each extracted module
- [ ] Integration tests remain green
- [ ] No performance regression
- [ ] Cache behavior unchanged

After refactoring:
- [ ] All tests pass
- [ ] Code coverage >80%
- [ ] Performance within 5% of baseline
- [ ] Documentation updated

## Success Metrics

| Metric                    | Current | Target | Progress |
|---------------------------|---------|--------|----------|
| Main file size            | 2,192   | <500   | 0%       |
| Largest function          | 414     | <50    | 0%       |
| Cyclomatic complexity     | High    | <10    | 0%       |
| Dead code lines           | 208     | 0      | 0%       |
| Test coverage             | ?       | >80%   | 0%       |
| Number of route files     | 1       | 6+     | 0%       |
| Number of service files   | 0       | 4+     | 0%       |
| Utility modules           | 0       | 4+     | 0%       |

---

**Last Updated:** 2025-12-16
**Status:** Analysis Complete - Ready for Implementation
**Next Step:** Review with team and get approval to proceed
