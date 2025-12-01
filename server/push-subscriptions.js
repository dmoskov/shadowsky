/**
 * Push Subscription Manager
 *
 * Handles storage and management of Web Push notification subscriptions
 * with user DID association.
 */

const webpush = require("web-push");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

// Subscription storage file (in production, use a proper database)
const SUBSCRIPTIONS_FILE = path.join(__dirname, ".push-subscriptions.json");

// Rate limiting: max subscriptions per user
const MAX_SUBSCRIPTIONS_PER_USER = 5;

// Rate limiting: subscription creation per minute per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 subscriptions per minute per IP

/**
 * Initialize web-push with VAPID keys
 */
function initWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@shadowsky.io";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn(
      "⚠️  VAPID keys not configured. Push notifications will be disabled.",
    );
    console.warn("   Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env");
    return false;
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log("✓ Web Push configured with VAPID keys");
    return true;
  } catch (error) {
    console.error("Failed to configure web-push:", error.message);
    return false;
  }
}

/**
 * Load subscriptions from storage
 */
async function loadSubscriptions() {
  try {
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      // File doesn't exist, return empty structure
      return { subscriptions: {}, byEndpoint: {} };
    }
    throw error;
  }
}

/**
 * Save subscriptions to storage
 */
async function saveSubscriptions(data) {
  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate a unique subscription ID
 */
function generateSubscriptionId() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Clean old entries
  if (rateLimitMap.has(ip)) {
    const timestamps = rateLimitMap.get(ip).filter((t) => t > windowStart);
    rateLimitMap.set(ip, timestamps);
  }

  const timestamps = rateLimitMap.get(ip) || [];

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

/**
 * Validate push subscription payload
 */
function validateSubscriptionPayload(payload) {
  const errors = [];

  if (!payload) {
    return { valid: false, errors: ["Payload is required"] };
  }

  if (!payload.endpoint || typeof payload.endpoint !== "string") {
    errors.push("endpoint is required and must be a string");
  } else {
    // Validate endpoint URL
    try {
      const url = new URL(payload.endpoint);
      // Only allow HTTPS endpoints (except localhost for development)
      if (
        url.protocol !== "https:" &&
        !url.hostname.includes("localhost") &&
        url.hostname !== "127.0.0.1"
      ) {
        errors.push("endpoint must use HTTPS");
      }
    } catch {
      errors.push("endpoint must be a valid URL");
    }
  }

  if (!payload.keys || typeof payload.keys !== "object") {
    errors.push("keys object is required");
  } else {
    if (!payload.keys.p256dh || typeof payload.keys.p256dh !== "string") {
      errors.push("keys.p256dh is required and must be a string");
    }
    if (!payload.keys.auth || typeof payload.keys.auth !== "string") {
      errors.push("keys.auth is required and must be a string");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new push subscription
 *
 * @param {Object} subscription - The push subscription payload
 * @param {string} userDid - The user's DID (decentralized identifier)
 * @param {string} clientIp - The client's IP address for rate limiting
 * @returns {Object} Result with subscriptionId or error
 */
async function createSubscription(subscription, userDid, clientIp) {
  // Validate payload
  const validation = validateSubscriptionPayload(subscription);
  if (!validation.valid) {
    return {
      success: false,
      error: "Invalid subscription payload",
      details: validation.errors,
    };
  }

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return {
      success: false,
      error: "Rate limit exceeded. Please try again later.",
    };
  }

  // Load existing subscriptions
  const data = await loadSubscriptions();

  // Check if endpoint already exists
  if (data.byEndpoint[subscription.endpoint]) {
    const existingId = data.byEndpoint[subscription.endpoint];
    // Update the existing subscription (user might have cleared browser data)
    return updateSubscription(existingId, subscription, userDid);
  }

  // Check max subscriptions per user
  const userSubscriptions = Object.entries(data.subscriptions)
    .filter(([_, sub]) => sub.userDid === userDid)
    .map(([id, _]) => id);

  if (userSubscriptions.length >= MAX_SUBSCRIPTIONS_PER_USER) {
    // Remove oldest subscription
    const oldestId = userSubscriptions[0];
    delete data.byEndpoint[data.subscriptions[oldestId].endpoint];
    delete data.subscriptions[oldestId];
    console.log(
      `Removed oldest subscription ${oldestId} for user ${userDid} (limit reached)`,
    );
  }

  // Create new subscription
  const subscriptionId = generateSubscriptionId();
  const now = Date.now();

  data.subscriptions[subscriptionId] = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime || null,
    userAgent: subscription.userAgent || "unknown",
    userDid: userDid || "anonymous",
    createdAt: subscription.createdAt || now,
    updatedAt: now,
  };

  data.byEndpoint[subscription.endpoint] = subscriptionId;

  await saveSubscriptions(data);

  console.log(
    `Created push subscription ${subscriptionId} for user ${userDid || "anonymous"}`,
  );

  return {
    success: true,
    subscriptionId,
  };
}

/**
 * Update an existing push subscription
 */
async function updateSubscription(subscriptionId, subscription, userDid) {
  const data = await loadSubscriptions();

  if (!data.subscriptions[subscriptionId]) {
    return {
      success: false,
      error: "Subscription not found",
    };
  }

  // Update the subscription
  data.subscriptions[subscriptionId] = {
    ...data.subscriptions[subscriptionId],
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime || null,
    userAgent: subscription.userAgent || "unknown",
    userDid: userDid || data.subscriptions[subscriptionId].userDid,
    updatedAt: Date.now(),
  };

  await saveSubscriptions(data);

  console.log(`Updated push subscription ${subscriptionId}`);

  return {
    success: true,
    subscriptionId,
  };
}

/**
 * Delete a push subscription
 */
async function deleteSubscription(subscriptionId, userDid) {
  const data = await loadSubscriptions();

  const subscription = data.subscriptions[subscriptionId];
  if (!subscription) {
    return { success: true }; // Already deleted
  }

  // Verify ownership if userDid provided
  if (userDid && subscription.userDid !== userDid) {
    return {
      success: false,
      error: "Not authorized to delete this subscription",
    };
  }

  delete data.byEndpoint[subscription.endpoint];
  delete data.subscriptions[subscriptionId];

  await saveSubscriptions(data);

  console.log(`Deleted push subscription ${subscriptionId}`);

  return { success: true };
}

/**
 * Get subscriptions for a user
 */
async function getSubscriptionsForUser(userDid) {
  const data = await loadSubscriptions();

  return Object.entries(data.subscriptions)
    .filter(([_, sub]) => sub.userDid === userDid)
    .map(([id, sub]) => ({
      subscriptionId: id,
      userAgent: sub.userAgent,
      createdAt: sub.createdAt,
      expirationTime: sub.expirationTime,
    }));
}

/**
 * Send push notification to a user
 */
async function sendPushNotification(userDid, payload) {
  const data = await loadSubscriptions();

  const userSubscriptions = Object.entries(data.subscriptions).filter(
    ([_, sub]) => sub.userDid === userDid,
  );

  if (userSubscriptions.length === 0) {
    return {
      success: false,
      error: "No subscriptions found for user",
    };
  }

  const results = await Promise.allSettled(
    userSubscriptions.map(async ([id, sub]) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify(payload),
        );
        return { id, success: true };
      } catch (error) {
        // Handle expired subscriptions
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`Subscription ${id} expired, removing...`);
          await deleteSubscription(id);
        }
        return { id, success: false, error: error.message };
      }
    }),
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value.success,
  ).length;
  const failed = results.length - sent;

  return {
    success: sent > 0,
    sent,
    failed,
  };
}

/**
 * Send push notification to all users (for system announcements)
 */
async function broadcastPushNotification(payload) {
  const data = await loadSubscriptions();
  const subscriptions = Object.entries(data.subscriptions);

  if (subscriptions.length === 0) {
    return {
      success: false,
      error: "No subscriptions found",
    };
  }

  let sent = 0;
  let failed = 0;

  for (const [id, sub] of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await deleteSubscription(id);
      }
      failed++;
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
  };
}

module.exports = {
  initWebPush,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionsForUser,
  sendPushNotification,
  broadcastPushNotification,
  validateSubscriptionPayload,
};
