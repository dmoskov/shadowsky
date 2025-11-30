/**
 * Push Notification Service Worker
 *
 * Handles push events, notification display, click handling, and grouping.
 * This file is loaded alongside the Workbox service worker.
 */

// Notification grouping state
const notificationGroups = new Map();
const GROUP_COLLAPSE_DELAY = 3000; // 3 seconds

// Default icons
const DEFAULT_ICON = "/butterfly-icon.svg";
const DEFAULT_BADGE = "/butterfly-icon.svg";

/**
 * Handle incoming push events
 */
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("[Push SW] Received push event without data");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // If not JSON, treat as text
    payload = {
      type: "notification",
      title: "New Notification",
      body: event.data.text(),
    };
  }

  console.log("[Push SW] Push received:", payload);

  const notificationPromise = handlePushNotification(payload);
  event.waitUntil(notificationPromise);
});

/**
 * Handle push notification display with grouping
 */
async function handlePushNotification(payload) {
  const {
    type = "notification",
    title = "ShadowSky",
    body = "You have a new notification",
    icon = DEFAULT_ICON,
    badge = DEFAULT_BADGE,
    image,
    tag,
    data = {},
    actions = [],
    requireInteraction = false,
    silent = false,
    renotify = false,
    vibrate,
  } = payload;

  // Check if we should group this notification
  const groupKey = getNotificationGroupKey(payload);

  if (groupKey && !silent) {
    // Try to group with existing notifications
    const grouped = await tryGroupNotification(groupKey, payload);
    if (grouped) {
      return;
    }
  }

  // Build notification options
  const options = {
    body,
    icon,
    badge,
    tag: tag || generateNotificationTag(payload),
    data: {
      ...data,
      type,
      timestamp: Date.now(),
      url: data.url || getDefaultUrl(payload),
    },
    requireInteraction,
    silent,
    renotify,
  };

  // Add optional properties
  if (image) options.image = image;
  if (actions.length > 0) options.actions = actions;
  if (vibrate) options.vibrate = vibrate;

  // Show the notification
  try {
    await self.registration.showNotification(title, options);
    console.log("[Push SW] Notification displayed:", title);

    // Post message to client about received notification
    await postToClients({
      type: "push:received",
      payload: { title, body, data },
    });
  } catch (error) {
    console.error("[Push SW] Failed to show notification:", error);
  }
}

/**
 * Get grouping key for notification
 */
function getNotificationGroupKey(payload) {
  const { data = {} } = payload;
  const reason = data.reason;

  if (!reason) return null;

  // Group by notification type (likes, reposts, etc.)
  switch (reason) {
    case "like":
      return data.postUri ? `likes:${data.postUri}` : null;
    case "repost":
      return data.postUri ? `reposts:${data.postUri}` : null;
    case "follow":
      return "follows";
    default:
      return null;
  }
}

/**
 * Try to group notification with existing ones
 */
async function tryGroupNotification(groupKey, payload) {
  const existingNotifications = await self.registration.getNotifications({
    tag: `group:${groupKey}`,
  });

  if (existingNotifications.length === 0) {
    // No existing group, schedule potential grouping
    scheduleGrouping(groupKey, payload);
    return false;
  }

  // Update existing group
  const existing = existingNotifications[0];
  const groupData = existing.data || {};
  const count = (groupData.count || 1) + 1;

  // Close existing notification
  existing.close();

  // Show updated group notification
  const groupTitle = getGroupTitle(payload.data?.reason, count);
  const groupBody = getGroupBody(payload.data?.reason, count, payload);

  await self.registration.showNotification(groupTitle, {
    body: groupBody,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: `group:${groupKey}`,
    data: {
      ...groupData,
      count,
      type: "grouped",
      groupKey,
      url: payload.data?.url,
    },
    renotify: true,
  });

  return true;
}

/**
 * Schedule grouping for new notifications
 */
function scheduleGrouping(groupKey, payload) {
  // Store for potential grouping
  const groupData = notificationGroups.get(groupKey) || {
    notifications: [],
    timer: null,
  };

  groupData.notifications.push(payload);

  // Clear existing timer
  if (groupData.timer) {
    clearTimeout(groupData.timer);
  }

  // Set new timer for grouping
  groupData.timer = setTimeout(async () => {
    const data = notificationGroups.get(groupKey);
    if (data && data.notifications.length > 1) {
      // Convert to group notification
      await convertToGroupNotification(groupKey, data.notifications);
    }
    notificationGroups.delete(groupKey);
  }, GROUP_COLLAPSE_DELAY);

  notificationGroups.set(groupKey, groupData);
}

/**
 * Convert multiple notifications to a single group
 */
async function convertToGroupNotification(groupKey, notifications) {
  // Close individual notifications
  const existingNotifications = await self.registration.getNotifications();
  for (const notification of existingNotifications) {
    if (notification.data?.groupKey === groupKey) {
      notification.close();
    }
  }

  const firstPayload = notifications[0];
  const count = notifications.length;
  const reason = firstPayload.data?.reason;

  await self.registration.showNotification(getGroupTitle(reason, count), {
    body: getGroupBody(reason, count, firstPayload),
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: `group:${groupKey}`,
    data: {
      type: "grouped",
      groupKey,
      count,
      url: firstPayload.data?.url,
    },
  });
}

/**
 * Get title for grouped notifications
 */
function getGroupTitle(reason, count) {
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
    default:
      return `${count} new notifications`;
  }
}

/**
 * Get body for grouped notifications
 */
function getGroupBody(reason, count, latestPayload) {
  const author = latestPayload.data?.authorHandle || "Someone";

  switch (reason) {
    case "like":
      return `${author} and ${count - 1} others liked your post`;
    case "repost":
      return `${author} and ${count - 1} others reposted your post`;
    case "follow":
      return `${author} and ${count - 1} others followed you`;
    default:
      return `${author} and ${count - 1} others interacted with you`;
  }
}

/**
 * Generate unique notification tag
 */
function generateNotificationTag(payload) {
  const { data = {} } = payload;
  if (data.notificationUri) {
    return `notification:${data.notificationUri}`;
  }
  return `notification:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default URL for notification click
 */
function getDefaultUrl(payload) {
  const { data = {} } = payload;

  if (data.url) return data.url;
  if (data.postUri) return `/post/${encodeURIComponent(data.postUri)}`;
  if (data.authorDid) return `/profile/${data.authorDid}`;

  return "/notifications";
}

/**
 * Handle notification click events
 */
self.addEventListener("notificationclick", (event) => {
  console.log("[Push SW] Notification clicked:", event.notification.tag);

  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Handle specific actions
  if (action) {
    event.waitUntil(handleNotificationAction(action, data));
    return;
  }

  // Handle default click - open URL
  const url = data.url || "/notifications";
  event.waitUntil(openOrFocusWindow(url, data));
});

/**
 * Handle notification action buttons
 */
async function handleNotificationAction(action, data) {
  switch (action) {
    case "view":
      await openOrFocusWindow(data.url || "/notifications", data);
      break;
    case "dismiss":
      // Just close, already done
      break;
    case "reply":
      await openOrFocusWindow(data.url + "?reply=true", data);
      break;
    case "like":
      // Could implement quick like action here
      await postToClients({
        type: "push:notificationAction",
        payload: { action: "like", data },
      });
      break;
    default:
      console.log("[Push SW] Unknown action:", action);
  }
}

/**
 * Open or focus existing window with URL
 */
async function openOrFocusWindow(url, data) {
  const fullUrl = new URL(url, self.location.origin).href;

  // Try to find existing window
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Check for existing window with same origin
  for (const client of clients) {
    if (client.url.startsWith(self.location.origin)) {
      // Found existing window, focus and navigate
      await client.focus();
      await client.navigate(fullUrl);

      // Notify client about click
      client.postMessage({
        type: "push:notificationClick",
        payload: { url: fullUrl, data },
      });

      return;
    }
  }

  // No existing window, open new one
  const newClient = await self.clients.openWindow(fullUrl);

  if (newClient) {
    newClient.postMessage({
      type: "push:notificationClick",
      payload: { url: fullUrl, data },
    });
  }
}

/**
 * Handle notification close events
 */
self.addEventListener("notificationclose", (event) => {
  console.log("[Push SW] Notification closed:", event.notification.tag);

  const data = event.notification.data || {};

  // Notify clients
  event.waitUntil(
    postToClients({
      type: "push:notificationClose",
      payload: { tag: event.notification.tag, data },
    }),
  );
});

/**
 * Handle push subscription change
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[Push SW] Push subscription changed");

  event.waitUntil(
    (async () => {
      try {
        // Try to resubscribe
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: self.VAPID_PUBLIC_KEY,
        });

        // Notify clients about new subscription
        await postToClients({
          type: "push:subscriptionChange",
          payload: {
            subscription: subscription.toJSON(),
            action: "renewed",
          },
        });
      } catch (error) {
        console.error("[Push SW] Failed to resubscribe:", error);

        await postToClients({
          type: "push:subscriptionChange",
          payload: {
            subscription: null,
            action: "expired",
            error: error.message,
          },
        });
      }
    })(),
  );
});

/**
 * Handle messages from main thread
 */
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  console.log("[Push SW] Message received:", type);

  switch (type) {
    case "push:clearNotifications":
      event.waitUntil(clearAllNotifications(payload?.tag));
      break;

    case "push:updateSettings":
      // Store settings in service worker scope
      self.pushSettings = payload;
      break;

    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    default:
      console.log("[Push SW] Unknown message type:", type);
  }
});

/**
 * Clear all or specific notifications
 */
async function clearAllNotifications(tag) {
  const options = tag ? { tag } : undefined;
  const notifications = await self.registration.getNotifications(options);

  for (const notification of notifications) {
    notification.close();
  }

  console.log(`[Push SW] Cleared ${notifications.length} notifications`);
}

/**
 * Post message to all clients
 */
async function postToClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage(message);
  }
}

/**
 * Install event - cache push notification assets
 */
self.addEventListener("install", (event) => {
  console.log("[Push SW] Installing push notification handler");
  // Don't skip waiting - let Workbox handle this
});

/**
 * Activate event
 */
self.addEventListener("activate", (event) => {
  console.log("[Push SW] Push notification handler activated");
  // Claim clients so push notifications work immediately
  event.waitUntil(self.clients.claim());
});
