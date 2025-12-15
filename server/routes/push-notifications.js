/**
 * Push Notification API Routes (DISABLED)
 *
 * Push notifications have been removed from the system.
 * These endpoints remain for backward compatibility but return 503 errors.
 */

const express = require("express");
const router = express.Router();

const pushEnabled = false;

/**
 * POST /api/push-subscription
 * Register a new push subscription (DISABLED)
 */
router.post("/push-subscription", async (req, res) => {
  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * DELETE /api/push-subscription/:subscriptionId
 * Delete a push subscription (DISABLED)
 */
router.delete("/push-subscription/:subscriptionId", async (req, res) => {
  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * GET /api/push-subscriptions
 * Get all push subscriptions (DISABLED)
 */
router.get("/push-subscriptions", async (req, res) => {
  res.json({ subscriptions: [] });
});

/**
 * POST /api/push-notification/send
 * Send a push notification (DISABLED)
 */
router.post("/push-notification/send", async (req, res) => {
  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * GET /api/push/vapid-public-key
 * Get the VAPID public key (DISABLED)
 */
router.get("/push/vapid-public-key", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(503).json({
      error: "Push notifications are not configured",
    });
  }

  res.json({
    publicKey,
  });
});

/**
 * POST /api/push-notification/batch
 * Send batch push notifications (DISABLED)
 */
router.post("/push-notification/batch", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * POST /api/push-notification/dm
 * Send a DM notification (DISABLED)
 */
router.post("/push-notification/dm", async (req, res) => {
  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * POST /api/push-notification/system
 * Send a system notification (DISABLED)
 */
router.post("/push-notification/system", async (req, res) => {
  res.status(503).json({
    error: "Push notifications have been disabled",
  });
});

/**
 * GET /api/push-notification/stats
 * Get push notification service statistics (DISABLED)
 */
router.get("/push-notification/stats", (req, res) => {
  res.json({
    status: "disabled",
    message: "Push notifications have been removed",
  });
});

module.exports = router;
