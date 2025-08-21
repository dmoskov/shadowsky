import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { appPreferencesService } from "./app-preferences-service";
import { columnService } from "./column-service";
import { draftService } from "./draft-service";

const logger = createLogger("DataServicesInitializer");

/**
 * Initialize column service with the correct storage type based on user preferences
 */
export async function initializeColumnService(agent: BskyAgent) {
  try {
    // Set agent for preferences service
    appPreferencesService.setAgent(agent);

    // Get storage type from PDS record
    const preferences = await appPreferencesService.getPreferences();
    // Normalize "atproto" to "custom" for column service
    const rawStorageType = preferences?.columnStorageType || "local";
    const storageType = (rawStorageType as string) === "atproto" ? "custom" : rawStorageType;

    logger.log(
      `Attempting to initialize column service with ${storageType} storage`,
    );

    // Initialize the column service with the correct storage type
    await columnService.initialize(agent, storageType);

    logger.log(
      `Column service successfully initialized with ${storageType} storage`,
    );
  } catch (error) {
    logger.error(
      "Failed to initialize column service with saved storage type:",
      error,
    );
    logger.error("Falling back to local storage");

    // Only update preferences if we're not in a force switch scenario
    // Check if the preference was just updated (within last 5 seconds)
    const prefs = await appPreferencesService.getPreferences();
    const lastUpdate = prefs?.updatedAt ? new Date(prefs.updatedAt) : null;
    const recentlyUpdated = lastUpdate && (Date.now() - lastUpdate.getTime()) < 5000;
    
    if (!recentlyUpdated) {
      // Update preferences to local storage if custom storage fails
      await appPreferencesService.updatePreferences({
        columnStorageType: "local",
      });
    }

    // Fall back to local storage
    await columnService.initialize(agent, "local");
  }
}

/**
 * Initialize draft service with the correct storage type based on user preferences
 */
export async function initializeDraftService(agent: BskyAgent) {
  try {
    // Set agent for preferences service
    appPreferencesService.setAgent(agent);

    // Get storage type from PDS record
    const preferences = await appPreferencesService.getPreferences();
    const storageType = preferences?.draftStorageType || "local";

    logger.log(
      `Attempting to initialize draft service with ${storageType} storage`,
    );

    // Initialize the draft service with the correct storage type
    await draftService.initialize(agent, storageType);

    logger.log(
      `Draft service successfully initialized with ${storageType} storage`,
    );
  } catch (error) {
    logger.error(
      "Failed to initialize draft service with saved storage type:",
      error,
    );
    logger.error("Falling back to local storage");

    // Update preferences to local storage if custom storage fails
    await appPreferencesService.updatePreferences({
      draftStorageType: "local",
    });

    // Fall back to local storage
    await draftService.initialize(agent, "local");
  }
}

/**
 * Initialize all data services (columns and drafts) with the correct storage types
 */
export async function initializeDataServices(agent: BskyAgent) {
  const initPromises = [
    initializeColumnService(agent),
    initializeDraftService(agent),
  ];

  // Initialize services in parallel
  await Promise.allSettled(initPromises);
}
