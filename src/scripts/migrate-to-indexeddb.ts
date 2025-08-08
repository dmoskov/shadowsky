import { NotificationStorageDB } from "../services/notification-storage-db";

/**
 * One-time migration script to move all localStorage data to IndexedDB
 * and update the app to stop using localStorage
 */
export async function migrateToIndexedDB() {
  console.log("🔄 Starting migration from localStorage to IndexedDB...");

  try {
    // Initialize IndexedDB
    const db = NotificationStorageDB.getInstance();
    await db.init();

    // Attempt migration
    const migrated = await db.migrateFromLocalStorage();

    if (migrated) {
      console.log("✅ Successfully migrated data to IndexedDB");

      // Also clear the metadata key
      localStorage.removeItem("bsky_extended_fetch_metadata_v1");
      console.log("✅ Cleared old metadata from localStorage");

      // Clear any other notification-related localStorage keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes("notification") || key.includes("bsky_extended"))
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
        console.log(`✅ Removed ${key} from localStorage`);
      });

      console.log(
        "🎉 Migration complete! All notification data now in IndexedDB",
      );
    } else {
      console.log("ℹ️ No data to migrate or migration already completed");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToIndexedDB();
}
