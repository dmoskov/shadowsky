/**
 * Trending API Routes
 *
 * Endpoints for accessing trending hashtags and topics
 * aggregated from the Bluesky firehose.
 */

const express = require("express");
const router = express.Router();

// Service reference (set during initialization)
let trendingService = null;

/**
 * Initialize the trending routes with a service reference
 * @param {{ aggregator: import('../firehose/trending-aggregator').TrendingAggregator, consumer: import('../firehose/consumer').FirehoseConsumer }} service
 */
function initTrendingRoutes(service) {
  trendingService = service;
}

/**
 * GET /api/v1/trending
 * Returns top trending hashtags and topics.
 *
 * Query params:
 *   - window: "1h" | "6h" | "24h" (default: "1h")
 *   - limit: number 1-50 (default: 20)
 *
 * Response:
 *   {
 *     window: "1h",
 *     items: [{ item: "#topic", count: 123, type: "hashtag" }],
 *     updatedAt: "2026-03-10T12:00:00Z"
 *   }
 */
router.get("/trending", (req, res) => {
  if (!trendingService || !trendingService.aggregator) {
    return res.status(503).json({
      error: "Trending service is not available",
      message: "The firehose consumer has not been initialized",
    });
  }

  const window = req.query.window || "1h";
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  if (!["1h", "6h", "24h"].includes(window)) {
    return res.status(400).json({
      error: "Invalid window parameter",
      message: "Valid values: 1h, 6h, 24h",
    });
  }

  try {
    const items = trendingService.aggregator.getTrending(window, limit);

    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");

    res.json({
      window,
      items,
      count: items.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve trending data",
    });
  }
});

/**
 * GET /api/v1/trending/all
 * Returns trending data for all time windows at once.
 *
 * Response:
 *   {
 *     windows: {
 *       "1h": [...],
 *       "6h": [...],
 *       "24h": [...]
 *     },
 *     updatedAt: "2026-03-10T12:00:00Z"
 *   }
 */
router.get("/trending/all", (req, res) => {
  if (!trendingService || !trendingService.aggregator) {
    return res.status(503).json({
      error: "Trending service is not available",
    });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  try {
    const windows = trendingService.aggregator.getAllTrending(limit);

    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");

    res.json({
      windows,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve trending data",
    });
  }
});

/**
 * GET /api/v1/trending/stats
 * Returns metrics about the firehose consumer and aggregator.
 * Useful for monitoring and debugging.
 */
router.get("/trending/stats", (req, res) => {
  if (!trendingService) {
    return res.status(503).json({
      error: "Trending service is not available",
    });
  }

  const consumerMetrics = trendingService.consumer.getMetrics();
  const aggregatorMetrics = trendingService.aggregator.getMetrics();

  res.json({
    consumer: consumerMetrics,
    aggregator: aggregatorMetrics,
    updatedAt: new Date().toISOString(),
  });
});

module.exports = router;
module.exports.initTrendingRoutes = initTrendingRoutes;
