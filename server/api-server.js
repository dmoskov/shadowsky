const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const { WebSocketNotificationServer } = require("./websocket-server");
const { apiVersionHeader } = require("./middleware/api-version");
const { requestTiming } = require("./middleware/request-timing");

// Route modules
const aiRoutes = require("./routes/ai");
const mediaRoutes = require("./routes/media");
const utilityRoutes = require("./routes/utility");
const pushRoutes = require("./routes/push-notifications");
const loggingRoutes = require("./routes/logging");

// Load environment variables from parent directory's .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3002;
const WS_PORT = process.env.WS_PORT || 3001;

// Structured per-request timing (one JSON line/request) for retrospective
// performance investigation via CloudWatch Logs Insights. Registered first so
// it captures the full request lifecycle.
app.use(requestTiming());

// Enable CORS for your Vite dev server and production domains
app.use(
  cors({
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
        "https://asphodel.is",
        "https://www.asphodel.is",
      ];

      // Allow any subdomain of shadowsky.io or asphodel.is
      if (
        origin.match(/^https:\/\/.*\.shadowsky\.io$/) ||
        origin.match(/^https:\/\/.*\.asphodel\.is$/) ||
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
  }),
);

// Increase JSON payload size limit for base64-encoded images
app.use(express.json({ limit: "50mb" }));

// Response compression middleware
// Compresses responses to improve load times on slow networks
app.use(
  compression({
    level: 6, // Good balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Skip compression for already-compressed content types
      const contentType = res.getHeader("Content-Type") || "";
      const skipTypes = [
        "image/",
        "video/",
        "audio/",
        "application/zip",
        "application/gzip",
        "application/x-gzip",
        "application/x-compress",
        "application/x-compressed",
      ];

      // Check if content type matches any skip types
      if (skipTypes.some((type) => contentType.includes(type))) {
        return false;
      }

      // Use default compression filter for other content
      return compression.filter(req, res);
    },
  }),
);

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // XSS protection (legacy but still useful for older browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Health check endpoint for load balancer
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

// =============================================================================
// API Version Info Endpoint
// =============================================================================
app.get("/api/version", (req, res) => {
  const { API_VERSIONS, CURRENT_VERSION } = require("./middleware/api-version");
  res.json({
    current: CURRENT_VERSION,
    versions: API_VERSIONS,
    deprecated: [],
  });
});

// =============================================================================
// Versioned API Routes (v1)
// =============================================================================
// All /api/v1/* routes include version headers
app.use("/api/v1", apiVersionHeader("v1"), aiRoutes);
app.use("/api/v1", apiVersionHeader("v1"), mediaRoutes);
app.use("/api/v1", apiVersionHeader("v1"), utilityRoutes);
app.use("/api/v1", apiVersionHeader("v1"), pushRoutes);
app.use("/api/v1", apiVersionHeader("v1"), loggingRoutes);

// =============================================================================
// Backward-Compatible Unversioned Routes
// =============================================================================
// These /api/* routes exist for backward compatibility with existing clients.
// They alias to v1 routes and include a Deprecation header encouraging
// clients to migrate to /api/v1/*.
// Once all clients have migrated, these can be removed.
app.use("/api", apiVersionHeader("v1"), aiRoutes);
app.use("/api", apiVersionHeader("v1"), mediaRoutes);
app.use("/api", apiVersionHeader("v1"), utilityRoutes);
app.use("/api", apiVersionHeader("v1"), pushRoutes);
app.use("/api", apiVersionHeader("v1"), loggingRoutes);

// =============================================================================
// Firehose Trending Service
// =============================================================================

// Create HTTP server for Express app
const httpServer = http.createServer(app);

// Start HTTP server for API
httpServer.listen(PORT, () => {
  console.log(`ShadowSky API server running on port ${PORT}`);
  console.log(`\nAPI Versioning:`);
  console.log(`  - /api/v1/*  : Current stable API (v1)`);
  console.log(
    `  - /api/*     : Backward-compatible alias (deprecated, maps to v1)`,
  );
  console.log(`  - /api/version : API version info`);
  console.log(`\nAvailable v1 endpoints:`);
  console.log(`  AI & Content:`);
  console.log(`  - POST /api/v1/generate-alt-text`);
  console.log(`  - POST /api/v1/writing-feedback`);
  console.log(`  - POST /api/v1/style-analysis`);
  console.log(`  - POST /api/v1/adjust-tone`);
  console.log(`  - POST /api/v1/optimize-thread`);
  console.log(`  - POST /api/v1/suggest-hashtags`);
  console.log(`  - POST /api/v1/analyze-posts`);
  console.log(`  - POST /api/v1/thread-summary`);
  console.log(`  Media:`);
  console.log(`  - GET  /api/v1/proxy-image`);
  console.log(`  - POST /api/v1/convert-gif`);
  console.log(`  Utility:`);
  console.log(`  - POST /api/v1/fetch-link-metadata`);
  console.log(`  - POST /api/v1/bug-report`);
  console.log(`  - POST /api/v1/log-error`);
  console.log(`  Push Notifications:`);
  console.log(`  - POST /api/v1/push-subscription`);
  console.log(`  - DELETE /api/v1/push-subscription/:did`);
  console.log(`  - GET  /api/v1/push-subscriptions`);
  console.log(`  - POST /api/v1/push-notification/send`);
  console.log(`  - GET  /api/v1/push-notification/stats`);
  console.log(`  Trending:`);
  console.log(`  - GET  /api/v1/trending`);
  console.log(`  - GET  /api/v1/trending/all`);
  console.log(`  - GET  /api/v1/trending/stats`);
  console.log(
    `\nAPI Configuration:`,
    process.env.ANTHROPIC_API_KEY
      ? `✓ Anthropic API key loaded`
      : `✗ Anthropic API key not found`,
  );
  const cloudWatchStatus = loggingRoutes.getCloudWatchStatus
    ? loggingRoutes.getCloudWatchStatus()
    : { available: false };
  console.log(
    `CloudWatch Logging:`,
    cloudWatchStatus.available
      ? `✓ CloudWatch client initialized`
      : `✗ CloudWatch not available (local logging only)`,
  );
});

// Create separate HTTP server for WebSocket with health check endpoint
const wsHttpServer = http.createServer((req, res) => {
  // Health check endpoint for ALB
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }
  // All other HTTP requests get 426 Upgrade Required
  res.writeHead(426, { "Content-Type": "text/plain" });
  res.end("WebSocket connection required");
});

// Initialize WebSocket server
const wsServer = new WebSocketNotificationServer(wsHttpServer, {
  heartbeatInterval: 30000,
  pollInterval: 15000,
  debug: true,
});

// Start WebSocket server
wsHttpServer.listen(WS_PORT, () => {
  console.log(`\nWebSocket server running on ws://localhost:${WS_PORT}`);
  console.log(`   - Heartbeat interval: 30s`);
  console.log(`   - Notification polling: 15s`);
  console.log(`   - Authentication: JWT via query parameter`);
  console.log(
    `\nTo connect from frontend, set in .env: VITE_WS_URL=ws://localhost:${WS_PORT}`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\nSIGTERM received, shutting down gracefully...");
  if (trendingServiceInstance) {
    trendingServiceInstance.shutdown();
    console.log("Trending service stopped");
  }
  wsServer.close();
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
  wsHttpServer.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received, shutting down gracefully...");
  if (trendingServiceInstance) {
    trendingServiceInstance.shutdown();
    console.log("Trending service stopped");
  }
  wsServer.close();
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
  wsHttpServer.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});
