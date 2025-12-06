/**
 * Real-time Engagement Service
 *
 * Manages live engagement counter updates (likes, reposts, replies) for posts
 * currently visible in the viewport. Uses WebSocket for real-time updates
 * and implements aggressive throttling to minimize performance impact.
 *
 * Key features:
 * - Viewport-aware subscription (only subscribes to visible posts)
 * - Batched updates to reduce render churn
 * - Throttled viewport tracking to minimize CPU usage
 * - Feature flag gated for controlled rollout
 */

import { WS_CONFIG } from "../config/websocket.config";
import {
  type EngagementUpdateEvent,
  type PostEngagement,
  WebSocketEventType,
} from "../types/websocket";
import { getWebSocketService } from "./websocket-service";

// Re-export PostEngagement for consumers
export type { PostEngagement } from "../types/websocket";

// Feature flag storage key
const FEATURE_FLAG_KEY = "shadowsky_real_time_engagement_enabled";

/**
 * Listener callback for engagement updates
 */
export type EngagementUpdateListener = (updates: PostEngagement[]) => void;

/**
 * Performance metrics for monitoring
 */
export interface EngagementServiceMetrics {
  /** Number of posts currently subscribed */
  activeSubscriptions: number;
  /** Total updates received */
  updatesReceived: number;
  /** Total subscription messages sent */
  subscriptionsSent: number;
  /** Average time between viewport updates */
  avgViewportUpdateIntervalMs: number;
  /** Whether the service is currently active */
  isActive: boolean;
}

class RealTimeEngagementService {
  private listeners: Set<EngagementUpdateListener> = new Set();
  private subscribedUris: Set<string> = new Set();
  private pendingSubscriptions: Set<string> = new Set();
  private pendingUnsubscriptions: Set<string> = new Set();

  // Batched updates from server
  private pendingUpdates: Map<string, PostEngagement> = new Map();
  private updateFlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Subscription batching
  private subscriptionFlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Metrics tracking
  private metrics: EngagementServiceMetrics = {
    activeSubscriptions: 0,
    updatesReceived: 0,
    subscriptionsSent: 0,
    avgViewportUpdateIntervalMs: 0,
    isActive: false,
  };

  private lastViewportUpdateTime: number = 0;
  private viewportUpdateIntervals: number[] = [];
  private readonly MAX_INTERVAL_SAMPLES = 20;

  // Feature flag state
  private _enabled: boolean = false;

  constructor() {
    this._enabled = this.loadFeatureFlag();
  }

  /**
   * Load feature flag from localStorage
   */
  private loadFeatureFlag(): boolean {
    try {
      const stored = localStorage.getItem(FEATURE_FLAG_KEY);
      if (stored !== null) {
        return stored === "true";
      }
      // Default to false for initial rollout
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if real-time engagement is enabled
   */
  public isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Enable or disable real-time engagement updates
   */
  public setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    try {
      localStorage.setItem(FEATURE_FLAG_KEY, String(enabled));
    } catch {
      // Ignore storage errors
    }

    if (!enabled) {
      // Clean up when disabled
      this.stop();
    } else {
      // Start listening when enabled
      this.start();
    }
  }

  /**
   * Start the engagement service
   */
  public start(): void {
    if (!this._enabled) return;

    const ws = getWebSocketService();
    if (!ws) return;

    // Register for engagement updates
    ws.on(WebSocketEventType.ENGAGEMENT_UPDATE, this.handleEngagementUpdate);
    this.metrics.isActive = true;
  }

  /**
   * Stop the engagement service and clean up
   */
  public stop(): void {
    const ws = getWebSocketService();
    if (ws) {
      ws.off(WebSocketEventType.ENGAGEMENT_UPDATE, this.handleEngagementUpdate);

      // Unsubscribe from all posts
      if (this.subscribedUris.size > 0) {
        ws.send({
          type: WebSocketEventType.ENGAGEMENT_UNSUBSCRIBE,
          postUris: Array.from(this.subscribedUris),
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Clear all state
    this.subscribedUris.clear();
    this.pendingSubscriptions.clear();
    this.pendingUnsubscriptions.clear();
    this.pendingUpdates.clear();

    if (this.updateFlushTimer) {
      clearTimeout(this.updateFlushTimer);
      this.updateFlushTimer = null;
    }
    if (this.subscriptionFlushTimer) {
      clearTimeout(this.subscriptionFlushTimer);
      this.subscriptionFlushTimer = null;
    }

    this.metrics.isActive = false;
    this.metrics.activeSubscriptions = 0;
  }

  /**
   * Add a listener for engagement updates
   */
  public addListener(listener: EngagementUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update the set of visible post URIs
   * This is the main entry point for viewport tracking integration
   */
  public updateVisiblePosts(uris: string[]): void {
    if (!this._enabled) return;

    // Track viewport update interval for metrics
    const now = Date.now();
    if (this.lastViewportUpdateTime > 0) {
      const interval = now - this.lastViewportUpdateTime;
      this.viewportUpdateIntervals.push(interval);
      if (this.viewportUpdateIntervals.length > this.MAX_INTERVAL_SAMPLES) {
        this.viewportUpdateIntervals.shift();
      }
      this.metrics.avgViewportUpdateIntervalMs =
        this.viewportUpdateIntervals.reduce((a, b) => a + b, 0) /
        this.viewportUpdateIntervals.length;
    }
    this.lastViewportUpdateTime = now;

    // Limit to max subscriptions
    const limitedUris = uris.slice(0, WS_CONFIG.ENGAGEMENT_MAX_SUBSCRIPTIONS);
    const newUriSet = new Set(limitedUris);

    // Find URIs to subscribe to (new URIs not already subscribed)
    for (const uri of limitedUris) {
      if (!this.subscribedUris.has(uri)) {
        this.pendingSubscriptions.add(uri);
        this.pendingUnsubscriptions.delete(uri);
      }
    }

    // Find URIs to unsubscribe from (old URIs no longer visible)
    for (const uri of this.subscribedUris) {
      if (!newUriSet.has(uri)) {
        this.pendingUnsubscriptions.add(uri);
        this.pendingSubscriptions.delete(uri);
      }
    }

    // Schedule batched subscription update
    this.scheduleSubscriptionFlush();
  }

  /**
   * Schedule a batched subscription update to the server
   */
  private scheduleSubscriptionFlush(): void {
    if (this.subscriptionFlushTimer) return;

    this.subscriptionFlushTimer = setTimeout(() => {
      this.subscriptionFlushTimer = null;
      this.flushSubscriptions();
    }, WS_CONFIG.ENGAGEMENT_SUBSCRIPTION_BATCH_MS);
  }

  /**
   * Send batched subscription/unsubscription updates to server
   */
  private flushSubscriptions(): void {
    const ws = getWebSocketService();
    if (!ws || !ws.isConnected()) return;

    // Send unsubscriptions first
    if (this.pendingUnsubscriptions.size > 0) {
      const urisToUnsubscribe = Array.from(this.pendingUnsubscriptions);
      ws.send({
        type: WebSocketEventType.ENGAGEMENT_UNSUBSCRIBE,
        postUris: urisToUnsubscribe,
        timestamp: new Date().toISOString(),
      });

      for (const uri of urisToUnsubscribe) {
        this.subscribedUris.delete(uri);
      }
      this.pendingUnsubscriptions.clear();
    }

    // Send subscriptions
    if (this.pendingSubscriptions.size > 0) {
      const urisToSubscribe = Array.from(this.pendingSubscriptions);
      ws.send({
        type: WebSocketEventType.ENGAGEMENT_SUBSCRIBE,
        postUris: urisToSubscribe,
        timestamp: new Date().toISOString(),
      });

      this.metrics.subscriptionsSent++;
      for (const uri of urisToSubscribe) {
        this.subscribedUris.add(uri);
      }
      this.pendingSubscriptions.clear();
    }

    this.metrics.activeSubscriptions = this.subscribedUris.size;
  }

  /**
   * Handle engagement update from WebSocket
   */
  private handleEngagementUpdate = (event: unknown): void => {
    const updateEvent = event as EngagementUpdateEvent;
    if (updateEvent.type !== WebSocketEventType.ENGAGEMENT_UPDATE) return;

    this.metrics.updatesReceived++;

    // Merge updates (latest wins for each URI)
    for (const update of updateEvent.updates) {
      this.pendingUpdates.set(update.uri, update);
    }

    // Schedule debounced flush to listeners
    this.scheduleUpdateFlush();
  };

  /**
   * Schedule debounced update flush to listeners
   */
  private scheduleUpdateFlush(): void {
    if (this.updateFlushTimer) return;

    this.updateFlushTimer = setTimeout(() => {
      this.updateFlushTimer = null;
      this.flushUpdatesToListeners();
    }, WS_CONFIG.ENGAGEMENT_UPDATE_DEBOUNCE_MS);
  }

  /**
   * Flush pending updates to all listeners
   */
  private flushUpdatesToListeners(): void {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    // Notify all listeners
    for (const listener of this.listeners) {
      try {
        listener(updates);
      } catch (error) {
        console.error("Error in engagement update listener:", error);
      }
    }
  }

  /**
   * Get current metrics for monitoring
   */
  public getMetrics(): EngagementServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Manually request engagement data for specific URIs (one-time, not subscription)
   * Useful for getting initial data for newly rendered posts
   */
  public requestEngagementData(uris: string[]): void {
    if (!this._enabled) return;

    const ws = getWebSocketService();
    if (!ws || !ws.isConnected()) return;

    // Send a one-time subscription request
    // The server should respond with current engagement data
    ws.send({
      type: WebSocketEventType.ENGAGEMENT_SUBSCRIBE,
      postUris: uris.slice(0, WS_CONFIG.ENGAGEMENT_MAX_SUBSCRIPTIONS),
      timestamp: new Date().toISOString(),
    });
  }
}

// Singleton instance
let engagementService: RealTimeEngagementService | null = null;

/**
 * Get the real-time engagement service instance
 */
export function getRealTimeEngagementService(): RealTimeEngagementService {
  if (!engagementService) {
    engagementService = new RealTimeEngagementService();
  }
  return engagementService;
}

/**
 * Initialize the engagement service (call after WebSocket is initialized)
 */
export function initializeEngagementService(): RealTimeEngagementService {
  const service = getRealTimeEngagementService();
  service.start();
  return service;
}

/**
 * Clean up the engagement service
 */
export function cleanupEngagementService(): void {
  if (engagementService) {
    engagementService.stop();
    engagementService = null;
  }
}

export { RealTimeEngagementService };
