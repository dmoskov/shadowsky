/**
 * Service classes for AT Protocol operations
 */

import type { BskyAgent } from "@atproto/api";
import type { ATProtoClient } from "./client";
import { debug } from "./debug";

export class FeedService {
  private client: ATProtoClient | BskyAgent;

  constructor(client: ATProtoClient | BskyAgent) {
    this.client = client;
  }

  async getFeed(params?: { limit?: number; cursor?: string }) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.getTimeline(params);
      return response.data;
    } catch (error) {
      debug.error("Failed to fetch feed:", error);
      throw error;
    }
  }

  initializeDeduplication() {
    // Placeholder for deduplication logic
    debug.log("Feed deduplication initialized");
  }
}

export class AnalyticsService {
  trackEvent(event: string, properties?: Record<string, any>) {
    debug.log("Analytics event:", event, properties);
  }

  trackPageView(page: string) {
    debug.log("Page view:", page);
  }
}

export class InteractionsService {
  private client: ATProtoClient | BskyAgent;

  constructor(client: ATProtoClient | BskyAgent) {
    this.client = client;
  }

  async like(uri: string, cid: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.like(uri, cid);
      return response;
    } catch (error) {
      debug.error("Failed to like post:", error);
      throw error;
    }
  }

  async unlike(likeUri: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      await agent.deleteLike(likeUri);
    } catch (error) {
      debug.error("Failed to unlike post:", error);
      throw error;
    }
  }

  async repost(uri: string, cid: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.repost(uri, cid);
      return response;
    } catch (error) {
      debug.error("Failed to repost:", error);
      throw error;
    }
  }

  async unrepost(repostUri: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      await agent.deleteRepost(repostUri);
    } catch (error) {
      debug.error("Failed to unrepost:", error);
      throw error;
    }
  }

  async createPost(text: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.post({ text });
      return response;
    } catch (error) {
      debug.error("Failed to create post:", error);
      throw error;
    }
  }

  async createPostWithImages(text: string, images: any[]) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.post({
        text,
        embed: {
          $type: "app.bsky.embed.images",
          images,
        },
      });
      return response;
    } catch (error) {
      debug.error("Failed to create post with images:", error);
      throw error;
    }
  }

  async createReply(text: string, root: any, parent: any) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.post({
        text,
        reply: {
          root,
          parent,
        },
      });
      return response;
    } catch (error) {
      debug.error("Failed to create reply:", error);
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
      const agent = "agent" in this.client ? this.client.agent : this.client;
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
      debug.error("Failed to create reply with images:", error);
      throw error;
    }
  }
}

export class ThreadService {
  private client: ATProtoClient | BskyAgent;

  constructor(client: ATProtoClient | BskyAgent) {
    this.client = client;
  }

  async getThread(uri: string, depth?: number) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.getPostThread({ uri, depth });
      return response.data;
    } catch (error) {
      debug.error("Failed to fetch thread:", error);
      throw error;
    }
  }
}

export class ProfileService {
  private client: ATProtoClient | BskyAgent;

  constructor(client: ATProtoClient | BskyAgent) {
    this.client = client;
  }

  async getProfile(actor: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.getProfile({ actor });
      return response.data;
    } catch (error) {
      debug.error("Failed to fetch profile:", error);
      throw error;
    }
  }

  async getProfiles(actors: string[]) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.getProfiles({ actors });
      return response.data;
    } catch (error) {
      debug.error("Failed to fetch profiles:", error);
      throw error;
    }
  }

  async getAuthorFeed(
    actor: string,
    limit?: number,
    cursor?: string,
    filter?: string,
  ) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.getAuthorFeed({
        actor,
        limit: limit || 30,
        cursor,
        filter,
      });
      return response.data;
    } catch (error) {
      debug.error("Failed to fetch author feed:", error);
      throw error;
    }
  }

  async follow(did: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.follow(did);
      return response.uri;
    } catch (error) {
      debug.error("Failed to follow user:", error);
      throw error;
    }
  }

  async unfollow(followUri: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      await agent.deleteFollow(followUri);
    } catch (error) {
      debug.error("Failed to unfollow user:", error);
      throw error;
    }
  }

  async block(did: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const response = await agent.com.atproto.repo.createRecord({
        repo: agent.session?.did || "",
        collection: "app.bsky.graph.block",
        record: {
          subject: did,
          createdAt: new Date().toISOString(),
        },
      });
      return response.data.uri;
    } catch (error) {
      debug.error("Failed to block user:", error);
      throw error;
    }
  }

  async unblock(blockUri: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      const [repo, collection, rkey] = blockUri.replace("at://", "").split("/");
      await agent.com.atproto.repo.deleteRecord({
        repo,
        collection,
        rkey,
      });
    } catch (error) {
      debug.error("Failed to unblock user:", error);
      throw error;
    }
  }

  async mute(did: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      await agent.mute(did);
    } catch (error) {
      debug.error("Failed to mute user:", error);
      throw error;
    }
  }

  async unmute(did: string) {
    try {
      const agent = "agent" in this.client ? this.client.agent : this.client;
      await agent.unmute(did);
    } catch (error) {
      debug.error("Failed to unmute user:", error);
      throw error;
    }
  }
}

// Service factory functions
export function getInteractionsService(client: ATProtoClient | BskyAgent) {
  return new InteractionsService(client);
}

export function getThreadService(client: ATProtoClient | BskyAgent) {
  return new ThreadService(client);
}

export function getProfileService(client: ATProtoClient | BskyAgent) {
  return new ProfileService(client);
}
