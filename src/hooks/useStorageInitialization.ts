import { debug } from "@bsky/shared";
import { useEffect } from "react";
import { initializeCoreStorage } from "../services/data-services-initializer";
import { IndexedDBCleanupService } from "../services/indexeddb-cleanup-service";
import { NotificationStorageDB } from "../services/notification-storage-db";
import { cleanupLocalStorage } from "../utils/cleanupLocalStorage";

/**
 * Initializes core storage backends after first paint to improve FCP
 * Uses requestIdleCallback to avoid blocking main thread during initial render
 */
export function useStorageInitialization() {
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // Initialize core storage via StorageManager (api-cache, offline-storage, notification-storage)
        // This replaces scattered individual initializations with coordinated error handling
        await initializeCoreStorage();
        debug.log("✅ Core storage backends initialized");

        // Run notification migration after core storage is ready
        const db = NotificationStorageDB.getInstance();
        const migrated = await db.migrateFromLocalStorage();
        if (migrated) {
          debug.log(
            "✅ Successfully migrated notifications from localStorage to IndexedDB",
          );
          // Clean up remaining localStorage keys
          cleanupLocalStorage();
        }

        // Run proactive IndexedDB cleanup
        const cleanupService = IndexedDBCleanupService.getInstance();
        const cleanupResult = await cleanupService.runStartupCleanup();
        if (cleanupResult) {
          debug.log(
            `✅ Startup cleanup: ${cleanupResult.deletedCount} old notifications removed`,
          );
        }
      } catch (error) {
        debug.error("Failed to initialize core storage:", error);
      }
    };

    // Defer storage initialization to after first paint
    // This improves First Contentful Paint on slow devices
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(
        () => {
          initializeStorage();
        },
        { timeout: 3000 }, // Ensure it runs within 3 seconds even if busy
      );
    } else {
      // Fallback for browsers without requestIdleCallback (Safari)
      setTimeout(initializeStorage, 100);
    }
  }, []);
}
