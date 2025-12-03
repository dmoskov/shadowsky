/**
 * Background Sync Service Worker
 *
 * Handles background timeline refresh for PWA using:
 * - Periodic Background Sync API (scheduled background updates)
 * - Background Sync API (retry on reconnection)
 *
 * This is the PWA equivalent of:
 * - iOS: BGAppRefreshTask
 * - Android: WorkManager
 */

// Sync tag constants (must match src/services/background-sync-service.ts)
const SYNC_TAGS = {
  TIMELINE_REFRESH: "timeline-refresh",
  NOTIFICATION_SYNC: "notification-sync",
  DM_SYNC: "dm-sync",
};

// API endpoints for fetching data
const API_ENDPOINTS = {
  TIMELINE: "https://public.api.bsky.app/xrpc/app.bsky.feed.getTimeline",
  NOTIFICATIONS:
    "https://public.api.bsky.app/xrpc/app.bsky.notification.listNotifications",
};

// Cache names for background sync data
const CACHE_NAMES = {
  BACKGROUND_TIMELINE: "background-timeline-cache",
  BACKGROUND_NOTIFICATIONS: "background-notifications-cache",
};

// IndexedDB for storing fetched data
const DB_NAME = "BackgroundSyncDB";
const DB_VERSION = 1;
const STORES = {
  TIMELINE: "timeline",
  NOTIFICATIONS: "notifications",
  METADATA: "metadata",
};

// User preferences (updated via message from main thread)
let syncPreferences = {
  enabled: true,
  frequency: "normal",
  contentTypes: {
    timeline: true,
    notifications: true,
    directMessages: false,
  },
  dataSaverMode: false,
  wifiOnly: false,
};

/**
 * Handle periodic background sync events
 * This fires when the browser grants time for background work
 */
self.addEventListener("periodicsync", (event) => {
  console.log("[Background Sync SW] Periodic sync event:", event.tag);

  if (event.tag === SYNC_TAGS.TIMELINE_REFRESH) {
    event.waitUntil(handleTimelineSync());
  } else if (event.tag === SYNC_TAGS.NOTIFICATION_SYNC) {
    event.waitUntil(handleNotificationSync());
  } else if (event.tag === SYNC_TAGS.DM_SYNC) {
    event.waitUntil(handleDMSync());
  }
});

/**
 * Handle basic background sync events (retry on reconnection)
 */
self.addEventListener("sync", (event) => {
  console.log("[Background Sync SW] Sync event:", event.tag);

  if (event.tag === SYNC_TAGS.TIMELINE_REFRESH) {
    event.waitUntil(handleTimelineSync());
  } else if (event.tag === SYNC_TAGS.NOTIFICATION_SYNC) {
    event.waitUntil(handleNotificationSync());
  }
});

/**
 * Handle messages from main thread
 */
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  console.log("[Background Sync SW] Message received:", type);

  switch (type) {
    case "background-sync:preferences-updated":
      syncPreferences = { ...syncPreferences, ...payload };
      console.log(
        "[Background Sync SW] Preferences updated:",
        syncPreferences,
      );
      break;

    case "background-sync:trigger":
      // Manual sync trigger
      if (payload?.tag === SYNC_TAGS.TIMELINE_REFRESH) {
        event.waitUntil(handleTimelineSync());
      } else if (payload?.tag === SYNC_TAGS.NOTIFICATION_SYNC) {
        event.waitUntil(handleNotificationSync());
      }
      break;

    case "background-sync:get-cached-data":
      // Return cached data to main thread
      event.waitUntil(
        getCachedData(payload?.type).then((data) => {
          event.source?.postMessage({
            type: "background-sync:cached-data",
            payload: data,
          });
        }),
      );
      break;
  }
});

/**
 * Handle timeline refresh
 */
async function handleTimelineSync() {
  console.log("[Background Sync SW] Starting timeline sync");

  // Check if sync should proceed based on preferences
  if (!shouldSync("timeline")) {
    console.log("[Background Sync SW] Timeline sync skipped due to preferences");
    return;
  }

  try {
    // Get stored credentials (if any)
    const credentials = await getStoredCredentials();
    if (!credentials) {
      console.log("[Background Sync SW] No credentials, skipping timeline sync");
      return notifyClients({
        type: "background-sync:completed",
        payload: {
          success: false,
          syncTag: SYNC_TAGS.TIMELINE_REFRESH,
          timestamp: Date.now(),
          itemsFetched: 0,
          error: "No credentials available",
        },
      });
    }

    // Fetch timeline with authentication
    const response = await fetch(API_ENDPOINTS.TIMELINE, {
      headers: {
        Authorization: `Bearer ${credentials.accessJwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Timeline fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data.feed || [];

    // Store in IndexedDB for later retrieval
    await storeTimelineData(items);

    // Update badge count if there are new items
    const newItemCount = await countNewItems(items, "timeline");
    if (newItemCount > 0) {
      await updateBadgeCount(newItemCount);
    }

    // Notify clients of successful sync
    await notifyClients({
      type: "background-sync:completed",
      payload: {
        success: true,
        syncTag: SYNC_TAGS.TIMELINE_REFRESH,
        timestamp: Date.now(),
        itemsFetched: items.length,
      },
    });

    console.log(`[Background Sync SW] Timeline sync completed: ${items.length} items`);
  } catch (error) {
    console.error("[Background Sync SW] Timeline sync failed:", error);

    await notifyClients({
      type: "background-sync:error",
      payload: {
        syncTag: SYNC_TAGS.TIMELINE_REFRESH,
        message: error.message,
      },
    });
  }
}

/**
 * Handle notification sync
 */
async function handleNotificationSync() {
  console.log("[Background Sync SW] Starting notification sync");

  if (!shouldSync("notifications")) {
    console.log(
      "[Background Sync SW] Notification sync skipped due to preferences",
    );
    return;
  }

  try {
    const credentials = await getStoredCredentials();
    if (!credentials) {
      console.log(
        "[Background Sync SW] No credentials, skipping notification sync",
      );
      return;
    }

    const response = await fetch(API_ENDPOINTS.NOTIFICATIONS, {
      headers: {
        Authorization: `Bearer ${credentials.accessJwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Notification fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const notifications = data.notifications || [];

    // Store notifications
    await storeNotificationData(notifications);

    // Count unread notifications for badge
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    if (unreadCount > 0) {
      await updateBadgeCount(unreadCount);

      // Show a notification if there are new unread items
      await showBackgroundNotification(unreadCount, notifications);
    }

    await notifyClients({
      type: "background-sync:completed",
      payload: {
        success: true,
        syncTag: SYNC_TAGS.NOTIFICATION_SYNC,
        timestamp: Date.now(),
        itemsFetched: notifications.length,
      },
    });

    console.log(
      `[Background Sync SW] Notification sync completed: ${notifications.length} items`,
    );
  } catch (error) {
    console.error("[Background Sync SW] Notification sync failed:", error);

    await notifyClients({
      type: "background-sync:error",
      payload: {
        syncTag: SYNC_TAGS.NOTIFICATION_SYNC,
        message: error.message,
      },
    });
  }
}

/**
 * Handle DM sync (placeholder - DMs require special handling)
 */
async function handleDMSync() {
  console.log("[Background Sync SW] DM sync not implemented in background");
  // DMs are sensitive and should not be synced in background
  // This is a placeholder for future implementation if needed
}

/**
 * Check if sync should proceed based on preferences and conditions
 */
function shouldSync(contentType) {
  if (!syncPreferences.enabled) {
    return false;
  }

  // Check content type preference
  switch (contentType) {
    case "timeline":
      if (!syncPreferences.contentTypes.timeline) return false;
      break;
    case "notifications":
      if (!syncPreferences.contentTypes.notifications) return false;
      break;
    case "directMessages":
      if (!syncPreferences.contentTypes.directMessages) return false;
      break;
  }

  // Check connection type if wifiOnly is enabled
  if (syncPreferences.wifiOnly) {
    const connection = navigator?.connection;
    if (connection && connection.type !== "wifi") {
      return false;
    }
  }

  // Check data saver mode
  if (syncPreferences.dataSaverMode) {
    const connection = navigator?.connection;
    if (
      connection &&
      (connection.effectiveType === "slow-2g" ||
        connection.effectiveType === "2g")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get stored credentials from IndexedDB
 */
async function getStoredCredentials() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.METADATA, "readonly");
      const store = tx.objectStore(STORES.METADATA);
      const request = store.get("credentials");

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Store timeline data in IndexedDB
 */
async function storeTimelineData(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.TIMELINE, STORES.METADATA], "readwrite");
    const store = tx.objectStore(STORES.TIMELINE);

    // Clear old data and store new
    store.clear();

    for (const item of items) {
      store.put({
        id: item.post?.uri || item.uri,
        data: item,
        fetchedAt: Date.now(),
      });
    }

    // Update last sync timestamp
    const metaStore = tx.objectStore(STORES.METADATA);
    metaStore.put({
      key: "lastTimelineSync",
      value: Date.now(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store notification data in IndexedDB
 */
async function storeNotificationData(notifications) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [STORES.NOTIFICATIONS, STORES.METADATA],
      "readwrite",
    );
    const store = tx.objectStore(STORES.NOTIFICATIONS);

    // Clear old data and store new
    store.clear();

    for (const notification of notifications) {
      store.put({
        id: notification.uri,
        data: notification,
        fetchedAt: Date.now(),
      });
    }

    // Update last sync timestamp
    const metaStore = tx.objectStore(STORES.METADATA);
    metaStore.put({
      key: "lastNotificationSync",
      value: Date.now(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get cached data from IndexedDB
 */
async function getCachedData(type) {
  try {
    const db = await openDB();
    const storeName =
      type === "timeline" ? STORES.TIMELINE : STORES.NOTIFICATIONS;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result.map((r) => r.data);
        resolve({ type, items, count: items.length });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return { type, items: [], count: 0, error: error.message };
  }
}

/**
 * Count new items since last sync
 */
async function countNewItems(items, type) {
  try {
    const db = await openDB();
    const metaKey =
      type === "timeline" ? "lastTimelineSync" : "lastNotificationSync";

    return new Promise((resolve) => {
      const tx = db.transaction(STORES.METADATA, "readonly");
      const store = tx.objectStore(STORES.METADATA);
      const request = store.get(metaKey);

      request.onsuccess = () => {
        const lastSync = request.result?.value || 0;

        // Count items created after last sync
        const newItems = items.filter((item) => {
          const itemDate = new Date(
            item.post?.indexedAt || item.indexedAt,
          ).getTime();
          return itemDate > lastSync;
        });

        resolve(newItems.length);
      };
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Update the app badge count
 */
async function updateBadgeCount(count) {
  if ("setAppBadge" in navigator) {
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
      console.log(`[Background Sync SW] Badge updated: ${count}`);
    } catch (error) {
      console.error("[Background Sync SW] Failed to update badge:", error);
    }
  }

  // Also notify clients
  await notifyClients({
    type: "background-sync:badge-update",
    payload: { count },
  });
}

/**
 * Show a notification for new content
 */
async function showBackgroundNotification(count, notifications) {
  // Only show if permission granted
  if (Notification.permission !== "granted") {
    return;
  }

  // Get the most recent notification for context
  const recent = notifications[0];
  let body = `You have ${count} new notification${count > 1 ? "s" : ""}`;

  if (recent) {
    const author = recent.author?.displayName || recent.author?.handle || "Someone";
    const reason = recent.reason;

    switch (reason) {
      case "like":
        body = `${author} liked your post`;
        break;
      case "repost":
        body = `${author} reposted your post`;
        break;
      case "follow":
        body = `${author} followed you`;
        break;
      case "mention":
        body = `${author} mentioned you`;
        break;
      case "reply":
        body = `${author} replied to your post`;
        break;
    }

    if (count > 1) {
      body += ` and ${count - 1} more`;
    }
  }

  try {
    await self.registration.showNotification("ShadowSky", {
      body,
      icon: "/butterfly-icon.svg",
      badge: "/butterfly-icon.svg",
      tag: "background-sync-notification",
      data: { url: "/notifications" },
      renotify: true,
    });
  } catch (error) {
    console.error("[Background Sync SW] Failed to show notification:", error);
  }
}

/**
 * Open IndexedDB database
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.TIMELINE)) {
        db.createObjectStore(STORES.TIMELINE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: "key" });
      }
    };
  });
}

/**
 * Notify all clients of an event
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage(message);
  }
}

/**
 * Install event
 */
self.addEventListener("install", (event) => {
  console.log("[Background Sync SW] Installing background sync handler");
  // Initialize database on install
  event.waitUntil(openDB());
});

/**
 * Activate event
 */
self.addEventListener("activate", (event) => {
  console.log("[Background Sync SW] Background sync handler activated");
  event.waitUntil(self.clients.claim());
});
