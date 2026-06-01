/**
 * Profile / graph operations.
 *
 * The AT Protocol calls now live in the shared @bsky/core package
 * (`profiles.*`). These thin wrappers add mobile's concerns — the singleton
 * agent and per-endpoint `rateLimited` throttling — and preserve the exact
 * signatures/return shapes existing call sites expect.
 */

import {profiles} from '@bsky/core';
import {AppBskyActorDefs} from '@atproto/api';
import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

const agent = () => getAtProtoClient().getAgent();

export async function getProfile(
  actor: string,
): Promise<AppBskyActorDefs.ProfileViewDetailed> {
  return rateLimited(
    () => profiles.getProfile(agent(), actor),
    ATProtoEndpointType.FEED,
  );
}

export async function getProfiles(
  actors: string[],
): Promise<AppBskyActorDefs.ProfileViewDetailed[]> {
  return rateLimited(async () => {
    const data = await profiles.getProfiles(agent(), actors);
    return data.profiles;
  }, ATProtoEndpointType.FEED);
}

export async function searchActors(query: string, limit: number = 25) {
  return rateLimited(
    () => profiles.searchActors(agent(), query, limit),
    ATProtoEndpointType.FEED,
  );
}

export async function followUser(did: string) {
  return rateLimited(
    () => profiles.followUser(agent(), did),
    ATProtoEndpointType.RECORD,
  );
}

export async function unfollowUser(followUri: string) {
  return rateLimited(
    () => profiles.unfollowUser(agent(), followUri),
    ATProtoEndpointType.RECORD,
  );
}

export async function getFollowers(actor: string, cursor?: string) {
  return rateLimited(
    () => profiles.getFollowers(agent(), actor, cursor),
    ATProtoEndpointType.FEED,
  );
}

export async function getFollows(actor: string, cursor?: string) {
  return rateLimited(
    () => profiles.getFollows(agent(), actor, cursor),
    ATProtoEndpointType.FEED,
  );
}

export async function muteUser(did: string) {
  return rateLimited(
    () => profiles.muteUser(agent(), did),
    ATProtoEndpointType.RECORD,
  );
}

export async function unmuteUser(did: string) {
  return rateLimited(
    () => profiles.unmuteUser(agent(), did),
    ATProtoEndpointType.RECORD,
  );
}

export async function blockUser(did: string) {
  return rateLimited(
    () => profiles.blockUser(agent(), did),
    ATProtoEndpointType.RECORD,
  );
}

export async function unblockUser(blockUri: string) {
  return rateLimited(
    () => profiles.unblockUser(agent(), blockUri),
    ATProtoEndpointType.RECORD,
  );
}

export async function getMutes(cursor?: string) {
  return rateLimited(
    () => profiles.getMutes(agent(), cursor),
    ATProtoEndpointType.FEED,
  );
}

export async function getBlocks(cursor?: string) {
  return rateLimited(
    () => profiles.getBlocks(agent(), cursor),
    ATProtoEndpointType.FEED,
  );
}

export interface UpdateProfileParams {
  displayName?: string;
  description?: string;
  avatar?: string; // URI to local image file
}

/**
 * Update user profile. Kept local: it uploads an avatar blob and uses
 * `upsertProfile`, which is mobile-specific and not part of @bsky/core.
 */
export async function updateProfile(params: UpdateProfileParams) {
  return rateLimited(async () => {
    const a = agent();

    // Upload avatar if provided
    let avatarBlob: any;
    if (params.avatar) {
      const response = await fetch(params.avatar);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const uploadResponse = await a.uploadBlob(uint8Array, {
        encoding: blob.type,
      });
      avatarBlob = uploadResponse.data.blob;
    }

    // Use upsertProfile to update the profile
    const result = await a.upsertProfile((existing) => {
      const updated: Record<string, any> = {
        ...existing,
      };

      if (params.displayName !== undefined) {
        updated.displayName = params.displayName;
      }
      if (params.description !== undefined) {
        updated.description = params.description;
      }
      if (avatarBlob) {
        updated.avatar = avatarBlob;
      }

      return updated;
    });

    return result;
  }, ATProtoEndpointType.RECORD);
}
