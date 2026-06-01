import {notifications as coreNotifications} from '@bsky/core';
import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export type NotificationsOptions = coreNotifications.NotificationsOptions;

const agent = () => getAtProtoClient().getAgent();

/**
 * The AT Protocol calls live in @bsky/core; these thin wrappers add mobile's
 * singleton agent + per-endpoint rateLimited throttling.
 */

export async function getNotifications(
  options: coreNotifications.NotificationsOptions = {},
) {
  return rateLimited(
    () => coreNotifications.getNotifications(agent(), options),
    ATProtoEndpointType.NOTIFICATION,
  );
}

export async function getUnreadCount() {
  return rateLimited(
    () => coreNotifications.getUnreadCount(agent()),
    ATProtoEndpointType.NOTIFICATION,
  );
}

export async function updateSeenNotifications(seenAt?: string) {
  return rateLimited(
    () => coreNotifications.updateSeenNotifications(agent(), seenAt),
    ATProtoEndpointType.NOTIFICATION,
  );
}
