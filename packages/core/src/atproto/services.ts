/**
 * Service classes for AT Protocol operations.
 *
 * Platform-agnostic: each service is constructed with an `AgentLike` — either a
 * raw `BskyAgent` or any object exposing one as `.agent` (e.g. a platform client
 * wrapper). Session persistence (cookies on web, secure-store on mobile) stays
 * in each app's own client; only these agent-driven operations are shared.
 */

import type { BskyAgent } from "@atproto/api";
import { logger } from "../logger";
import * as profiles from "./profiles";

/** A BskyAgent, or any wrapper exposing one as `.agent`. */
export type AgentLike = BskyAgent | { agent: BskyAgent };

function resolveAgent(client: AgentLike): BskyAgent {
  return "agent" in client ? client.agent : client;
}

export class FeedService {
  private client: AgentLike;

  constructor(client: AgentLike) {
    this.client = client;
  }

  async getFeed(params?: { limit?: number; cursor?: string }) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.getTimeline(params);
      return response.data;
    } catch (error) {
      logger.error("Failed to fetch feed:", error);
      throw error;
    }
  }

  initializeDeduplication() {
    // Placeholder for deduplication logic
    logger.log("Feed deduplication initialized");
  }
}

export class AnalyticsService {
  trackEvent(event: string, properties?: Record<string, unknown>) {
    logger.log("Analytics event:", event, properties);
  }

  trackPageView(page: string) {
    logger.log("Page view:", page);
  }
}

export class InteractionsService {
  private client: AgentLike;

  constructor(client: AgentLike) {
    this.client = client;
  }

  async like(uri: string, cid: string) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.like(uri, cid);
      return response;
    } catch (error) {
      logger.error("Failed to like post:", error);
      throw error;
    }
  }

  async unlike(likeUri: string) {
    try {
      const agent = resolveAgent(this.client);
      await agent.deleteLike(likeUri);
    } catch (error) {
      logger.error("Failed to unlike post:", error);
      throw error;
    }
  }

  async repost(uri: string, cid: string) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.repost(uri, cid);
      return response;
    } catch (error) {
      logger.error("Failed to repost:", error);
      throw error;
    }
  }

  async unrepost(repostUri: string) {
    try {
      const agent = resolveAgent(this.client);
      await agent.deleteRepost(repostUri);
    } catch (error) {
      logger.error("Failed to unrepost:", error);
      throw error;
    }
  }

  async createPost(text: string) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.post({ text });
      return response;
    } catch (error) {
      logger.error("Failed to create post:", error);
      throw error;
    }
  }

  async createPostWithImages(text: string, images: any[]) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.post({
        text,
        embed: {
          $type: "app.bsky.embed.images",
          images,
        },
      });
      return response;
    } catch (error) {
      logger.error("Failed to create post with images:", error);
      throw error;
    }
  }

  async createReply(text: string, root: any, parent: any) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.post({
        text,
        reply: {
          root,
          parent,
        },
      });
      return response;
    } catch (error) {
      logger.error("Failed to create reply:", error);
      throw error;
    }
  }

  async createReplyWithImages(
    text: string,
    root: any,
    parent: any,
    images: any[],
  ) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.post({
        text,
        reply: {
          root,
          parent,
        },
        embed: {
          $type: "app.bsky.embed.images",
          images,
        },
      });
      return response;
    } catch (error) {
      logger.error("Failed to create reply with images:", error);
      throw error;
    }
  }
}

export class ThreadService {
  private client: AgentLike;

  constructor(client: AgentLike) {
    this.client = client;
  }

  async getThread(uri: string, depth?: number) {
    try {
      const agent = resolveAgent(this.client);
      const response = await agent.getPostThread({ uri, depth });
      return response.data;
    } catch (error) {
      logger.error("Failed to fetch thread:", error);
      throw error;
    }
  }
}

/**
 * Backward-compatible class wrapper over the canonical `profiles` functions.
 * Preserves the historical web `@bsky/shared` contract (e.g. `block`/`follow`
 * return the record uri). New code should prefer the functions directly.
 */
export class ProfileService {
  private client: AgentLike;

  constructor(client: AgentLike) {
    this.client = client;
  }

  getProfile(actor: string) {
    return profiles.getProfile(resolveAgent(this.client), actor);
  }

  getProfiles(actors: string[]) {
    return profiles.getProfiles(resolveAgent(this.client), actors);
  }

  getAuthorFeed(
    actor: string,
    limit?: number,
    cursor?: string,
    filter?: string,
  ) {
    return profiles.getAuthorFeed(
      resolveAgent(this.client),
      actor,
      limit,
      cursor,
      filter,
    );
  }

  async follow(did: string) {
    const response = await profiles.followUser(resolveAgent(this.client), did);
    return response.uri;
  }

  unfollow(followUri: string) {
    return profiles.unfollowUser(resolveAgent(this.client), followUri);
  }

  async block(did: string) {
    const response = await profiles.blockUser(resolveAgent(this.client), did);
    return response.uri;
  }

  unblock(blockUri: string) {
    return profiles.unblockUser(resolveAgent(this.client), blockUri);
  }

  mute(did: string) {
    return profiles.muteUser(resolveAgent(this.client), did);
  }

  unmute(did: string) {
    return profiles.unmuteUser(resolveAgent(this.client), did);
  }
}

// Service factory functions
export function getInteractionsService(client: AgentLike) {
  return new InteractionsService(client);
}

export function getThreadService(client: AgentLike) {
  return new ThreadService(client);
}

export function getProfileService(client: AgentLike) {
  return new ProfileService(client);
}
