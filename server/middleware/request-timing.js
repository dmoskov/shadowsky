/**
 * Request Timing Middleware
 *
 * Emits one structured JSON line per request so server performance can be
 * investigated retrospectively in CloudWatch Logs Insights — no metrics or
 * alarms to maintain. Example query over /ecs/shadowsky-api-server:
 *
 *   fields route, dur_ms
 *   | filter t = "req"
 *   | stats avg(dur_ms), pct(dur_ms, 95), max(dur_ms), count(*) by route
 *   | sort max(dur_ms) desc
 *
 * Always-on and negligible overhead (an hrtime diff + one log line). Slow
 * (>=1s) or failed (>=500) requests are logged at warn level so they stand
 * out in a filter. Health-check pings are skipped to avoid log spam.
 */

const SLOW_REQUEST_MS = 1000;

function requestTiming() {
  return (req, res, next) => {
    // Don't log load-balancer health pings — they'd drown out real traffic.
    if (req.path === "/health") return next();

    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);

      // Prefer the matched route pattern over the raw URL so query strings and
      // path params don't explode log cardinality.
      const route =
        req.route && req.baseUrl != null
          ? `${req.baseUrl}${req.route.path}`
          : req.originalUrl.split("?")[0];

      const entry = {
        t: "req",
        method: req.method,
        route,
        status: res.statusCode,
        dur_ms: durMs,
      };

      const line = JSON.stringify(entry);
      if (res.statusCode >= 500 || durMs >= SLOW_REQUEST_MS) {
        console.warn(line);
      } else {
        console.log(line);
      }
    });

    next();
  };
}

module.exports = { requestTiming };
