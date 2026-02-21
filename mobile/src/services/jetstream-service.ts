/**
 * Jetstream Service - Bluesky Firehose Integration for Mobile
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
 * - AppState-aware: disconnects when backgrounded, reconnects on foreground
 * - Network-aware: pauses when offline, resumes when online
 * - Selective event filtering based on current user DID
 *
 * Ported from web: src/services/jetstream-service.ts
 */

import { AppState, AppStateStatus } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { createLogger } from "../utils/logger";

const logger = createLogger("Jetstream");

/**
 * WebSocket event types emitted by Jetstream service
 */
export enum JetstreamEventType {
  CONNECT = "jetstream:connect",
  DISCONNECT = "jetstream:disconnect",
  ERROR = "jetstream:error",
  RECONNECT = "jetstream:reconnect",
  TIMELINE_NEW_POST = "jetstream:timeline:newpost",
  TIMELINE_DELETE_POST = "jetstream:timeline:deletepost",
  NEW_NOTIFICATION = "jetstream:notification:new",
}

/**
 * Jetstream commit event from the firehose
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

type JetstreamMessage = JetstreamCommit;

/**
 * Notification payload emitted by the service
 */
export interface JetstreamNotification {
  uri: string;
  cid: string;
  authorDid: string;
  reason: "like" | "repost" | "follow" | "reply" | "mention" | "quote";
  reasonSubject?: string;
  record?: Record<string, unknown>;
  indexedAt: string;
}

/**
 * Event payloads for each event type
 */
export type JetstreamEvent =
  | { type: JetstreamEventType.CONNECT }
  | { type: JetstreamEventType.DISCONNECT }
  | { type: JetstreamEventType.ERROR; error: string }
  | { type: JetstreamEventType.RECONNECT; attempt: number }
  | {
      type: JetstreamEventType.TIMELINE_NEW_POST;
      did: string;
      uri: string;
      cid?: string;
    }
  | {
      type: JetstreamEventType.TIMELINE_DELETE_POST;
      did: string;
      uri: string;
    }
  | {
      type: JetstreamEventType.NEW_NOTIFICATION;
      notification: JetstreamNotification;
    };

type EventHandler = (event: JetstreamEvent) => void;

/**
 * Configuration for Jetstream service
 */
export interface JetstreamConfig {
  /** Current user's DID for filtering relevant events */
  userDid: string;
  /** Array of DIDs the user follows (for filtering timeline posts) */
  followedDids?: string[];
}

/**
 * Jetstream Service for real-time Bluesky updates on mobile
 */
export class JetstreamService {
  private ws: WebSocket | null = null;
  private config: JetstreamConfig;
  private eventHandlers: Map<JetstreamEventType, Set<EventHandler>> =
    new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly INITIAL_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 60000;
  private readonly JITTER_FACTOR = 0.2;

  private readonly JETSTREAM_URL =
    "wss://jetstream1.us-east.bsky.network/subscribe";

  // Stats
  private stats = {
    messagesReceived: 0,
    postsReceived: 0,
    notificationsReceived: 0,
    lastEventTime: null as Date | null,
  };

  // Mobile-specific: AppState and network subscriptions
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private isNetworkOnline = true;
  private wasConnectedBeforeBackground = false;

  constructor(config: JetstreamConfig) {
    this.config = { ...config, followedDids: config.followedDids || [] };
  }

  /**
   * Connect to Jetstream firehose
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!this.isNetworkOnline) {
      logger.log("Network offline, deferring connection");
      return;
    }

    this.isIntentionallyClosed = false;
    logger.log("Connecting to Jetstream");

    this.setupMobileListeners();

    try {
      const params = new URLSearchParams();
      // URLSearchParams.set replaces, we need append for multiple values
      params.append("wantedCollections", "app.bsky.feed.post");
      params.append("wantedCollections", "app.bsky.feed.like");
      params.append("wantedCollections", "app.bsky.feed.repost");
      params.append("wantedCollections", "app.bsky.graph.follow");

      const url = `${this.JETSTREAM_URL}?${params.toString()}`;
      this.ws = new WebSocket(url);
      this.setupWebSocketListeners();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Failed to create Jetstream connection:", msg);
      this.emit({ type: JetstreamEventType.ERROR, error: msg });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from Jetstream
   */
  public disconnect(): void {
    logger.log("Disconnecting from Jetstream");
    this.isIntentionallyClosed = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  /**
   * Full cleanup: disconnect and remove all listeners
   */
  public destroy(): void {
    this.disconnect();
    this.removeMobileListeners();
    this.eventHandlers.clear();
  }

  /**
   * Register an event handler
   */
  public on(eventType: JetstreamEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  public off(eventType: JetstreamEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
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
  }

  /**
   * Get service stats
   */
  public getStats() {
    return { ...this.stats };
  }

  /**
   * Whether reconnection attempts have been exhausted
   */
  public isReconnectExhausted(): boolean {
    return this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS;
  }

  /**
   * Get current reconnection attempt count
   */
  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Reset reconnection state (e.g., for manual retry after exhaustion)
   */
  public resetReconnect(): void {
    this.reconnectAttempts = 0;
    this.isIntentionallyClosed = false;
    this.clearReconnectTimer();
  }

  // --- WebSocket event wiring ---

  private setupWebSocketListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      logger.log("Connected to Jetstream");
      this.reconnectAttempts = 0;
      this.emit({ type: JetstreamEventType.CONNECT });
    };

    this.ws.onclose = () => {
      this.emit({ type: JetstreamEventType.DISCONNECT });

      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit({
        type: JetstreamEventType.ERROR,
        error: "WebSocket error",
      });
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      this.handleMessage(
        typeof event.data === "string" ? event.data : "",
      );
    };
  }

  // --- Message handling ---

  private handleMessage(data: string): void {
    this.stats.messagesReceived++;
    this.stats.lastEventTime = new Date();

    try {
      const message: JetstreamMessage = JSON.parse(data);

      if (message.kind === "commit") {
        this.handleCommitEvent(message);
      }
    } catch {
      // Malformed message, skip
    }
  }

  private handleCommitEvent(commit: JetstreamCommit): void {
    const { collection, operation } = commit.commit;

    // New post from followed account
    if (
      collection === "app.bsky.feed.post" &&
      (operation === "create" || operation === "update")
    ) {
      if (
        this.config.followedDids &&
        this.config.followedDids.includes(commit.did)
      ) {
        this.stats.postsReceived++;
        this.emit({
          type: JetstreamEventType.TIMELINE_NEW_POST,
          did: commit.did,
          uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
          cid: commit.commit.cid,
        });
      }
    }

    // Like on current user's post
    if (
      collection === "app.bsky.feed.like" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as {
        subject?: { uri?: string };
      };
      const subjectUri = record.subject?.uri;

      if (
        subjectUri &&
        subjectUri.startsWith(`at://${this.config.userDid}/`)
      ) {
        this.stats.notificationsReceived++;
        this.emit({
          type: JetstreamEventType.NEW_NOTIFICATION,
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            authorDid: commit.did,
            reason: "like",
            reasonSubject: subjectUri,
            record: commit.commit.record,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        });
      }
    }

    // Repost of current user's post
    if (
      collection === "app.bsky.feed.repost" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as {
        subject?: { uri?: string };
      };
      const subjectUri = record.subject?.uri;

      if (
        subjectUri &&
        subjectUri.startsWith(`at://${this.config.userDid}/`)
      ) {
        this.stats.notificationsReceived++;
        this.emit({
          type: JetstreamEventType.NEW_NOTIFICATION,
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            authorDid: commit.did,
            reason: "repost",
            reasonSubject: subjectUri,
            record: commit.commit.record,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        });
      }
    }

    // New follow of current user
    if (
      collection === "app.bsky.graph.follow" &&
      operation === "create" &&
      commit.commit.record
    ) {
      const record = commit.commit.record as { subject?: string };
      const subjectDid = record.subject;

      if (subjectDid === this.config.userDid) {
        this.stats.notificationsReceived++;
        this.emit({
          type: JetstreamEventType.NEW_NOTIFICATION,
          notification: {
            uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
            cid: commit.commit.cid || "",
            authorDid: commit.did,
            reason: "follow",
            record: commit.commit.record,
            indexedAt: new Date(commit.time_us / 1000).toISOString(),
          },
        });
      }
    }

    // Post deletion
    if (collection === "app.bsky.feed.post" && operation === "delete") {
      this.emit({
        type: JetstreamEventType.TIMELINE_DELETE_POST,
        did: commit.did,
        uri: `at://${commit.did}/${collection}/${commit.commit.rkey}`,
      });
    }
  }

  // --- Event emission ---

  private emit(event: JetstreamEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch {
          // Handler error, skip
        }
      });
    }
  }

  // --- Reconnection ---

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error("Max reconnection attempts reached");
      this.emit({
        type: JetstreamEventType.ERROR,
        error: "Max reconnection attempts exceeded",
      });
      return;
    }

    this.reconnectAttempts++;
    const baseDelay = Math.min(
      this.INITIAL_RECONNECT_DELAY *
        Math.pow(2, this.reconnectAttempts - 1),
      this.MAX_RECONNECT_DELAY,
    );
    // Add ±20% jitter to prevent thundering herd
    const jitter = baseDelay * this.JITTER_FACTOR * (2 * Math.random() - 1);
    const delay = Math.max(0, Math.round(baseDelay + jitter));

    logger.log(
      `Reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.emit({
        type: JetstreamEventType.RECONNECT,
        attempt: this.reconnectAttempts,
      });
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // --- Mobile lifecycle management ---

  private setupMobileListeners(): void {
    if (this.appStateSubscription) return;

    // AppState: disconnect on background, reconnect on foreground
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
    );

    // Network: track online/offline
    this.netInfoUnsubscribe = NetInfo.addEventListener(
      this.handleNetworkChange,
    );
  }

  private removeMobileListeners(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === "active") {
      // App came to foreground
      if (this.wasConnectedBeforeBackground && !this.isConnected()) {
        logger.log("App foregrounded, reconnecting");
        this.reconnectAttempts = 0;
        this.isIntentionallyClosed = false;
        this.connect();
      }
    } else if (nextState === "background" || nextState === "inactive") {
      // App going to background - disconnect to save battery
      this.wasConnectedBeforeBackground = this.isConnected();
      if (this.isConnected()) {
        logger.log("App backgrounded, disconnecting to save resources");
        this.disconnect();
      }
    }
  };

  private handleNetworkChange = (state: NetInfoState): void => {
    const wasOnline = this.isNetworkOnline;
    this.isNetworkOnline = state.isConnected === true;

    if (!wasOnline && this.isNetworkOnline) {
      // Network restored
      if (!this.isIntentionallyClosed && !this.isConnected()) {
        logger.log("Network restored, reconnecting");
        this.reconnectAttempts = 0;
        this.connect();
      }
    }
  };
}

// --- Singleton management ---

let jetstreamInstance: JetstreamService | null = null;

export function initializeJetstreamService(
  config: JetstreamConfig,
): JetstreamService {
  if (jetstreamInstance) {
    jetstreamInstance.destroy();
  }
  jetstreamInstance = new JetstreamService(config);
  return jetstreamInstance;
}

export function getJetstreamService(): JetstreamService | null {
  return jetstreamInstance;
}

export function disconnectJetstream(): void {
  if (jetstreamInstance) {
    jetstreamInstance.destroy();
    jetstreamInstance = null;
  }
}
