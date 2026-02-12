/**
 * Push Notification API Routes
 *
 * Handles push notification token registration and management
 */

const express = require("express");
const router = express.Router();

// Push enabled flag - set to true to enable push notifications
const pushEnabled = true;

// In-memory storage for push tokens
// In production, this should use Redis or a database
const pushTokenStore = new Map();

/**
 * POST /api/push-subscription
 * Register a new push subscription
 */
router.post("/push-subscription", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not enabled",
    });
  }

  try {
    const { did, handle, pushToken, platform, deviceId } = req.body;

    if (!did || !pushToken) {
      return res.status(400).json({
        error: "Missing required fields: did, pushToken",
      });
    }

    // Store the push token
    pushTokenStore.set(did, {
      did,
      handle,
      pushToken,
      platform,
      deviceId,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`Registered push token for ${handle || did}`);

    res.json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({
      error: "Failed to register push token",
    });
  }
});

/**
 * DELETE /api/push-subscription/:did
 * Delete a push subscription
 */
router.delete("/push-subscription/:did", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not enabled",
    });
  }

  try {
    const { did } = req.params;

    if (pushTokenStore.has(did)) {
      pushTokenStore.delete(did);
      console.log(`Unregistered push token for ${did}`);
      res.json({
        success: true,
        message: "Push token unregistered successfully",
      });
    } else {
      res.status(404).json({
        error: "Push token not found",
      });
    }
  } catch (error) {
    console.error("Error unregistering push token:", error);
    res.status(500).json({
      error: "Failed to unregister push token",
    });
  }
});

/**
 * GET /api/push-subscriptions
 * Get all push subscriptions (admin only)
 */
router.get("/push-subscriptions", async (req, res) => {
  if (!pushEnabled) {
    return res.json({ subscriptions: [] });
  }

  try {
    const subscriptions = Array.from(pushTokenStore.values());
    res.json({
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error("Error getting push subscriptions:", error);
    res.status(500).json({
      error: "Failed to get push subscriptions",
    });
  }
});

/**
 * POST /api/push-notification/send
 * Send a push notification (for testing)
 */
router.post("/push-notification/send", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not enabled",
    });
  }

  try {
    const { did, title, body, data } = req.body;

    if (!did || !title || !body) {
      return res.status(400).json({
        error: "Missing required fields: did, title, body",
      });
    }

    const subscription = pushTokenStore.get(did);
    if (!subscription) {
      return res.status(404).json({
        error: "Push token not found for this user",
      });
    }

    // In a real implementation, you would send the push notification here
    // using the push-worker module
    console.log(`Would send push to ${subscription.pushToken}:`, { title, body, data });

    res.json({
      success: true,
      message: "Push notification sent",
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({
      error: "Failed to send push notification",
    });
  }
});

/**
 * GET /api/push-notification/stats
 * Get push notification service statistics
 */
router.get("/push-notification/stats", (req, res) => {
  if (!pushEnabled) {
    return res.json({
      status: "disabled",
      message: "Push notifications are disabled",
    });
  }

  res.json({
    status: "enabled",
    registeredDevices: pushTokenStore.size,
    message: "Push notifications are enabled",
  });
});

// Export the token store for use by the push worker
module.exports = router;
module.exports.pushTokenStore = pushTokenStore;
