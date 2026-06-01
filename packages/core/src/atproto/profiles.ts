/**
 * Profile / graph operations against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains NO rate limiting (callers inject that — mobile wraps these in its
 * token-bucket `rateLimited`, web calls them directly). Error logging goes
 * through the injectable @bsky/core `logger`.
 */

import type { AppBskyActorDefs, BskyAgent } from "@atproto/api";
import { logger } from "../logger";

export async function getProfile(
  agent: BskyAgent,
  actor: string,
): Promise<AppBskyActorDefs.ProfileViewDetailed> {
  try {
    const response = await agent.getProfile({ actor });
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch profile:", error);
    throw error;
  }
}

export async function getProfiles(agent: BskyAgent, actors: string[]) {
  try {
    const response = await agent.getProfiles({ actors });
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch profiles:", error);
    throw error;
  }
}

export async function searchActors(
  agent: BskyAgent,
  query: string,
  limit = 25,
) {
  try {
    const response = await agent.searchActors({ q: query, limit });
    return response.data.actors;
  } catch (error) {
    logger.error("Failed to search actors:", error);
    throw error;
  }
}

export async function getAuthorFeed(
  agent: BskyAgent,
  actor: string,
  limit?: number,
  cursor?: string,
  filter?: string,
) {
  try {
    const response = await agent.getAuthorFeed({
      actor,
      limit: limit || 30,
      cursor,
      filter,
    });
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch author feed:", error);
    throw error;
  }
}

export async function followUser(agent: BskyAgent, did: string) {
  try {
    return await agent.follow(did);
  } catch (error) {
    logger.error("Failed to follow user:", error);
    throw error;
  }
}

export async function unfollowUser(agent: BskyAgent, followUri: string) {
  try {
    await agent.deleteFollow(followUri);
  } catch (error) {
    logger.error("Failed to unfollow user:", error);
    throw error;
  }
}

export async function getFollowers(
  agent: BskyAgent,
  actor: string,
  cursor?: string,
) {
  try {
    const response = await agent.getFollowers({ actor, limit: 50, cursor });
    return {
      followers: response.data.followers,
      cursor: response.data.cursor,
    };
  } catch (error) {
    logger.error("Failed to fetch followers:", error);
    throw error;
  }
}

export async function getFollows(
  agent: BskyAgent,
  actor: string,
  cursor?: string,
) {
  try {
    const response = await agent.getFollows({ actor, limit: 50, cursor });
    return {
      follows: response.data.follows,
      cursor: response.data.cursor,
    };
  } catch (error) {
    logger.error("Failed to fetch follows:", error);
    throw error;
  }
}

export async function muteUser(agent: BskyAgent, did: string) {
  try {
    await agent.mute(did);
  } catch (error) {
    logger.error("Failed to mute user:", error);
    throw error;
  }
}

export async function unmuteUser(agent: BskyAgent, did: string) {
  try {
    await agent.unmute(did);
  } catch (error) {
    logger.error("Failed to unmute user:", error);
    throw error;
  }
}

export async function blockUser(agent: BskyAgent, did: string) {
  try {
    return await agent.app.bsky.graph.block.create(
      { repo: agent.session?.did || "" },
      { subject: did, createdAt: new Date().toISOString() },
    );
  } catch (error) {
    logger.error("Failed to block user:", error);
    throw error;
  }
}

export async function unblockUser(agent: BskyAgent, blockUri: string) {
  try {
    const session = agent.session;
    if (!session) {
      throw new Error("No active session");
    }
    await agent.app.bsky.graph.block.delete({
      repo: session.did,
      rkey: blockUri.split("/").pop() || "",
    });
  } catch (error) {
    logger.error("Failed to unblock user:", error);
    throw error;
  }
}

export async function getMutes(agent: BskyAgent, cursor?: string) {
  try {
    const response = await agent.app.bsky.graph.getMutes({ limit: 50, cursor });
    return { mutes: response.data.mutes, cursor: response.data.cursor };
  } catch (error) {
    logger.error("Failed to fetch mutes:", error);
    throw error;
  }
}

export async function getBlocks(agent: BskyAgent, cursor?: string) {
  try {
    const response = await agent.app.bsky.graph.getBlocks({
      limit: 50,
      cursor,
    });
    return { blocks: response.data.blocks, cursor: response.data.cursor };
  } catch (error) {
    logger.error("Failed to fetch blocks:", error);
    throw error;
  }
}
