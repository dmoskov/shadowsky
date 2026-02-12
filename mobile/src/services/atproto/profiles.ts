import {getAtProtoClient} from './client';
import {AppBskyActorDefs} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

/**
 * Get a user profile
 */
export async function getProfile(actor: string): Promise<AppBskyActorDefs.ProfileViewDetailed> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getProfile({actor});
        return response.data;
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get multiple profiles
 */
export async function getProfiles(actors: string[]): Promise<AppBskyActorDefs.ProfileViewDetailed[]> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getProfiles({actors});
        return response.data.profiles;
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Search for actors/profiles
 */
export async function searchActors(query: string, limit: number = 25) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.searchActors({
          q: query,
          limit,
        });

        return response.data.actors;
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Follow a user
 */
export async function followUser(did: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.follow(did);
        return response;
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followUri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.deleteFollow(followUri);
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Get user's followers
 */
export async function getFollowers(actor: string, cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get users that a user follows
 */
export async function getFollows(actor: string, cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Mute a user
 */
export async function muteUser(did: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.mute(did);
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Unmute a user
 */
export async function unmuteUser(did: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.unmute(did);
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Block a user
 */
export async function blockUser(did: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Unblock a user
 */
export async function unblockUser(blockUri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Get muted users
 */
export async function getMutes(cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get blocked users
 */
export async function getBlocks(cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}
