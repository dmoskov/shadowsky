/**
 * Push Notification Delivery Service
 *
 * Handles server-side delivery of Web Push notifications when browser is closed.
 * Integrates with the WebSocket notification system for seamless delivery.
 *
 * RFC 8291 Web Push Protocol implementation using web-push library.
 */

const pushSubscriptions = require("./push-subscriptions");

// Batch notification queue for efficiency
const batchQueue = new Map(); // Map<userDid, { notifications: [], timer: NodeJS.Timeout }>
const BATCH_DELAY = 1000; // 1 second delay for batching
const MAX_BATCH_SIZE = 10; // Max notifications per batch

// Track users with active WebSocket connections (don't send push if they're online)
const activeWebSocketUsers = new Set();

/**
 * Notification type to display configuration mapping
 */
const NOTIFICATION_CONFIG = {
  like: {
    getTitle: (notification) =>
      `${getAuthorName(notification)} liked your post`,
    getBody: (notification) =>
      truncateText(
        notification.record?.subject?.text || "Your post received a like",
        100,
      ),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `like:${notification.uri}`,
    reason: "like",
  },
  repost: {
    getTitle: (notification) =>
      `${getAuthorName(notification)} reposted your post`,
    getBody: (notification) =>
      truncateText(
        notification.record?.subject?.text || "Your post was reposted",
        100,
      ),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `repost:${notification.uri}`,
    reason: "repost",
  },
  follow: {
    getTitle: (notification) => `${getAuthorName(notification)} followed you`,
    getBody: (notification) =>
      notification.author?.description
        ? truncateText(notification.author.description, 100)
        : "You have a new follower",
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `follow:${notification.uri}`,
    reason: "follow",
  },
  mention: {
    getTitle: (notification) => `${getAuthorName(notification)} mentioned you`,
    getBody: (notification) =>
      truncateText(
        notification.record?.text || "You were mentioned in a post",
        100,
      ),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `mention:${notification.uri}`,
    reason: "mention",
    requireInteraction: true,
  },
  reply: {
    getTitle: (notification) => `${getAuthorName(notification)} replied to you`,
    getBody: (notification) =>
      truncateText(notification.record?.text || "You received a reply", 100),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `reply:${notification.uri}`,
    reason: "reply",
    requireInteraction: true,
  },
  quote: {
    getTitle: (notification) =>
      `${getAuthorName(notification)} quoted your post`,
    getBody: (notification) =>
      truncateText(notification.record?.text || "Your post was quoted", 100),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `quote:${notification.uri}`,
    reason: "quote",
    requireInteraction: true,
  },
  starterpack_joined: {
    getTitle: () => "Someone joined your starter pack",
    getBody: (notification) =>
      `${getAuthorName(notification)} joined via your starter pack`,
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: (notification) => `starterpack:${notification.uri}`,
    reason: "starterpack_joined",
  },
};

/**
 * Get author display name from notification
 */
function getAuthorName(notification) {
  return (
    notification.author?.displayName || notification.author?.handle || "Someone"
  );
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Build push notification payload from AT Protocol notification
 */
function buildPushPayload(notification) {
  const config = NOTIFICATION_CONFIG[notification.reason];

  if (!config) {
    // Unknown notification type
    return {
      type: "notification",
      title: "New notification",
      body: "You have a new notification on ShadowSky",
      icon: "/butterfly-icon.svg",
      badge: "/butterfly-icon.svg",
      tag: `notification:${notification.uri}`,
      data: {
        url: "/notifications",
        notificationUri: notification.uri,
        reason: notification.reason,
      },
    };
  }

  const postUri =
    notification.reasonSubject || notification.record?.subject?.uri;

  return {
    type: "notification",
    title: config.getTitle(notification),
    body: config.getBody(notification),
    icon: config.icon,
    badge: config.badge,
    tag: config.tag(notification),
    requireInteraction: config.requireInteraction || false,
    data: {
      url: postUri ? `/post/${encodeURIComponent(postUri)}` : "/notifications",
      notificationUri: notification.uri,
      authorDid: notification.author?.did,
      authorHandle: notification.author?.handle,
      reason: config.reason,
      postUri: postUri,
    },
  };
}

/**
 * Build batch notification payload for multiple notifications
 */
function buildBatchPayload(notifications) {
  if (notifications.length === 1) {
    return buildPushPayload(notifications[0]);
  }

  // Group by type
  const byType = {};
  for (const notification of notifications) {
    const reason = notification.reason;
    if (!byType[reason]) {
      byType[reason] = [];
    }
    byType[reason].push(notification);
  }

  // Find dominant type
  let dominantType = null;
  let maxCount = 0;
  for (const [type, items] of Object.entries(byType)) {
    if (items.length > maxCount) {
      maxCount = items.length;
      dominantType = type;
    }
  }

  const total = notifications.length;
  const config = NOTIFICATION_CONFIG[dominantType];

  // Build grouped notification
  let title, body;

  if (maxCount === total) {
    // All same type
    title = getBatchTitle(dominantType, total);
    body = getBatchBody(dominantType, total, notifications[0]);
  } else {
    // Mixed types
    title = `${total} new notifications`;
    body = getBatchMixedBody(byType);
  }

  return {
    type: "notification",
    title,
    body,
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: `batch:${Date.now()}`,
    data: {
      url: "/notifications",
      count: total,
      reason: dominantType,
      grouped: true,
    },
  };
}

/**
 * Get batch notification title
 */
function getBatchTitle(reason, count) {
  switch (reason) {
    case "like":
      return `${count} new likes`;
    case "repost":
      return `${count} new reposts`;
    case "follow":
      return `${count} new followers`;
    case "mention":
      return `${count} new mentions`;
    case "reply":
      return `${count} new replies`;
    case "quote":
      return `${count} new quotes`;
    default:
      return `${count} new notifications`;
  }
}

/**
 * Get batch notification body
 */
function getBatchBody(reason, count, latestNotification) {
  const authorName = getAuthorName(latestNotification);

  switch (reason) {
    case "like":
      return count > 1
        ? `${authorName} and ${count - 1} others liked your post`
        : `${authorName} liked your post`;
    case "repost":
      return count > 1
        ? `${authorName} and ${count - 1} others reposted your post`
        : `${authorName} reposted your post`;
    case "follow":
      return count > 1
        ? `${authorName} and ${count - 1} others followed you`
        : `${authorName} followed you`;
    case "mention":
      return count > 1
        ? `${authorName} and ${count - 1} others mentioned you`
        : `${authorName} mentioned you`;
    case "reply":
      return count > 1
        ? `${authorName} and ${count - 1} others replied to you`
        : `${authorName} replied to you`;
    case "quote":
      return count > 1
        ? `${authorName} and ${count - 1} others quoted your post`
        : `${authorName} quoted your post`;
    default:
      return `You have ${count} new notification${count > 1 ? "s" : ""}`;
  }
}

/**
 * Get batch notification body for mixed types
 */
function getBatchMixedBody(byType) {
  const parts = [];
  for (const [type, items] of Object.entries(byType)) {
    switch (type) {
      case "like":
        parts.push(`${items.length} like${items.length > 1 ? "s" : ""}`);
        break;
      case "repost":
        parts.push(`${items.length} repost${items.length > 1 ? "s" : ""}`);
        break;
      case "follow":
        parts.push(`${items.length} follower${items.length > 1 ? "s" : ""}`);
        break;
      case "mention":
        parts.push(`${items.length} mention${items.length > 1 ? "s" : ""}`);
        break;
      case "reply":
        parts.push(`${items.length} repl${items.length > 1 ? "ies" : "y"}`);
        break;
      case "quote":
        parts.push(`${items.length} quote${items.length > 1 ? "s" : ""}`);
        break;
      default:
        parts.push(
          `${items.length} notification${items.length > 1 ? "s" : ""}`,
        );
    }
  }
  return parts.join(", ");
}

/**
 * Register a user as having an active WebSocket connection
 */
function registerActiveUser(userDid) {
  activeWebSocketUsers.add(userDid);
}

/**
 * Unregister a user when WebSocket disconnects
 */
function unregisterActiveUser(userDid) {
  activeWebSocketUsers.delete(userDid);
}

/**
 * Check if user has an active WebSocket connection
 */
function isUserActive(userDid) {
  return activeWebSocketUsers.has(userDid);
}

/**
 * Queue a notification for batched delivery
 */
function queueNotification(userDid, notification) {
  // Don't send push if user has active WebSocket connection
  if (isUserActive(userDid)) {
    return;
  }

  let batch = batchQueue.get(userDid);

  if (!batch) {
    batch = {
      notifications: [],
      timer: null,
    };
    batchQueue.set(userDid, batch);
  }

  batch.notifications.push(notification);

  // Clear existing timer
  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  // If batch is full, send immediately
  if (batch.notifications.length >= MAX_BATCH_SIZE) {
    processBatch(userDid);
    return;
  }

  // Set timer for delayed batch processing
  batch.timer = setTimeout(() => {
    processBatch(userDid);
  }, BATCH_DELAY);
}

/**
 * Process and send a batch of notifications
 */
async function processBatch(userDid) {
  const batch = batchQueue.get(userDid);
  if (!batch || batch.notifications.length === 0) {
    return;
  }

  // Clear timer
  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  // Remove from queue
  batchQueue.delete(userDid);

  // Build and send payload
  const payload = buildBatchPayload(batch.notifications);

  try {
    const result = await pushSubscriptions.sendPushNotification(
      userDid,
      payload,
    );
    if (result.success) {
      console.log(
        `[Push Service] Sent batch notification to ${userDid}: ${result.sent} delivered, ${result.failed} failed`,
      );
    } else {
      console.log(`[Push Service] No subscriptions found for ${userDid}`);
    }
  } catch (error) {
    console.error(`[Push Service] Error sending to ${userDid}:`, error.message);
  }
}

/**
 * Send a single push notification immediately
 */
async function sendPushNotification(userDid, notification) {
  // Don't send push if user has active WebSocket connection
  if (isUserActive(userDid)) {
    return { success: false, reason: "user_active" };
  }

  const payload = buildPushPayload(notification);

  try {
    const result = await pushSubscriptions.sendPushNotification(
      userDid,
      payload,
    );
    return result;
  } catch (error) {
    console.error(`[Push Service] Error sending to ${userDid}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a push notification for mentions, replies, or DMs (high priority)
 * These bypass batching and are sent immediately
 */
async function sendHighPriorityNotification(userDid, notification) {
  // Still skip if user has active WebSocket
  if (isUserActive(userDid)) {
    return { success: false, reason: "user_active" };
  }

  const payload = buildPushPayload(notification);
  payload.requireInteraction = true;

  try {
    const result = await pushSubscriptions.sendPushNotification(
      userDid,
      payload,
    );
    if (result.success) {
      console.log(
        `[Push Service] Sent high-priority notification to ${userDid}: ${notification.reason}`,
      );
    }
    return result;
  } catch (error) {
    console.error(
      `[Push Service] Error sending high-priority to ${userDid}:`,
      error.message,
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handle an AT Protocol notification and decide how to deliver it
 */
async function handleNotification(userDid, notification) {
  const reason = notification.reason;

  // High priority notifications (mentions, replies) - send immediately
  if (["mention", "reply", "quote"].includes(reason)) {
    return await sendHighPriorityNotification(userDid, notification);
  }

  // Lower priority (likes, reposts, follows) - batch for efficiency
  queueNotification(userDid, notification);
  return { success: true, queued: true };
}

/**
 * Handle multiple notifications (called from WebSocket server poll)
 */
async function handleNotifications(userDid, notifications) {
  // Don't send push if user has active WebSocket connection
  if (isUserActive(userDid)) {
    return { success: false, reason: "user_active", count: 0 };
  }

  let processed = 0;

  for (const notification of notifications) {
    await handleNotification(userDid, notification);
    processed++;
  }

  return { success: true, count: processed };
}

/**
 * Send a DM notification (highest priority)
 */
async function sendDMNotification(userDid, conversation) {
  // Skip if user has active WebSocket
  if (isUserActive(userDid)) {
    return { success: false, reason: "user_active" };
  }

  const payload = {
    type: "message",
    title: `Message from ${conversation.senderName || "Someone"}`,
    body: truncateText(
      conversation.lastMessage || "You have a new message",
      100,
    ),
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: `dm:${conversation.id}`,
    requireInteraction: true,
    data: {
      url: `/messages/${conversation.id}`,
      type: "dm",
      conversationId: conversation.id,
      senderDid: conversation.senderDid,
    },
  };

  try {
    const result = await pushSubscriptions.sendPushNotification(
      userDid,
      payload,
    );
    if (result.success) {
      console.log(`[Push Service] Sent DM notification to ${userDid}`);
    }
    return result;
  } catch (error) {
    console.error(
      `[Push Service] Error sending DM notification to ${userDid}:`,
      error.message,
    );
    return { success: false, error: error.message };
  }
}

/**
 * Send a system notification (announcements, etc.)
 */
async function sendSystemNotification(userDid, title, body, data = {}) {
  const payload = {
    type: "system",
    title,
    body,
    icon: "/butterfly-icon.svg",
    badge: "/butterfly-icon.svg",
    tag: `system:${Date.now()}`,
    data: {
      url: data.url || "/",
      type: "system",
      ...data,
    },
  };

  try {
    return await pushSubscriptions.sendPushNotification(userDid, payload);
  } catch (error) {
    console.error(
      `[Push Service] Error sending system notification to ${userDid}:`,
      error.message,
    );
    return { success: false, error: error.message };
  }
}

/**
 * Get service statistics
 */
function getStats() {
  return {
    activeUsers: activeWebSocketUsers.size,
    pendingBatches: batchQueue.size,
    pendingNotifications: Array.from(batchQueue.values()).reduce(
      (sum, batch) => sum + batch.notifications.length,
      0,
    ),
  };
}

/**
 * Shutdown cleanup
 */
function shutdown() {
  // Process any remaining batches
  for (const userDid of batchQueue.keys()) {
    processBatch(userDid);
  }
  batchQueue.clear();
  activeWebSocketUsers.clear();
}

module.exports = {
  // Core notification handling
  handleNotification,
  handleNotifications,
  sendPushNotification,
  sendHighPriorityNotification,
  sendDMNotification,
  sendSystemNotification,

  // User connection tracking
  registerActiveUser,
  unregisterActiveUser,
  isUserActive,

  // Batching
  queueNotification,
  processBatch,

  // Utilities
  buildPushPayload,
  buildBatchPayload,
  getStats,
  shutdown,
};
