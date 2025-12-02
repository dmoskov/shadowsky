import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { storageManager, StorageSystemHealth } from "./storage-manager";

const logger = createLogger("DataServicesInitializer");

/**
 * Initialize all data services using the unified StorageManager.
 *
 * This replaces the previous scattered initialization with coordinated
 * error handling and health monitoring.
 *
 * @param agent - The authenticated BskyAgent
 * @returns The storage system health status
 */
export async function initializeDataServices(
  agent: BskyAgent,
): Promise<StorageSystemHealth> {
  logger.log("Initializing data services via StorageManager...");

  try {
    const health = await storageManager.initialize(agent);

    // Log health status
    if (health.overall === "healthy") {
      logger.log("✅ All data services initialized successfully");
    } else if (health.overall === "degraded") {
      const degraded = storageManager.getDegradedBackends();
      logger.warn(
        `⚠️ Data services initialized with degradation: ${degraded.join(", ")}`,
      );
    } else if (health.overall === "failed") {
      const failed = storageManager.getFailedBackends();
      logger.error(
        `❌ Data services initialization failed for: ${failed.join(", ")}`,
      );
    }

    return health;
  } catch (error) {
    logger.error("Failed to initialize data services:", error);
    throw error;
  }
}

/**
 * Initialize core storage backends (no auth required).
 * Call this early in the app lifecycle before authentication.
 */
export async function initializeCoreStorage(): Promise<void> {
  logger.log("Initializing core storage...");
  await storageManager.initializeCoreStorage();
}

/**
 * Get the current storage system health status.
 */
export function getStorageHealth(): StorageSystemHealth {
  return storageManager.getHealth();
}

/**
 * Check if all storage backends are healthy.
 */
export function isStorageHealthy(): boolean {
  return storageManager.isFullyHealthy();
}

/**
 * Subscribe to storage health changes.
 */
export function onStorageHealthChange(
  callback: (health: StorageSystemHealth) => void,
): () => void {
  return storageManager.onHealthChange(callback);
}

/**
 * Get a human-readable health report.
 */
export function getStorageHealthReport(): string {
  return storageManager.getHealthReport();
}

/**
 * Reset storage manager state (useful after logout).
 */
export function resetStorageManager(): void {
  storageManager.reset();
}
