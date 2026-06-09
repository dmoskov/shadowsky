/**
 * Push Notification API Routes
 *
 * Handles push notification token registration and management.
 *
 * Security model:
 * - All endpoints require authentication (Cognito JWT or Bluesky DID).
 * - When authenticated via DID, a caller may only register/delete/send for
 *   their OWN did (ownership is enforced against req.auth.did).
 * - The bulk-list endpoint is restricted to admins (Cognito group "admin").
 *
 * Storage: DynamoDB when PUSH_TOKENS_TABLE is set (durable, shared across
 * ECS tasks); in-memory fallback otherwise. See utils/push-token-store.js.
 */

const express = require("express");
const router = express.Router();
const { requireCognitoAuth } = require("../middleware/cognito-auth");
const { moderateLimiter } = require("../middleware/rate-limit");
const { createPushTokenStore } = require("../utils/push-token-store");

// Push enabled flag - set to true to enable push notifications
const pushEnabled = true;

const pushTokenStore = createPushTokenStore();

/**
 * Returns true if the authenticated caller is allowed to act on `targetDid`.
 *
 * - DID-authenticated callers may only act on their own DID.
 * - Cognito-authenticated callers (admins/back-office) are not bound to a DID
 *   and are allowed through; admin-gating is applied separately where needed.
 */
function callerOwnsDid(req, targetDid) {
  const auth = req.auth || {};
  if (auth.method === "did") {
    return auth.did === targetDid;
  }
  // Cognito (non-DID) callers are not tied to a specific DID.
  return auth.method === "cognito";
}

/**
 * Returns true if the authenticated caller is a Cognito admin.
 */
function isAdmin(req) {
  const groups = req.auth && req.auth.groups;
  return Array.isArray(groups) && groups.includes("admin");
}

/**
 * POST /api/push-subscription
 * Register a new push subscription (own DID only)
 */
router.post(
  "/push-subscription",
  moderateLimiter,
  requireCognitoAuth(),
  async (req, res) => {
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

      if (!callerOwnsDid(req, did)) {
        return res.status(403).json({
          error: "You may only register a push token for your own account",
        });
      }

      // Store the push token
      await pushTokenStore.set(did, {
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
  },
);

/**
 * DELETE /api/push-subscription/:did
 * Delete a push subscription (own DID only)
 */
router.delete(
  "/push-subscription/:did",
  moderateLimiter,
  requireCognitoAuth(),
  async (req, res) => {
    if (!pushEnabled) {
      return res.status(503).json({
        error: "Push notifications are not enabled",
      });
    }

    try {
      const { did } = req.params;

      if (!callerOwnsDid(req, did)) {
        return res.status(403).json({
          error: "You may only unregister your own push token",
        });
      }

      const deleted = await pushTokenStore.delete(did);
      if (deleted) {
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
  },
);

/**
 * GET /api/push-subscriptions
 * Get all push subscriptions (admin only)
 */
router.get(
  "/push-subscriptions",
  moderateLimiter,
  requireCognitoAuth(),
  async (req, res) => {
    if (!pushEnabled) {
      return res.json({ subscriptions: [] });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    try {
      const subscriptions = await pushTokenStore.list();
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
  },
);

/**
 * POST /api/push-notification/send
 * Send a push notification (own DID only, or admin)
 */
router.post(
  "/push-notification/send",
  moderateLimiter,
  requireCognitoAuth(),
  async (req, res) => {
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

      if (!callerOwnsDid(req, did) && !isAdmin(req)) {
        return res.status(403).json({
          error: "You may only send a push notification to your own account",
        });
      }

      const subscription = await pushTokenStore.get(did);
      if (!subscription) {
        return res.status(404).json({
          error: "Push token not found for this user",
        });
      }

      // In a real implementation, you would send the push notification here
      // using the push-worker module
      console.log(`Would send push to ${subscription.pushToken}:`, {
        title,
        body,
        data,
      });

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
  },
);

/**
 * GET /api/push-notification/stats
 * Get push notification service statistics (admin only)
 */
router.get(
  "/push-notification/stats",
  moderateLimiter,
  requireCognitoAuth(),
  async (req, res) => {
    if (!pushEnabled) {
      return res.json({
        status: "disabled",
        message: "Push notifications are disabled",
      });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    try {
      res.json({
        status: "enabled",
        registeredDevices: await pushTokenStore.count(),
        message: "Push notifications are enabled",
      });
    } catch (error) {
      console.error("Error getting push notification stats:", error);
      res.status(500).json({
        error: "Failed to get push notification stats",
      });
    }
  },
);

// Export the token store for use by the push worker (async interface; see
// utils/push-token-store.js)
module.exports = router;
module.exports.pushTokenStore = pushTokenStore;
