import {getAtProtoClient} from './client';
import {AppBskyActorDefs} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';

/**
 * Get a user profile
 */
export async function getProfile(actor: string): Promise<AppBskyActorDefs.ProfileViewDetailed> {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getProfile({actor});
    return response.data;
  });
}

/**
 * Get multiple profiles
 */
export async function getProfiles(actors: string[]): Promise<AppBskyActorDefs.ProfileViewDetailed[]> {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getProfiles({actors});
    return response.data.profiles;
  });
}

/**
 * Search for actors/profiles
 */
export async function searchActors(query: string, limit: number = 25) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.searchActors({
      q: query,
      limit,
    });

    return response.data.actors;
  });
}

/**
 * Follow a user
 */
export async function followUser(did: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.follow(did);
    return response;
  });
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followUri: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    await agent.deleteFollow(followUri);
  });
}

/**
 * Get user's followers
 */
export async function getFollowers(actor: string, cursor?: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getFollowers({
      actor,
      limit: 50,
      cursor,
    });

    return {
      followers: response.data.followers,
      cursor: response.data.cursor,
    };
  });
}

/**
 * Get users that a user follows
 */
export async function getFollows(actor: string, cursor?: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getFollows({
      actor,
      limit: 50,
      cursor,
    });

    return {
      follows: response.data.follows,
      cursor: response.data.cursor,
    };
  });
}

/**
 * Mute a user
 */
export async function muteUser(did: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    await agent.mute(did);
  });
}

/**
 * Unmute a user
 */
export async function unmuteUser(did: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    await agent.unmute(did);
  });
}

/**
 * Block a user
 */
export async function blockUser(did: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.graph.block.create(
      {repo: agent.session?.did || ''},
      {
        subject: did,
        createdAt: new Date().toISOString(),
      }
    );

    return response;
  });
}

/**
 * Unblock a user
 */
export async function unblockUser(blockUri: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const session = agent.session;
    if (!session) {
      throw new Error('No active session');
    }

    await agent.app.bsky.graph.block.delete({
      repo: session.did,
      rkey: blockUri.split('/').pop() || '',
    });
  });
}

/**
 * Get muted users
 */
export async function getMutes(cursor?: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.graph.getMutes({
      limit: 50,
      cursor,
    });

    return {
      mutes: response.data.mutes,
      cursor: response.data.cursor,
    };
  });
}

/**
 * Get blocked users
 */
export async function getBlocks(cursor?: string) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.graph.getBlocks({
      limit: 50,
      cursor,
    });

    return {
      blocks: response.data.blocks,
      cursor: response.data.cursor,
    };
  });
}
