/**
 * Storage Manager
 *
 * Unified storage initialization orchestrator that initializes all storage backends
 * in correct dependency order with coordinated error handling and health monitoring.
 *
 * Initialization Order:
 * 1. Core: api-cache-service (no dependencies)
 * 2. Data: offline-storage-db, notification-storage-db (depend on core)
 * 3. User: column-service, draft-service, app-preferences (depend on auth)
 */

import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { apiCacheService } from "./api-cache-service";
import { appPreferencesService } from "./app-preferences-service";
import { columnService } from "./column-service";
import { draftService } from "./draft-service";
import { NotificationStorageDB } from "./notification-storage-db";
import { OfflineStorageDB } from "./offline-storage-db";

const logger = createLogger("StorageManager");

/**
 * Health status for individual storage backend
 */
export interface StorageBackendHealth {
  name: string;
  initialized: boolean;
  status: "healthy" | "degraded" | "failed" | "pending";
  lastError?: string;
  lastInitAttempt?: number;
  retryCount: number;
}

/**
 * Overall storage system health status
 */
export interface StorageSystemHealth {
  overall: "healthy" | "degraded" | "failed" | "initializing";
  backends: Record<string, StorageBackendHealth>;
  initializationComplete: boolean;
  lastHealthCheck: number;
}

/**
 * Storage Manager - orchestrates storage initialization
 */
class StorageManager {
  private static instance: StorageManager;
  private health: StorageSystemHealth;
  private initPromise: Promise<StorageSystemHealth> | null = null;
  private healthListeners: Set<(health: StorageSystemHealth) => void> =
    new Set();

  private constructor() {
    this.health = {
      overall: "initializing",
      backends: {
        "api-cache": this.createPendingHealth("api-cache"),
        "offline-storage": this.createPendingHealth("offline-storage"),
        "notification-storage": this.createPendingHealth(
          "notification-storage",
        ),
        "column-service": this.createPendingHealth("column-service"),
        "draft-service": this.createPendingHealth("draft-service"),
        "app-preferences": this.createPendingHealth("app-preferences"),
      },
      initializationComplete: false,
      lastHealthCheck: Date.now(),
    };
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Create pending health state for a backend
   */
  private createPendingHealth(name: string): StorageBackendHealth {
    return {
      name,
      initialized: false,
      status: "pending",
      retryCount: 0,
    };
  }

  /**
   * Update health status for a backend
   */
  private updateBackendHealth(
    name: string,
    status: StorageBackendHealth["status"],
    error?: Error,
  ): void {
    const backend = this.health.backends[name];
    if (backend) {
      backend.status = status;
      backend.initialized = status === "healthy";
      backend.lastInitAttempt = Date.now();
      if (error) {
        backend.lastError = error.message;
        backend.retryCount++;
      }
    }
    this.recalculateOverallHealth();
    this.notifyListeners();
  }

  /**
   * Recalculate overall system health based on backend states
   */
  private recalculateOverallHealth(): void {
    const backends = Object.values(this.health.backends);
    const failedCount = backends.filter((b) => b.status === "failed").length;
    const degradedCount = backends.filter(
      (b) => b.status === "degraded",
    ).length;
    const pendingCount = backends.filter((b) => b.status === "pending").length;

    this.health.lastHealthCheck = Date.now();

    if (pendingCount > 0) {
      this.health.overall = "initializing";
    } else if (failedCount > 0) {
      // If core services fail, overall is failed
      const coreBackends = [
        "api-cache",
        "offline-storage",
        "notification-storage",
      ];
      const coresFailed = coreBackends.some(
        (name) => this.health.backends[name]?.status === "failed",
      );
      this.health.overall = coresFailed ? "failed" : "degraded";
    } else if (degradedCount > 0) {
      this.health.overall = "degraded";
    } else {
      this.health.overall = "healthy";
    }
  }

  /**
   * Notify health listeners of state changes
   */
  private notifyListeners(): void {
    const healthSnapshot = this.getHealth();
    this.healthListeners.forEach((listener) => listener(healthSnapshot));
  }

  /**
   * Initialize core storage backends (no auth required)
   * These are essential for basic app functionality
   */
  async initializeCoreStorage(): Promise<void> {
    logger.log("Initializing core storage backends...");

    const coreBackends: Array<{
      name: string;
      init: () => Promise<void>;
    }> = [
      {
        name: "api-cache",
        init: () => apiCacheService.init(),
      },
      {
        name: "offline-storage",
        init: () => OfflineStorageDB.getInstance().init(),
      },
      {
        name: "notification-storage",
        init: () => NotificationStorageDB.getInstance().init(),
      },
    ];

    // Initialize core backends in parallel
    const results = await Promise.allSettled(
      coreBackends.map(async (backend) => {
        try {
          await backend.init();
          this.updateBackendHealth(backend.name, "healthy");
          logger.log(`✅ ${backend.name} initialized successfully`);
          return { name: backend.name, success: true };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.updateBackendHealth(backend.name, "failed", err);
          logger.error(`❌ ${backend.name} initialization failed:`, error);
          return { name: backend.name, success: false, error: err };
        }
      }),
    );

    // Log summary
    const failures = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success),
    );
    if (failures.length > 0) {
      logger.warn(
        `Core storage initialization completed with ${failures.length} failure(s)`,
      );
    } else {
      logger.log("Core storage initialization complete");
    }
  }

  /**
   * Initialize user-specific storage backends (requires auth)
   * These depend on user authentication and preferences
   */
  async initializeUserStorage(agent: BskyAgent): Promise<void> {
    logger.log("Initializing user storage backends...");

    // First, initialize app preferences to get storage type preferences
    try {
      appPreferencesService.setAgent(agent);
      const preferences = await appPreferencesService.getPreferences();
      this.updateBackendHealth("app-preferences", "healthy");
      logger.log("✅ app-preferences initialized successfully");

      // Get storage types from preferences
      const columnStorageType = preferences?.columnStorageType || "local";
      const draftStorageType = preferences?.draftStorageType || "local";

      // Initialize column service
      try {
        await columnService.initialize(agent, columnStorageType);
        this.updateBackendHealth("column-service", "healthy");
        logger.log(
          `✅ column-service initialized with ${columnStorageType} storage`,
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to initialize column service:", error);
        // Fall back to local storage
        try {
          await columnService.initialize(agent, "local");
          this.updateBackendHealth("column-service", "degraded", err);
          logger.warn("column-service fell back to local storage");
        } catch (fallbackError) {
          this.updateBackendHealth("column-service", "failed", err);
          logger.error("column-service fallback also failed:", fallbackError);
        }
      }

      // Initialize draft service
      try {
        await draftService.initialize(agent, draftStorageType);
        this.updateBackendHealth("draft-service", "healthy");
        logger.log(
          `✅ draft-service initialized with ${draftStorageType} storage`,
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to initialize draft service:", error);
        // Fall back to local storage
        try {
          await draftService.initialize(agent, "local");
          this.updateBackendHealth("draft-service", "degraded", err);
          logger.warn("draft-service fell back to local storage");
        } catch (fallbackError) {
          this.updateBackendHealth("draft-service", "failed", err);
          logger.error("draft-service fallback also failed:", fallbackError);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateBackendHealth("app-preferences", "failed", err);
      logger.error("Failed to initialize app preferences:", error);

      // Initialize column and draft services with local storage as fallback
      try {
        await columnService.initialize(agent, "local");
        this.updateBackendHealth("column-service", "degraded", err);
      } catch (colErr) {
        this.updateBackendHealth(
          "column-service",
          "failed",
          colErr instanceof Error ? colErr : new Error(String(colErr)),
        );
      }

      try {
        await draftService.initialize(agent, "local");
        this.updateBackendHealth("draft-service", "degraded", err);
      } catch (draftErr) {
        this.updateBackendHealth(
          "draft-service",
          "failed",
          draftErr instanceof Error ? draftErr : new Error(String(draftErr)),
        );
      }
    }

    this.health.initializationComplete = true;
    this.recalculateOverallHealth();
    logger.log(
      `User storage initialization complete. Overall health: ${this.health.overall}`,
    );
  }

  /**
   * Full initialization - core + user storage
   * Returns immediately if already initialized
   */
  async initialize(agent: BskyAgent): Promise<StorageSystemHealth> {
    // If already initializing, return existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      logger.log("Starting full storage initialization...");

      // Step 1: Initialize core storage (no auth required)
      await this.initializeCoreStorage();

      // Step 2: Initialize user storage (auth required)
      await this.initializeUserStorage(agent);

      return this.getHealth();
    })();

    return this.initPromise;
  }

  /**
   * Retry initialization for a specific failed backend
   */
  async retryBackend(
    name: string,
    agent?: BskyAgent,
  ): Promise<StorageBackendHealth> {
    const backend = this.health.backends[name];
    if (!backend) {
      throw new Error(`Unknown backend: ${name}`);
    }

    this.updateBackendHealth(name, "pending");

    try {
      switch (name) {
        case "api-cache":
          await apiCacheService.init();
          break;
        case "offline-storage":
          await OfflineStorageDB.getInstance().init();
          break;
        case "notification-storage":
          await NotificationStorageDB.getInstance().init();
          break;
        case "column-service":
          if (!agent) throw new Error("Agent required for column-service");
          await columnService.initialize(agent, "local");
          break;
        case "draft-service":
          if (!agent) throw new Error("Agent required for draft-service");
          await draftService.initialize(agent, "local");
          break;
        case "app-preferences":
          if (!agent) throw new Error("Agent required for app-preferences");
          appPreferencesService.setAgent(agent);
          await appPreferencesService.getPreferences();
          break;
        default:
          throw new Error(`No retry handler for backend: ${name}`);
      }

      this.updateBackendHealth(name, "healthy");
      logger.log(`✅ ${name} retry successful`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateBackendHealth(name, "failed", err);
      logger.error(`❌ ${name} retry failed:`, error);
    }

    return this.health.backends[name];
  }

  /**
   * Reset initialization state (useful for testing or after logout)
   */
  reset(): void {
    this.initPromise = null;
    this.health = {
      overall: "initializing",
      backends: {
        "api-cache": this.createPendingHealth("api-cache"),
        "offline-storage": this.createPendingHealth("offline-storage"),
        "notification-storage": this.createPendingHealth(
          "notification-storage",
        ),
        "column-service": this.createPendingHealth("column-service"),
        "draft-service": this.createPendingHealth("draft-service"),
        "app-preferences": this.createPendingHealth("app-preferences"),
      },
      initializationComplete: false,
      lastHealthCheck: Date.now(),
    };
    this.notifyListeners();
  }

  /**
   * Get current health status
   */
  getHealth(): StorageSystemHealth {
    return JSON.parse(JSON.stringify(this.health));
  }

  /**
   * Subscribe to health status changes
   */
  onHealthChange(callback: (health: StorageSystemHealth) => void): () => void {
    this.healthListeners.add(callback);
    return () => this.healthListeners.delete(callback);
  }

  /**
   * Check if a specific backend is healthy
   */
  isBackendHealthy(name: string): boolean {
    return this.health.backends[name]?.status === "healthy";
  }

  /**
   * Check if all core backends are healthy
   */
  areCoreBackendsHealthy(): boolean {
    const coreBackends = [
      "api-cache",
      "offline-storage",
      "notification-storage",
    ];
    return coreBackends.every((name) => this.isBackendHealthy(name));
  }

  /**
   * Check if all backends are healthy
   */
  isFullyHealthy(): boolean {
    return this.health.overall === "healthy";
  }

  /**
   * Get list of failed backends
   */
  getFailedBackends(): string[] {
    return Object.entries(this.health.backends)
      .filter(([_, health]) => health.status === "failed")
      .map(([name]) => name);
  }

  /**
   * Get list of degraded backends
   */
  getDegradedBackends(): string[] {
    return Object.entries(this.health.backends)
      .filter(([_, health]) => health.status === "degraded")
      .map(([name]) => name);
  }

  /**
   * Get detailed health report as string (for debugging)
   */
  getHealthReport(): string {
    const h = this.health;
    const lines = [
      `Storage System Health Report`,
      `============================`,
      `Overall Status: ${h.overall}`,
      `Initialization Complete: ${h.initializationComplete}`,
      `Last Health Check: ${new Date(h.lastHealthCheck).toISOString()}`,
      ``,
      `Backend Status:`,
    ];

    for (const [name, backend] of Object.entries(h.backends)) {
      const statusIcon =
        backend.status === "healthy"
          ? "✅"
          : backend.status === "degraded"
            ? "⚠️"
            : backend.status === "failed"
              ? "❌"
              : "⏳";
      lines.push(`  ${statusIcon} ${name}: ${backend.status}`);
      if (backend.lastError) {
        lines.push(`      Last Error: ${backend.lastError}`);
      }
      if (backend.retryCount > 0) {
        lines.push(`      Retry Count: ${backend.retryCount}`);
      }
    }

    return lines.join("\n");
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();

// Export for window debugging
if (typeof window !== "undefined") {
  (window as unknown as { __storageManager: StorageManager }).__storageManager =
    storageManager;
}
