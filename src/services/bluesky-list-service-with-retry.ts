/**
 * Example: Bluesky List Service with Retry Logic
 *
 * This file demonstrates how to integrate the RetryClient into the bluesky-list-service.ts
 * to add automatic retry with exponential backoff and circuit breaker protection.
 *
 * To use this in production:
 * 1. Replace imports in files that use bluesky-list-service.ts to use this file instead
 * 2. Or copy the retry integration pattern into the original bluesky-list-service.ts
 */

import { AppBskyGraphList, AtpAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { RetryClient } from "../utils/retry-client";

const logger = createLogger("BlueskyListServiceWithRetry");

// Create a RetryClient instance with exponential backoff (1s, 2s, 4s, 8s)
const retryClient = new RetryClient(
  {
    maxRetries: 3,
    initialDelayMs: 1000, // First retry after 1s
    maxDelayMs: 8000, // Max delay of 8s
    exponentialBase: 2, // Doubles each time: 1s -> 2s -> 4s -> 8s
    onRetry: (error, attempt, delayMs) => {
      logger.log(
        `Retrying API call (attempt ${attempt}/3) after ${Math.round(delayMs / 1000)}s`,
        error?.message || error,
      );
    },
  },
  {
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    resetTimeoutMs: 60000, // Try again after 60 seconds
    halfOpenMaxAttempts: 2, // Require 2 successes to close circuit
  },
);

export interface BlueskyList {
  uri: string;
  cid: string;
  name: string;
  description?: string;
  avatar?: string;
  listItemCount?: number;
  indexedAt: string;
  viewer?: {
    muted?: boolean;
    blocked?: string;
  };
}

export interface BlueskyListMember {
  uri: string;
  subject: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
}

class BlueskyListServiceWithRetry {
  private agent: AtpAgent | null = null;
  private initialized = false;

  async initialize(agent: AtpAgent): Promise<void> {
    if (!agent) {
      throw new Error("Agent is required for list service");
    }
    this.agent = agent;
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized || !this.agent) {
      throw new Error("List service not initialized. Call initialize() first.");
    }
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState() {
    return retryClient.getCircuitBreakerState();
  }

  /**
   * Reset circuit breaker (useful for testing or manual intervention)
   */
  resetCircuitBreaker() {
    retryClient.resetCircuitBreaker();
  }

  async getMyLists(): Promise<BlueskyList[]> {
    this.ensureInitialized();

    // Wrap the API call with retry logic
    return retryClient.execute(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const response = await this.agent!.app.bsky.graph.getLists({
        actor: did,
        limit: 100,
      });

      return response.data.lists.map((list) => ({
        uri: list.uri,
        cid: list.cid,
        name: list.name,
        description: list.description,
        avatar: list.avatar,
        listItemCount: list.listItemCount,
        indexedAt: list.indexedAt,
        viewer: list.viewer,
      }));
    });
  }

  async getList(uri: string): Promise<BlueskyList | null> {
    this.ensureInitialized();

    try {
      return await retryClient.execute(async () => {
        const response = await this.agent!.app.bsky.graph.getList({
          list: uri,
          limit: 1,
        });

        const list = response.data.list;
        return {
          uri: list.uri,
          cid: list.cid,
          name: list.name,
          description: list.description,
          avatar: list.avatar,
          listItemCount: list.listItemCount,
          indexedAt: list.indexedAt,
          viewer: list.viewer,
        };
      });
    } catch (error) {
      logger.error(`Failed to fetch list ${uri}:`, error);
      return null;
    }
  }

  async createList(
    name: string,
    description?: string,
    avatar?: Blob,
  ): Promise<BlueskyList> {
    this.ensureInitialized();

    return retryClient.execute(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      let avatarBlob;
      if (avatar) {
        const uploadResponse = await this.agent!.uploadBlob(avatar, {
          encoding: avatar.type,
        });
        avatarBlob = uploadResponse.data.blob;
      }

      const record: AppBskyGraphList.Record = {
        $type: "app.bsky.graph.list",
        purpose: "app.bsky.graph.defs#curatelist",
        name,
        description,
        avatar: avatarBlob,
        createdAt: new Date().toISOString(),
      };

      const response = await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        record,
      });

      return {
        uri: response.data.uri,
        cid: response.data.cid,
        name,
        description,
        avatar: avatarBlob ? undefined : undefined,
        listItemCount: 0,
        indexedAt: new Date().toISOString(),
      };
    });
  }

  async updateList(
    uri: string,
    updates: { name?: string; description?: string },
  ): Promise<void> {
    this.ensureInitialized();

    return retryClient.execute(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const existingList = await this.getList(uri);
      if (!existingList) {
        throw new Error(`List ${uri} not found`);
      }

      const rkey = uri.split("/").pop();
      if (!rkey) throw new Error("Invalid list URI");

      const record: AppBskyGraphList.Record = {
        $type: "app.bsky.graph.list",
        purpose: "app.bsky.graph.defs#curatelist",
        name: updates.name || existingList.name,
        description:
          updates.description !== undefined
            ? updates.description
            : existingList.description,
        createdAt: existingList.indexedAt,
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        rkey,
        record,
      });
    });
  }

  async deleteList(uri: string): Promise<void> {
    this.ensureInitialized();

    return retryClient.execute(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const rkey = uri.split("/").pop();
      if (!rkey) throw new Error("Invalid list URI");

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        rkey,
      });
    });
  }
}

export const blueskyListServiceWithRetry = new BlueskyListServiceWithRetry();
