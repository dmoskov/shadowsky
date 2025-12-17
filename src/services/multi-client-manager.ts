/**
 * Multi-client manager for per-account AT Protocol sessions
 * Maintains separate BskyAgent instances per account to preserve sessions
 */

import type { AtpSessionData } from "@atproto/api";
import { BskyAgent } from "@atproto/api";
import { debug } from "../shared/debug";
import { AccountManager, type StoredAccount } from "./account-manager";

export interface ManagedClient {
  agent: BskyAgent;
  did: string;
  handle: string;
  lastUsed: number;
}

class MultiClientManager {
  private clients: Map<string, ManagedClient> = new Map();
  private activeClientDid: string | null = null;

  /**
   * Get or create a client for a specific account
   */
  getClient(did: string): ManagedClient | null {
    return this.clients.get(did) || null;
  }

  /**
   * Get the currently active client
   */
  getActiveClient(): ManagedClient | null {
    if (!this.activeClientDid) return null;
    return this.clients.get(this.activeClientDid) || null;
  }

  /**
   * Create a new client and login
   */
  async login(
    identifier: string,
    password: string,
    serviceUrl: string = "https://bsky.social",
    authFactorToken?: string,
  ): Promise<ManagedClient> {
    const agent = new BskyAgent({ service: serviceUrl });

    try {
      const response = await agent.login({
        identifier: identifier.startsWith("@")
          ? identifier.slice(1)
          : identifier,
        password,
        authFactorToken,
      });

      const did = response.data.did;
      const handle = response.data.handle;

      const managedClient: ManagedClient = {
        agent,
        did,
        handle,
        lastUsed: Date.now(),
      };

      this.clients.set(did, managedClient);
      this.activeClientDid = did;

      debug.log(`[MultiClientManager] Created client for ${handle} (${did})`);
      return managedClient;
    } catch (error) {
      debug.error("[MultiClientManager] Login failed:", error);
      throw error;
    }
  }

  /**
   * Resume a session from stored account data
   */
  async resumeSession(account: StoredAccount): Promise<ManagedClient> {
    // Check if we already have a client for this account
    const existingClient = this.clients.get(account.did);
    if (existingClient) {
      debug.log(
        `[MultiClientManager] Reusing existing client for ${account.handle}`,
      );
      existingClient.lastUsed = Date.now();
      this.activeClientDid = account.did;
      return existingClient;
    }

    // Validate session data before attempting to resume
    const session = account.session as AtpSessionData;
    if (!session?.accessJwt || !session?.refreshJwt) {
      debug.error(
        `[MultiClientManager] Invalid session data for ${account.handle}: missing tokens`,
      );
      const error = new Error("Invalid session: missing authentication tokens");
      (error as Error & { status: number }).status = 400;
      throw error;
    }

    // Create new agent and resume session
    const agent = new BskyAgent({ service: "https://bsky.social" });

    try {
      await agent.resumeSession(session);

      const managedClient: ManagedClient = {
        agent,
        did: account.did,
        handle: account.handle,
        lastUsed: Date.now(),
      };

      this.clients.set(account.did, managedClient);
      this.activeClientDid = account.did;

      debug.log(`[MultiClientManager] Resumed session for ${account.handle}`);
      return managedClient;
    } catch (error) {
      debug.error(
        `[MultiClientManager] Failed to resume session for ${account.handle}:`,
        error,
      );
      // Ensure error has status for proper handling upstream
      const err = error as Error & { status?: number; statusCode?: number };
      if (!err.status && err.statusCode) {
        err.status = err.statusCode;
      }
      // Default to 400 for session resume failures
      if (!err.status) {
        err.status = 400;
      }
      throw error;
    }
  }

  /**
   * Switch to an existing client
   */
  async switchTo(did: string): Promise<ManagedClient> {
    // Check if we have an existing client with a valid session
    const existingClient = this.clients.get(did);
    if (existingClient) {
      // Verify the session is still valid by making a simple API call
      try {
        await existingClient.agent.getProfile({ actor: did });
        existingClient.lastUsed = Date.now();
        this.activeClientDid = did;
        debug.log(
          `[MultiClientManager] Switched to existing client for ${existingClient.handle}`,
        );
        return existingClient;
      } catch (_error) {
        debug.log(
          `[MultiClientManager] Existing client session invalid, will try to resume`,
        );
        this.clients.delete(did);
      }
    }

    // Try to resume from stored account
    const account = AccountManager.getAllAccounts().find(
      (acc) => acc.did === did,
    );
    if (!account) {
      throw new Error(`Account not found: ${did}`);
    }

    return this.resumeSession(account);
  }

  /**
   * Remove a client
   */
  removeClient(did: string): void {
    this.clients.delete(did);
    if (this.activeClientDid === did) {
      this.activeClientDid = null;
    }
    debug.log(`[MultiClientManager] Removed client for ${did}`);
  }

  /**
   * Clear all clients
   */
  clearAll(): void {
    this.clients.clear();
    this.activeClientDid = null;
    debug.log("[MultiClientManager] Cleared all clients");
  }

  /**
   * Get count of managed clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Set active client by DID
   */
  setActiveClient(did: string): void {
    if (this.clients.has(did)) {
      this.activeClientDid = did;
    }
  }
}

// Export singleton instance
export const multiClientManager = new MultiClientManager();
