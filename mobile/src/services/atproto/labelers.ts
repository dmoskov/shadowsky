/**
 * Third-Party Labeler Service (Mobile)
 *
 * The AT Protocol logic now lives in the shared @bsky/core package. These thin
 * wrappers add mobile's singleton agent + per-endpoint rateLimited throttling
 * and preserve the existing signatures/return shapes.
 */

import { labelers as core } from "@bsky/core";
import { getAtProtoClient } from "./client";
import { rateLimited, ATProtoEndpointType } from "../rate-limiter";

export type LabelerInfo = core.LabelerInfo;
export type LabelerSubscription = core.LabelerSubscription;
export type LabelerLabelPreference = core.LabelerLabelPreference;
export type LabelerDirectoryEntry = core.LabelerDirectoryEntry;
export type LabelerCategory = core.LabelerCategory;

export const LABELER_CATEGORIES = core.LABELER_CATEGORIES;
export const CURATED_LABELERS = core.CURATED_LABELERS;

const agent = () => getAtProtoClient().getAgent();

export async function getSubscribedLabelers(): Promise<LabelerSubscription[]> {
  return rateLimited(
    () => core.getSubscribedLabelers(agent()),
    ATProtoEndpointType.RECORD,
  );
}

export async function getLabelerInfo(
  labelerDid: string,
): Promise<LabelerInfo | null> {
  return rateLimited(
    () => core.getLabelerInfo(agent(), labelerDid),
    ATProtoEndpointType.FEED,
  );
}

export async function getLabelerInfoBatch(
  dids: string[],
): Promise<LabelerInfo[]> {
  return rateLimited(
    () => core.getLabelerInfoBatch(agent(), dids),
    ATProtoEndpointType.FEED,
  );
}

export async function getDirectoryLabelers(
  category?: LabelerCategory,
): Promise<LabelerInfo[]> {
  return rateLimited(
    () => core.getDirectoryLabelers(agent(), category),
    ATProtoEndpointType.FEED,
  );
}

export async function searchLabelers(query: string): Promise<LabelerInfo[]> {
  return rateLimited(
    () => core.searchLabelers(agent(), query),
    ATProtoEndpointType.FEED,
  );
}

export async function subscribeToLabeler(labelerDid: string): Promise<void> {
  return rateLimited(
    () => core.subscribeToLabeler(agent(), labelerDid),
    ATProtoEndpointType.RECORD,
  );
}

export async function unsubscribeFromLabeler(
  labelerDid: string,
): Promise<void> {
  return rateLimited(
    () => core.unsubscribeFromLabeler(agent(), labelerDid),
    ATProtoEndpointType.RECORD,
  );
}

export async function getLabelerLabelPreferences(
  labelerDid: string,
): Promise<LabelerLabelPreference[]> {
  return rateLimited(
    () => core.getLabelerLabelPreferences(agent(), labelerDid),
    ATProtoEndpointType.RECORD,
  );
}

export async function setLabelerLabelPreference(
  labelerDid: string,
  label: string,
  visibility: "show" | "warn" | "hide",
): Promise<void> {
  return rateLimited(
    () => core.setLabelerLabelPreference(agent(), labelerDid, label, visibility),
    ATProtoEndpointType.RECORD,
  );
}

export async function appealLabel(params: {
  subjectUri: string;
  subjectCid?: string;
  labelerDid: string;
  labelVal: string;
  reason: string;
}): Promise<void> {
  return rateLimited(
    () => core.appealLabel(agent(), params),
    ATProtoEndpointType.RECORD,
  );
}

export async function getModerationLists() {
  return rateLimited(
    () => core.getModerationLists(agent()),
    ATProtoEndpointType.FEED,
  );
}

export async function likeLabeler(
  labelerUri: string,
  labelerCid: string,
): Promise<string> {
  return rateLimited(
    () => core.likeLabeler(agent(), labelerUri, labelerCid),
    ATProtoEndpointType.RECORD,
  );
}

export async function unlikeLabeler(likeUri: string): Promise<void> {
  return rateLimited(
    () => core.unlikeLabeler(agent(), likeUri),
    ATProtoEndpointType.RECORD,
  );
}
