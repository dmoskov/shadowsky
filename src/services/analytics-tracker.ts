import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import {
  analyticsTrackingDB,
  type AnalyticsSnapshot,
} from "./analytics-tracking-db";

const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = "last_analytics_snapshot";

export class AnalyticsTracker {
  private agent: BskyAgent | null = null;
  private userId: string | null = null;
  private intervalId: number | null = null;

  setAgent(agent: BskyAgent | null, userId: string | null) {
    this.agent = agent;
    this.userId = userId;

    if (agent && userId) {
      this.startTracking();
    } else {
      this.stopTracking();
    }
  }

  private startTracking() {
    this.checkAndSnapshot();

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(
      () => {
        this.checkAndSnapshot();
      },
      60 * 60 * 1000,
    ); // Check every hour
  }

  private stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndSnapshot() {
    if (!this.agent || !this.userId) return;

    try {
      const lastSnapshotStr = localStorage.getItem(
        `${STORAGE_KEY}_${this.userId}`,
      );
      const lastSnapshot = lastSnapshotStr
        ? new Date(lastSnapshotStr)
        : new Date(0);
      const now = new Date();

      if (now.getTime() - lastSnapshot.getTime() >= SNAPSHOT_INTERVAL_MS) {
        await this.takeSnapshot();
        localStorage.setItem(
          `${STORAGE_KEY}_${this.userId}`,
          now.toISOString(),
        );
        debug.log("Analytics snapshot taken successfully");
      }
    } catch (error) {
      debug.error("Failed to take analytics snapshot:", error);
    }
  }

  async takeSnapshot(): Promise<void> {
    if (!this.agent || !this.userId) {
      debug.warn("Cannot take snapshot: agent or userId not set");
      return;
    }

    try {
      await analyticsTrackingDB.init();

      const profile = await this.agent.getProfile({
        actor: this.userId,
      });

      const snapshot: AnalyticsSnapshot = {
        timestamp: new Date(),
        userId: this.userId,
        followersCount: profile.data.followersCount || 0,
        followingCount: profile.data.followsCount || 0,
        postsCount: profile.data.postsCount || 0,
      };

      await analyticsTrackingDB.saveSnapshot(snapshot);

      await analyticsTrackingDB.cleanOldSnapshots(this.userId, 365);

      debug.log("Analytics snapshot saved:", snapshot);
    } catch (error) {
      debug.error("Error taking analytics snapshot:", error);
      throw error;
    }
  }

  async getHistoricalData(
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsSnapshot[]> {
    if (!this.userId) {
      return [];
    }

    try {
      await analyticsTrackingDB.init();
      return await analyticsTrackingDB.getSnapshots(
        this.userId,
        startDate,
        endDate,
      );
    } catch (error) {
      debug.error("Error fetching historical analytics:", error);
      return [];
    }
  }

  async hasHistoricalData(): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    try {
      await analyticsTrackingDB.init();
      return await analyticsTrackingDB.hasHistoricalData(this.userId);
    } catch (error) {
      debug.error("Error checking for historical data:", error);
      return false;
    }
  }

  destroy() {
    this.stopTracking();
    this.agent = null;
    this.userId = null;
  }
}

export const analyticsTracker = new AnalyticsTracker();
