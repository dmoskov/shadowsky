/**
 * Jetstream Service - Bluesky Firehose Integration
 *
 * Connects to Bluesky's Jetstream WebSocket firehose to receive real-time updates
 * for posts, notifications, and engagement metrics.
 *
 * Jetstream URL: wss://jetstream1.us-east.bsky.network/subscribe
 *
 * Features:
 * - Real-time post updates from followed accounts
 * - Real-time notification events (likes, reposts, follows, replies)
 * - Auto-reconnect with exponential backoff
 * - Selective event filtering based on current user DID
 * - Integration with existing WebSocket event system
 *
 * Event Types from Jetstream:
 * - commit: Repository commits (posts, likes, follows, etc.)
 * - identity: Identity updates
 * - account: Account updates
 *
 * See: https://docs.bsky.app/blog/jetstream
 */

import { debug } from "@bsky/shared";
import { WebSocketEventType, type WebSocketMessage } from "../types/websocket";

/**
 * Jetstream commit event
 */
interface JetstreamCommit {
  did: string;
  time_us: number;
  kind: "commit";
  commit: {
    rev: string;
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

/**
 * Jetstream message (union of all event types)
 */
type JetstreamMessage = JetstreamCommit;

type EventHandler = (event: WebSocketMessage) => void;

/**
 * Configuration for Jetstream service
 */
export interface JetstreamConfig {
  /** Current user's DID for filtering relevant events */
  userDid: string;
  /** Array of DIDs the user follows (for filtering timeline posts) */
  followedDids?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Jetstream Service for real-time Bluesky updates
 */
export class JetstreamService {
  private ws: WebSocket | null = null;
  private config: JetstreamConfig;
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly INITIAL_RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_DELAY = 30000;

  // Jetstream endpoint
  private readonly JETSTREAM_URL =
    "wss://jetstream1.us-east.bsky.network/subscribe";

  // Stats
  private stats = {
    messagesReceived: 0,
    postsReceived: 0,
    notificationsReceived: 0,
    lastEventTime: null as Date | null,
  };

  // Browser event handlers for visibility and network changes
  private boundVisibilityHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;

  constructor(config: JetstreamConfig) {
    this.config = { ...config, followedDids: config.followedDids || [] };
  }

  /**
   * Connect to Jetstream firehose
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log("Already connected to Jetstream");
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.log("Connection already in progress");
      return;
    }

    this.isIntentionallyClosed = false;
    this.log(`Connecting to Jetstream: ${this.JETSTREAM_URL}`);

    // Set up browser event listeners for visibility and network changes
    this.setupBrowserEventListeners();

    try {
      // Build query parameters for filtering
      const params = new URLSearchParams();
      params.set("wantedCollections", "app.bsky.feed.post");
      params.set("wantedCollections", "app.bsky.feed.like");
      params.set("wantedCollections", "app.bsky.feed.repost");
      params.set("wantedCollections", "app.bsky.graph.follow");

      const url = `${this.JETSTREAM_URL}?${params.toString()}`;
      this.ws = new WebSocket(url);
      this.setupEventListeners();
    } catch (error) {
      this.handleError("Failed to create Jetstream connection", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from Jetstream
   */
  public disconnect(): void {
    this.log("Disconnecting from Jetstream");
    this.isIntentionallyClosed = true;
    this.clearReconnectTimer();
    this.removeBrowserEventListeners();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  /**
   * Register an event handler
   */
  public on(eventType: WebSocketEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    this.log(`Registered handler for ${eventType}`);
  }

  /**
   * Unregister an event handler
   */
  public off(eventType: WebSocketEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      this.log(`Unregistered handler for ${eventType}`);
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update followed DIDs for filtering
   */
  public updateFollowedDids(dids: string[]): void {
    this.config.followedDids = dids;
    this.log(`Updated followed DIDs count: ${dids.length}`);
  }

  /**
   * Get service stats
   */
  public getStats() {
    return { ...this.stats };
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log("Connected to Jetstream firehose");
      this.reconnectAttempts = 0;
      this.emit({
        type: WebSocketEventType.CONNECT,
        timestamp: new Date().toISOString(),
      });
    };

    this.ws.onclose = (event) => {
      this.log(
        `Jetstream connection closed: ${event.code} ${event.reason || "No reason"}`,
      );
      this.emit({
        type: WebSocketEventType.DISCONNECT,
        timestamp: new Date().toISOString(),
      });

      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.handleError("Jetstream WebSocket error", event);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming Jetstream message
   */
  private handleMessage(data: string): void {
    this.stats.messagesReceived++;
    this.stats.lastEventTime = new Date();

    try {
      const message: JetstreamMessage = JSON.parse(data);

      if (message.kind === "commit") {
        this.handleCommitEvent(message);
      }
      // We could handle identity and account events in the future if needed
    } catch (error) {
      this.handleError("Failed to parse Jetstream message", error);
    }
  }

  /**
   * Handle commit events from Jetstream
   */
  private handleCommitEvent(commit: JetstreamCommit): void {
    const { collection, operation } = commit.commit;

    // Handle post creation/updates from followed accounts
    if (
      collection === "app.bsky.feed.post" &&
      (operation === "create" || operation === "update")
    ) {
      // Check if this post is from a followed account
      if (
        this.config.followedDids &&
        this.config.followedDids.includes(commit.did)
      ) {
        this.stats.postsReceived++;
        // Emit a custom event that can trigger timeline invalidation
        this.emit({
          type: "timeline:newpost" as WebSocketEventType,
          timestamp: new Date().toISOString(),
          data: {
            did: commit.did,
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid,
          },
        } as WebSocketMessage);
      }
    }

    // Handle engagement updates for the current user's posts
    if (
      collection === "app.bsky.feed.like" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as { subject?: { uri?: string } };
      const subjectUri = record.subject?.uri;

      // Check if this is a like on one of the current user's posts
      if (subjectUri && subjectUri.startsWith(`at://${this.config.userDid}/`)) {
        this.stats.notificationsReceived++;
        // This is a notification for the current user
        this.emit({
          type: WebSocketEventType.NEW_NOTIFICATION,
          timestamp: new Date().toISOString(),
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            author: {
              did: commit.did,
              handle: "",
              displayName: "",
            },
            reason: "like",
            reasonSubject: subjectUri,
            record: commit.commit.record,
            isRead: false,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        } as WebSocketMessage);
      }
    }

    // Handle reposts
    if (
      collection === "app.bsky.feed.repost" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as { subject?: { uri?: string } };
      const subjectUri = record.subject?.uri;

      if (subjectUri && subjectUri.startsWith(`at://${this.config.userDid}/`)) {
        this.stats.notificationsReceived++;
        this.emit({
          type: WebSocketEventType.NEW_NOTIFICATION,
          timestamp: new Date().toISOString(),
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            author: {
              did: commit.did,
              handle: "",
              displayName: "",
            },
            reason: "repost",
            reasonSubject: subjectUri,
            record: commit.commit.record,
            isRead: false,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        } as WebSocketMessage);
      }
    }

    // Handle follows
    if (
      collection === "app.bsky.graph.follow" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as { subject?: string };
      const subjectDid = record.subject;

      // Check if someone followed the current user
      if (subjectDid === this.config.userDid) {
        this.stats.notificationsReceived++;
        this.emit({
          type: WebSocketEventType.NEW_NOTIFICATION,
          timestamp: new Date().toISOString(),
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            author: {
              did: commit.did,
              handle: "",
              displayName: "",
            },
            reason: "follow",
            record: commit.commit.record,
            isRead: false,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        } as WebSocketMessage);
      }
    }

    // Handle post deletions
    if (collection === "app.bsky.feed.post" && operation === "delete") {
      this.emit({
        type: "timeline:deletepost" as WebSocketEventType,
        timestamp: new Date().toISOString(),
        data: {
          did: commit.did,
          uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
        },
      } as WebSocketMessage);
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.handleError(
            `Error in handler for ${event.type}`,
            error as Error,
          );
        }
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.log("Max reconnection attempts reached", "error");
      this.emit({
        type: WebSocketEventType.ERROR,
        timestamp: new Date().toISOString(),
        error: "Max reconnection attempts exceeded",
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      this.MAX_RECONNECT_DELAY,
    );

    this.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnection attempt ${this.reconnectAttempts}`);
      this.emit({
        type: WebSocketEventType.RECONNECT,
        timestamp: new Date().toISOString(),
      });
      this.connect();
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log(`${message}: ${errorMessage}`, "error");

    this.emit({
      type: WebSocketEventType.ERROR,
      timestamp: new Date().toISOString(),
      error: `${message}: ${errorMessage}`,
    });
  }

  /**
   * Log messages (respects debug config)
   */
  private log(message: string, level: "log" | "warn" | "error" = "log"): void {
    if (this.config.debug) {
      const prefix = "🌊 [Jetstream]";
      switch (level) {
        case "warn":
          debug.warn(`${prefix} ${message}`);
          break;
        case "error":
          debug.error(`${prefix} ${message}`);
          break;
        default:
          debug.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Set up browser event listeners for visibility changes and network status.
   * Disconnects when app goes to background to save bandwidth and battery.
   */
  private setupBrowserEventListeners(): void {
    // Skip in non-browser environments (SSR, tests)
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    // Only set up once
    if (this.boundVisibilityHandler) {
      return;
    }

    // Visibility change handler - disconnect when hidden, reconnect when visible
    this.boundVisibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        // App went to background - disconnect to save bandwidth/battery
        this.log("App went to background, disconnecting to save resources");
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.disconnect();
        }
      } else if (document.visibilityState === "visible") {
        // App came to foreground - reconnect if we should be connected
        this.log("App came to foreground, reconnecting...");
        if (!this.isIntentionallyClosed && !this.isConnected()) {
          this.reconnectAttempts = 0; // Fresh start
          this.connect();
        }
      }
    };

    // Online handler - reconnect when network comes back
    this.boundOnlineHandler = () => {
      this.log("Network came online");
      if (
        !this.isIntentionallyClosed &&
        !this.isConnected() &&
        document.visibilityState === "visible"
      ) {
        this.log("Reconnecting after network came online...");
        this.reconnectAttempts = 0; // Fresh start with network back
        this.connect();
      }
    };

    // Offline handler - log and wait for online event
    this.boundOfflineHandler = () => {
      this.log("Network went offline", "warn");
      // Don't close the connection - let it fail naturally
      // The online handler will reconnect when network returns
    };

    document.addEventListener("visibilitychange", this.boundVisibilityHandler);
    window.addEventListener("online", this.boundOnlineHandler);
    window.addEventListener("offline", this.boundOfflineHandler);

    this.log("Browser event listeners set up (visibility, online/offline)");
  }

  /**
   * Remove browser event listeners when disconnecting.
   */
  private removeBrowserEventListeners(): void {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    if (this.boundVisibilityHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.boundVisibilityHandler,
      );
      this.boundVisibilityHandler = null;
    }

    if (this.boundOnlineHandler) {
      window.removeEventListener("online", this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }

    if (this.boundOfflineHandler) {
      window.removeEventListener("offline", this.boundOfflineHandler);
      this.boundOfflineHandler = null;
    }

    this.log("Browser event listeners removed");
  }
}

// Singleton instance
let jetstreamService: JetstreamService | null = null;

/**
 * Initialize Jetstream service
 */
export function initializeJetstreamService(
  config: JetstreamConfig,
): JetstreamService {
  if (jetstreamService) {
    jetstreamService.disconnect();
  }
  jetstreamService = new JetstreamService(config);
  return jetstreamService;
}

/**
 * Get Jetstream service instance
 */
export function getJetstreamService(): JetstreamService | null {
  return jetstreamService;
}

/**
 * Disconnect and clean up Jetstream service
 */
export function disconnectJetstream(): void {
  if (jetstreamService) {
    jetstreamService.disconnect();
    jetstreamService = null;
  }
}
