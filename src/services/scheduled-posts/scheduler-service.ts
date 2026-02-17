/**
 * Scheduler Service
 *
 * Client-side service that manages scheduled posts with server synchronization.
 * Handles creating, updating, and monitoring scheduled posts.
 */

import { debug } from "@bsky/shared";
import { scheduledPostDB } from "./scheduled-post-db";
import {
  CreateScheduledPostInput,
  ScheduledPost,
  ScheduledPostEvent,
  ScheduledPostFilter,
  ScheduledPostQueueStats,
  UpdateScheduledPostInput,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Scheduler Service
 *
 * Provides a unified interface for managing scheduled posts with:
 * - Server-primary architecture with local IndexedDB cache
 * - Automatic sync between local and server
 * - Server time synchronization for accurate scheduling
 * - Event notifications for status changes
 */
class SchedulerService {
  private static instance: SchedulerService;
  private serverTimeOffset = 0;
  private listeners: Set<(event: ScheduledPostEvent) => void> = new Set();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private timeSyncInterval: ReturnType<typeof setInterval> | null = null;
  private userDid: string | null = null;
  private initialized = false;
  private boundVisibilityHandler: (() => void) | null = null;

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Initialize the scheduler service
   */
  async init(userDid: string): Promise<void> {
    if (this.initialized && this.userDid === userDid) {
      return;
    }

    this.userDid = userDid;
    await scheduledPostDB.init();
    scheduledPostDB.setCurrentUser(userDid);

    // Sync time with server
    await this.syncServerTime();

    // Initial sync from server
    await this.syncFromServer();

    // Set up periodic sync (every 30 seconds)
    this.startPeriodicSync();

    // Set up periodic time sync (every 5 minutes)
    this.startTimeSyncInterval();

    // Pause/resume sync when tab visibility changes
    this.setupVisibilityListener();

    this.initialized = true;
    debug.log("SchedulerService initialized for user:", userDid);
  }

  /**
   * Subscribe to scheduled post events
   */
  subscribe(callback: (event: ScheduledPostEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: ScheduledPostEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }

  /**
   * Get the current server time offset
   */
  getServerTimeOffset(): number {
    return this.serverTimeOffset;
  }

  /**
   * Sync time with server
   */
  async syncServerTime(): Promise<void> {
    try {
      const clientTimeBefore = Date.now();

      const response = await fetch(
        `${API_BASE_URL}/api/scheduled-posts/time-sync`,
      );

      const clientTimeAfter = Date.now();
      const roundTripTime = clientTimeAfter - clientTimeBefore;

      if (!response.ok) {
        throw new Error(`Time sync failed: ${response.status}`);
      }

      const data = await response.json();
      const serverTime = data.serverTimestamp;

      // Calculate offset accounting for network latency (use midpoint)
      const estimatedClientTimeAtServer = clientTimeBefore + roundTripTime / 2;
      this.serverTimeOffset = serverTime - estimatedClientTimeAtServer;

      debug.log("Server time offset:", this.serverTimeOffset, "ms");
    } catch (error) {
      debug.error("Failed to sync server time:", error);
      // Use local time if sync fails
      this.serverTimeOffset = 0;
    }
  }

  /**
   * Get the current server time (adjusted)
   */
  getServerTime(): Date {
    return new Date(Date.now() + this.serverTimeOffset);
  }

  /**
   * Create a new scheduled post
   */
  async create(input: CreateScheduledPostInput): Promise<ScheduledPost> {
    this.ensureInitialized();

    // Validate scheduled time
    const scheduledTime = new Date(input.scheduledFor);
    const serverTime = this.getServerTime();

    if (scheduledTime <= serverTime) {
      throw new Error("Scheduled time must be in the future");
    }

    // Save to server first (primary)
    const serverPost = await this.createOnServer(input);

    // Cache locally
    await scheduledPostDB.importFromServer([serverPost]);

    this.emit({ type: "created", post: serverPost });

    return serverPost;
  }

  private async createOnServer(
    input: CreateScheduledPostInput,
  ): Promise<ScheduledPost> {
    const response = await fetch(`${API_BASE_URL}/api/scheduled-posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `DID ${this.userDid}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || "Failed to create scheduled post",
      );
    }

    const data = await response.json();
    return data.post;
  }

  /**
   * Get a scheduled post by ID
   */
  async get(id: string): Promise<ScheduledPost | null> {
    this.ensureInitialized();

    // Try local cache first
    const localPost = await scheduledPostDB.get(id);
    if (localPost) {
      return localPost;
    }

    // Fetch from server
    return this.getFromServer(id);
  }

  private async getFromServer(id: string): Promise<ScheduledPost | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/scheduled-posts/${id}`,
        {
          headers: {
            Authorization: `DID ${this.userDid}`,
          },
        },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status}`);
      }

      const data = await response.json();
      return data.post;
    } catch (error) {
      debug.error("Failed to get post from server:", error);
      return null;
    }
  }

  /**
   * Get all scheduled posts with optional filtering
   */
  async getAll(filter?: ScheduledPostFilter): Promise<ScheduledPost[]> {
    this.ensureInitialized();

    // Return from local cache (synced from server)
    return scheduledPostDB.getAll(filter);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<ScheduledPostQueueStats> {
    this.ensureInitialized();
    return scheduledPostDB.getStats();
  }

  /**
   * Update a scheduled post
   */
  async update(
    id: string,
    updates: UpdateScheduledPostInput,
  ): Promise<ScheduledPost | null> {
    this.ensureInitialized();

    // Validate scheduled time if updating
    if (updates.scheduledFor) {
      const scheduledTime = new Date(updates.scheduledFor);
      const serverTime = this.getServerTime();

      if (scheduledTime <= serverTime) {
        throw new Error("Scheduled time must be in the future");
      }
    }

    // Update on server first
    const serverPost = await this.updateOnServer(id, updates);

    if (serverPost) {
      // Update local cache
      await scheduledPostDB.importFromServer([serverPost]);

      this.emit({ type: "updated", post: serverPost });
    }

    return serverPost;
  }

  private async updateOnServer(
    id: string,
    updates: UpdateScheduledPostInput,
  ): Promise<ScheduledPost | null> {
    const response = await fetch(`${API_BASE_URL}/api/scheduled-posts/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `DID ${this.userDid}`,
      },
      body: JSON.stringify(updates),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || "Failed to update scheduled post",
      );
    }

    const data = await response.json();
    return data.post;
  }

  /**
   * Cancel a scheduled post
   */
  async cancel(id: string): Promise<ScheduledPost | null> {
    this.ensureInitialized();

    const previousPost = await this.get(id);
    const post = await this.update(id, { status: "cancelled" });

    if (post) {
      this.emit({
        type: "status_changed",
        post,
        previousStatus: previousPost?.status,
      });
    }

    return post;
  }

  /**
   * Delete a scheduled post
   */
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();

    const post = await this.get(id);

    // Delete from server
    const success = await this.deleteOnServer(id);

    if (success) {
      // Delete from local cache
      await scheduledPostDB.delete(id);

      if (post) {
        this.emit({ type: "deleted", post });
      }
    }

    return success;
  }

  private async deleteOnServer(id: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/api/scheduled-posts/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `DID ${this.userDid}`,
      },
    });

    if (response.status === 404) {
      return true; // Already deleted
    }

    return response.ok;
  }

  /**
   * Sync local cache from server
   */
  async syncFromServer(): Promise<void> {
    if (!this.userDid) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-posts`, {
        headers: {
          Authorization: `DID ${this.userDid}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const data = await response.json();
      const posts = data.posts as ScheduledPost[];

      // Update local cache
      await scheduledPostDB.importFromServer(posts);

      debug.log(`Synced ${posts.length} scheduled posts from server`);
    } catch (error) {
      debug.error("Failed to sync from server:", error);
    }
  }

  /**
   * Start periodic sync with server
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncFromServer();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start periodic time sync
   */
  private startTimeSyncInterval(): void {
    if (this.timeSyncInterval) {
      clearInterval(this.timeSyncInterval);
    }

    this.timeSyncInterval = setInterval(() => {
      this.syncServerTime();
    }, 300000); // Every 5 minutes
  }

  /**
   * Set up visibility change listener to pause/resume sync when tab is hidden/visible.
   * Prevents unnecessary network requests when the app is backgrounded.
   */
  private setupVisibilityListener(): void {
    if (
      typeof document === "undefined" ||
      this.boundVisibilityHandler !== null
    ) {
      return;
    }

    this.boundVisibilityHandler = () => {
      if (document.hidden) {
        debug.log("SchedulerService: Tab hidden, pausing sync intervals");
        this.stopIntervals();
      } else {
        debug.log("SchedulerService: Tab visible, resuming sync intervals");
        this.startPeriodicSync();
        this.startTimeSyncInterval();
        // Sync immediately on becoming visible to catch up
        this.syncFromServer();
      }
    };

    document.addEventListener("visibilitychange", this.boundVisibilityHandler);
  }

  /**
   * Remove visibility change listener
   */
  private removeVisibilityListener(): void {
    if (typeof document === "undefined" || !this.boundVisibilityHandler) {
      return;
    }

    document.removeEventListener(
      "visibilitychange",
      this.boundVisibilityHandler,
    );
    this.boundVisibilityHandler = null;
  }

  /**
   * Stop interval timers without removing the visibility listener
   */
  private stopIntervals(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.timeSyncInterval) {
      clearInterval(this.timeSyncInterval);
      this.timeSyncInterval = null;
    }
  }

  /**
   * Stop all background processes
   */
  stop(): void {
    this.stopIntervals();
    this.removeVisibilityListener();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.initialized = false;
    this.userDid = null;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("SchedulerService not initialized. Call init() first.");
    }
  }
}

export const schedulerService = SchedulerService.getInstance();
