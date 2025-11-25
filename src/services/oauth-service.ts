/**
 * OAuth Service for AT Protocol authentication
 * Uses @atproto/oauth-client-browser for secure OAuth flow
 */

import { Agent } from "@atproto/api";
import {
  BrowserOAuthClient,
  type OAuthSession,
} from "@atproto/oauth-client-browser";
import { debug } from "@bsky/shared";

// Determine the client ID based on environment
function getClientId(): string {
  const hostname = window.location.hostname;

  // Local development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // For local dev, we need to use the production URL since client metadata must be publicly accessible
    // The redirect_uris in the metadata include localhost for development
    return "https://shadowsky.io/client-metadata.json";
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
  private client: BrowserOAuthClient | null = null;
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
