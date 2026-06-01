import {starterPacks as coreStarterPacks} from '@bsky/core';
import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

const agent = () => getAtProtoClient().getAgent();

/**
 * The AT Protocol calls live in @bsky/core; these thin wrappers add mobile's
 * singleton agent + per-endpoint rateLimited throttling.
 */

export async function getStarterPack(starterPackUri: string) {
  return rateLimited(
    () => coreStarterPacks.getStarterPack(agent(), starterPackUri),
    ATProtoEndpointType.FEED,
  );
}

export async function getActorStarterPacks(actor: string, cursor?: string) {
  return rateLimited(
    () => coreStarterPacks.getActorStarterPacks(agent(), actor, cursor),
    ATProtoEndpointType.FEED,
  );
}
