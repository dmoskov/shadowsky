/**
 * Third-Party Labeler Service (Mobile)
 *
 * AT Protocol supports third-party labelers - moderation services that label content.
 * Users can subscribe to labelers and have their labels applied to content.
 */

import type {
  AppBskyActorDefs,
  AppBskyLabelerDefs,
} from "@atproto/api";
import { getAtProtoClient } from "./client";
import { rateLimited, ATProtoEndpointType } from "../rate-limiter";
import { createLogger } from "../../utils/logger";

const logger = createLogger("LabelersService");

/**
 * Labeler information returned from getServices
 */
export interface LabelerInfo {
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    description?: string;
  };
  likeCount?: number;
  viewer?: {
    like?: string;
  };
  indexedAt: string;
  labels?: Array<{
    ver?: number;
    src: string;
    uri: string;
    cid?: string;
    val: string;
    neg?: boolean;
    cts: string;
    exp?: string;
    sig?: Uint8Array;
  }>;
  policies?: {
    labelValues?: string[];
    labelValueDefinitions?: Array<{
      identifier: string;
      severity: string;
      blurs: string;
      defaultSetting?: string;
      adultOnly?: boolean;
      locales: Array<{
        lang: string;
        name: string;
        description: string;
      }>;
    }>;
  };
}

/**
 * Labeler subscription preference
 */
export interface LabelerSubscription {
  did: string;
  displayName?: string;
  handle?: string;
}

/**
 * Per-labeler label preferences
 */
export interface LabelerLabelPreference {
  labelerDid: string;
  label: string;
  visibility: "show" | "warn" | "hide";
}

/**
 * Get user's subscribed labelers from AT Protocol preferences
 */
export async function getSubscribedLabelers(): Promise<LabelerSubscription[]> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await rateLimited(
      () => agent.app.bsky.actor.getPreferences(),
      ATProtoEndpointType.RECORD,
    );
    const preferences = response.data.preferences;

    const labelersPref = preferences.find(
      (p: unknown) =>
        (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
    ) as AppBskyActorDefs.LabelersPref | undefined;

    if (!labelersPref?.labelers) {
      return [];
    }

    return labelersPref.labelers.map(
      (labeler: AppBskyActorDefs.LabelerPrefItem) => ({
        did: labeler.did,
      }),
    );
  } catch (error) {
    logger.error("Failed to get subscribed labelers:", error);
    return [];
  }
}

/**
 * Subscribe to a labeler
 */
export async function subscribeToLabeler(labelerDid: string): Promise<void> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const response = await rateLimited(
    () => agent.app.bsky.actor.getPreferences(),
    ATProtoEndpointType.RECORD,
  );
  const preferences = response.data.preferences;

  const labelersPrefIndex = preferences.findIndex(
    (p: unknown) =>
      (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
  );

  let updatedPrefs: AppBskyActorDefs.Preferences;
  if (labelersPrefIndex >= 0) {
    const labelersPref = preferences[
      labelersPrefIndex
    ] as AppBskyActorDefs.LabelersPref;
    const existingLabelers = labelersPref.labelers || [];

    if (
      existingLabelers.some(
        (l: AppBskyActorDefs.LabelerPrefItem) => l.did === labelerDid,
      )
    ) {
      return;
    }

    updatedPrefs = [...preferences];
    updatedPrefs[labelersPrefIndex] = {
      $type: "app.bsky.actor.defs#labelersPref",
      labelers: [
        ...existingLabelers,
        { $type: "app.bsky.actor.defs#labelerPrefItem", did: labelerDid },
      ],
    };
  } else {
    updatedPrefs = [
      ...preferences,
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [
          { $type: "app.bsky.actor.defs#labelerPrefItem", did: labelerDid },
        ],
      },
    ];
  }

  await rateLimited(
    () => agent.app.bsky.actor.putPreferences({ preferences: updatedPrefs }),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Unsubscribe from a labeler
 */
export async function unsubscribeFromLabeler(labelerDid: string): Promise<void> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const response = await rateLimited(
    () => agent.app.bsky.actor.getPreferences(),
    ATProtoEndpointType.RECORD,
  );
  const preferences = response.data.preferences;

  const labelersPrefIndex = preferences.findIndex(
    (p: unknown) =>
      (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
  );

  if (labelersPrefIndex < 0) {
    return;
  }

  const labelersPref = preferences[
    labelersPrefIndex
  ] as AppBskyActorDefs.LabelersPref;
  const updatedLabelers = (labelersPref.labelers || []).filter(
    (l: AppBskyActorDefs.LabelerPrefItem) => l.did !== labelerDid,
  );

  const updatedPrefs: AppBskyActorDefs.Preferences = [...preferences];
  updatedPrefs[labelersPrefIndex] = {
    $type: "app.bsky.actor.defs#labelersPref",
    labelers: updatedLabelers,
  };

  await rateLimited(
    () => agent.app.bsky.actor.putPreferences({ preferences: updatedPrefs }),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Get labeler information by DID using app.bsky.labeler.getServices
 */
export async function getLabelerInfo(
  labelerDid: string,
): Promise<LabelerInfo | null> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await rateLimited(
      () =>
        agent.app.bsky.labeler.getServices({
          dids: [labelerDid],
          detailed: true,
        }),
      ATProtoEndpointType.FEED,
    );

    if (!response.data.views || response.data.views.length === 0) {
      return null;
    }

    const view = response.data.views[0];

    if (
      "$type" in view &&
      view.$type === "app.bsky.labeler.defs#labelerViewDetailed"
    ) {
      const detailedView = view as AppBskyLabelerDefs.LabelerViewDetailed;
      return {
        did: labelerDid,
        creator: {
          did: detailedView.creator.did,
          handle: detailedView.creator.handle,
          displayName: detailedView.creator.displayName,
          avatar: detailedView.creator.avatar,
          description: detailedView.creator.description,
        },
        likeCount: detailedView.likeCount,
        viewer: detailedView.viewer,
        indexedAt: detailedView.indexedAt,
        labels: detailedView.labels,
        policies: detailedView.policies,
      };
    }

    const basicView = view as AppBskyLabelerDefs.LabelerView;
    return {
      did: labelerDid,
      creator: {
        did: basicView.creator.did,
        handle: basicView.creator.handle,
        displayName: basicView.creator.displayName,
        avatar: basicView.creator.avatar,
        description: basicView.creator.description,
      },
      likeCount: basicView.likeCount,
      viewer: basicView.viewer,
      indexedAt: basicView.indexedAt,
      labels: basicView.labels,
    };
  } catch (error) {
    logger.error("Failed to get labeler info:", error);
    return null;
  }
}

/**
 * Get info for multiple labelers at once
 */
export async function getLabelerInfoBatch(
  dids: string[],
): Promise<LabelerInfo[]> {
  if (dids.length === 0) return [];

  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await rateLimited(
      () =>
        agent.app.bsky.labeler.getServices({
          dids,
          detailed: true,
        }),
      ATProtoEndpointType.FEED,
    );

    if (!response.data.views) return [];

    return response.data.views.map((view) => {
      if (
        "$type" in view &&
        view.$type === "app.bsky.labeler.defs#labelerViewDetailed"
      ) {
        const detailedView = view as AppBskyLabelerDefs.LabelerViewDetailed;
        return {
          did: detailedView.creator.did,
          creator: {
            did: detailedView.creator.did,
            handle: detailedView.creator.handle,
            displayName: detailedView.creator.displayName,
            avatar: detailedView.creator.avatar,
            description: detailedView.creator.description,
          },
          likeCount: detailedView.likeCount,
          viewer: detailedView.viewer,
          indexedAt: detailedView.indexedAt,
          labels: detailedView.labels,
          policies: detailedView.policies,
        };
      }

      const basicView = view as AppBskyLabelerDefs.LabelerView;
      return {
        did: basicView.creator.did,
        creator: {
          did: basicView.creator.did,
          handle: basicView.creator.handle,
          displayName: basicView.creator.displayName,
          avatar: basicView.creator.avatar,
          description: basicView.creator.description,
        },
        likeCount: basicView.likeCount,
        viewer: basicView.viewer,
        indexedAt: basicView.indexedAt,
        labels: basicView.labels,
      };
    });
  } catch (error) {
    logger.error("Failed to get labeler info batch:", error);
    return [];
  }
}

/**
 * Get per-labeler label preferences
 */
export async function getLabelerLabelPreferences(
  labelerDid: string,
): Promise<LabelerLabelPreference[]> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await rateLimited(
      () => agent.app.bsky.actor.getPreferences(),
      ATProtoEndpointType.RECORD,
    );
    const preferences = response.data.preferences;

    const labelPrefs: LabelerLabelPreference[] = [];
    preferences.forEach((p: unknown) => {
      const pref = p as {
        $type?: string;
        labelerDid?: string;
        label?: string;
        visibility?: string;
      };
      if (
        pref.$type === "app.bsky.actor.defs#contentLabelPref" &&
        pref.labelerDid === labelerDid
      ) {
        labelPrefs.push({
          labelerDid: labelerDid,
          label: pref.label || "",
          visibility: (pref.visibility as "show" | "warn" | "hide") || "warn",
        });
      }
    });

    return labelPrefs;
  } catch (error) {
    logger.error("Failed to get labeler label preferences:", error);
    return [];
  }
}

/**
 * Set preference for a specific label from a labeler
 */
export async function setLabelerLabelPreference(
  labelerDid: string,
  label: string,
  visibility: "show" | "warn" | "hide",
): Promise<void> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const response = await rateLimited(
    () => agent.app.bsky.actor.getPreferences(),
    ATProtoEndpointType.RECORD,
  );
  const preferences = response.data.preferences;

  const prefIndex = preferences.findIndex((p: unknown) => {
    const pref = p as {
      $type?: string;
      labelerDid?: string;
      label?: string;
    };
    return (
      pref.$type === "app.bsky.actor.defs#contentLabelPref" &&
      pref.labelerDid === labelerDid &&
      pref.label === label
    );
  });

  const newPref = {
    $type: "app.bsky.actor.defs#contentLabelPref",
    labelerDid: labelerDid,
    label: label,
    visibility: visibility,
  };

  const updatedPrefs =
    prefIndex >= 0
      ? [
          ...preferences.slice(0, prefIndex),
          newPref,
          ...preferences.slice(prefIndex + 1),
        ]
      : [...preferences, newPref];

  await rateLimited(
    () =>
      agent.app.bsky.actor.putPreferences({
        preferences: updatedPrefs as unknown as AppBskyActorDefs.Preferences,
      }),
    ATProtoEndpointType.RECORD,
  );
}
