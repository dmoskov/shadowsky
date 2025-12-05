/**
 * OAuth Service for AT Protocol authentication
 * Uses @atproto/oauth-client-browser for secure OAuth flow
 *
 * NOTE: The @atproto/oauth-client-browser package (~328KB) is dynamically imported
 * only when OAuth functionality is actually needed:
 * 1. When there's an existing OAuth session to restore
 * 2. When the user initiates OAuth login
 * 3. When handling an OAuth callback
 *
 * This deferred loading reduces initial bundle size for users who:
 * - Haven't used OAuth before
 * - Use app-password authentication
 * - Are visiting for the first time
 */

import { Agent } from "@atproto/api";
import { debug } from "@bsky/shared";

// Type-only import for TypeScript - doesn't affect bundle
import type {
  BrowserOAuthClient as BrowserOAuthClientType,
  OAuthSession,
} from "@atproto/oauth-client-browser";

// OAuth client IndexedDB database name (matches @atproto/oauth-client-browser)
const OAUTH_DB_NAME = "@atproto-oauth-client";

/**
 * Lightweight check if an OAuth session might exist without loading the full OAuth client.
 * This checks if the OAuth IndexedDB database exists and has data.
 * Returns true if we should load the full OAuth client, false if we can skip it.
 */
export async function hasExistingOAuthSession(): Promise<boolean> {
  // Check if we're on an OAuth callback URL - if so, we definitely need the client
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") || params.has("state") || params.has("iss")) {
    debug.log("OAuth callback detected, will load OAuth client");
    return true;
  }

  // Check if IndexedDB is available
  if (!("indexedDB" in window)) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      // Try to open the OAuth database
      const request = indexedDB.open(OAUTH_DB_NAME);

      request.onerror = () => {
        // Database doesn't exist or error accessing it
        resolve(false);
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          // Check if the database has any object stores (indicating it was initialized)
          const hasStores = db.objectStoreNames.length > 0;
          db.close();

          if (hasStores) {
            debug.log("Existing OAuth database found, will load OAuth client");
          }
          resolve(hasStores);
        } catch {
          db.close();
          resolve(false);
        }
      };

      request.onupgradeneeded = () => {
        // This means the database doesn't exist (we're creating it)
        // Abort the upgrade and clean up
        request.transaction?.abort();
        // Delete the database we just created
        indexedDB.deleteDatabase(OAUTH_DB_NAME);
        resolve(false);
      };

      // Timeout after 500ms to prevent blocking
      setTimeout(() => {
        resolve(false);
      }, 500);
    } catch {
      resolve(false);
    }
  });
}

// Lazy-loaded OAuth client module
let OAuthClientModule: typeof import("@atproto/oauth-client-browser") | null =
  null;

async function loadOAuthClient(): Promise<
  typeof import("@atproto/oauth-client-browser")
> {
  if (!OAuthClientModule) {
    debug.log("Loading OAuth client module (~328KB)...");
    OAuthClientModule = await import("@atproto/oauth-client-browser");
    debug.log("OAuth client module loaded");
  }
  return OAuthClientModule;
}

// Determine the client ID based on environment
function getClientId(): string {
  const hostname = window.location.hostname;

  // Local development - use local proxy to avoid CORS issues
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Use local proxy which forwards to shadowsky.io/client-metadata.json
    // The actual client_id in the metadata still points to shadowsky.io
    return `${window.location.origin}/proxy-client-metadata`;
  }

  // Production
  return `https://${hostname}/client-metadata.json`;
}

export interface OAuthState {
  session: OAuthSession | null;
  agent: Agent | null;
  did: string | null;
  handle: string | null;
}

type OAuthEventType = "session" | "deleted";
type OAuthEventCallback = (state: OAuthState) => void;
type OAuthDeletedCallback = (event: { sub: string; cause: Error }) => void;

class OAuthService {
  private client: BrowserOAuthClientType | null = null;
  private currentSession: OAuthSession | null = null;
  private currentAgent: Agent | null = null;
  private initPromise: Promise<OAuthState | null> | null = null;
  private eventListeners: Map<
    OAuthEventType,
    Set<OAuthEventCallback | OAuthDeletedCallback>
  > = new Map();

  /**
   * Initialize the OAuth client and check for existing sessions
   */
  async init(): Promise<OAuthState | null> {
    // Return cached promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<OAuthState | null> {
    try {
      const clientId = getClientId();
      debug.log("Initializing OAuth client with clientId:", clientId);

      // Dynamically load the OAuth client module
      const { BrowserOAuthClient } = await loadOAuthClient();

      // Try to load the OAuth client - this may fail if client-metadata.json isn't deployed yet
      try {
        this.client = await BrowserOAuthClient.load({
          clientId,
          handleResolver: "https://bsky.social",
        });
      } catch (loadError) {
        // Client metadata not available - OAuth won't work but app-password login will
        debug.log(
          "OAuth client metadata not available, OAuth login disabled:",
          loadError,
        );
        this.initPromise = null;
        return null;
      }

      // Listen for session deletion events (token revocation, expiry, etc.)
      this.client.addEventListener(
        "deleted",
        (event: CustomEvent<{ sub: string; cause: unknown }>) => {
          debug.log("OAuth session deleted:", event.detail);
          this.currentSession = null;
          this.currentAgent = null;
          this.emitEvent("deleted", {
            sub: event.detail.sub,
            cause: event.detail.cause as Error,
          });
        },
      );

      // Try to restore existing session
      const result = await this.client.init();

      if (result?.session) {
        debug.log("OAuth session restored");
        this.currentSession = result.session;
        this.currentAgent = new Agent(result.session);

        const state = this.getState();
        this.emitEvent("session", state);
        return state;
      }

      debug.log("No existing OAuth session");
      return null;
    } catch (error) {
      debug.error("Failed to initialize OAuth client:", error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Start the OAuth authorization flow
   * This will redirect the user to their PDS for authentication
   */
  async authorize(handle: string): Promise<void> {
    if (!this.client) {
      await this.init();
    }

    if (!this.client) {
      throw new Error("OAuth client not initialized");
    }

    try {
      // Clean up handle (remove @ if present)
      const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

      debug.log("Starting OAuth authorization for:", cleanHandle);

      // Get the authorization URL
      const url = await this.client.authorize(cleanHandle, {
        scope: "atproto transition:generic",
      });

      debug.log("Redirecting to authorization URL");

      // Redirect to the authorization server
      window.location.href = url.toString();
    } catch (error) {
      debug.error("OAuth authorization failed:", error);
      throw error;
    }
  }

  /**
   * Handle the OAuth callback after authorization
   * Call this when the user is redirected back from the authorization server
   */
  async handleCallback(): Promise<OAuthState | null> {
    if (!this.client) {
      await this.init();
    }

    if (!this.client) {
      throw new Error("OAuth client not initialized");
    }

    try {
      // The init() method handles the callback if we're on the callback URL
      const result = await this.client.init();

      if (result?.session) {
        debug.log("OAuth callback successful");
        this.currentSession = result.session;
        this.currentAgent = new Agent(result.session);

        const state = this.getState();
        this.emitEvent("session", state);
        return state;
      }

      return null;
    } catch (error) {
      debug.error("OAuth callback handling failed:", error);
      throw error;
    }
  }

  /**
   * Sign out and revoke the current session
   */
  async signOut(): Promise<void> {
    if (this.currentSession) {
      try {
        await this.currentSession.signOut();
      } catch (error) {
        debug.error("Error during OAuth sign out:", error);
      }
    }

    this.currentSession = null;
    this.currentAgent = null;
    this.emitEvent("session", this.getState());
  }

  /**
   * Get the current Agent for making API calls
   */
  getAgent(): Agent | null {
    return this.currentAgent;
  }

  /**
   * Get the current session
   */
  getSession(): OAuthSession | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active session
   */
  isAuthenticated(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Check if OAuth is available (client metadata loaded successfully)
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Get the current state
   */
  getState(): OAuthState {
    return {
      session: this.currentSession,
      agent: this.currentAgent,
      did: this.currentSession?.did ?? null,
      // Handle is fetched separately via the agent's profile
      handle: null,
    };
  }

  /**
   * Subscribe to OAuth events
   */
  addEventListener(type: "session", callback: OAuthEventCallback): void;
  addEventListener(type: "deleted", callback: OAuthDeletedCallback): void;
  addEventListener(
    type: OAuthEventType,
    callback: OAuthEventCallback | OAuthDeletedCallback,
  ): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(callback);
  }

  /**
   * Unsubscribe from OAuth events
   */
  removeEventListener(
    type: OAuthEventType,
    callback: OAuthEventCallback | OAuthDeletedCallback,
  ): void {
    this.eventListeners.get(type)?.delete(callback);
  }

  private emitEvent(type: "session", state: OAuthState): void;
  private emitEvent(
    type: "deleted",
    detail: { sub: string; cause: Error },
  ): void;
  private emitEvent(
    type: OAuthEventType,
    data: OAuthState | { sub: string; cause: Error },
  ): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const callback of listeners) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (callback as (arg: any) => void)(data);
        } catch (error) {
          debug.error(`Error in OAuth event listener (${type}):`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
