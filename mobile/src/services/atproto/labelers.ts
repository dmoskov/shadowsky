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
  uri?: string;
  cid?: string;
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
  category?: string;
}

/**
 * Curated directory of well-known labelers organized by category.
 */
export interface LabelerDirectoryEntry {
  did: string;
  category: string;
}

export const LABELER_CATEGORIES = [
  "All",
  "Moderation",
  "Safety",
  "Identity",
  "Community",
  "Analytics",
  "Fun",
] as const;

export type LabelerCategory = (typeof LABELER_CATEGORIES)[number];

export const CURATED_LABELERS: LabelerDirectoryEntry[] = [
  // Moderation
  { did: "did:plc:ar7c4by46qjdydhdevvrndac", category: "Moderation" }, // Bluesky Moderation Service
  { did: "did:plc:e4elbtctnfqocyfcml6h2lf7", category: "Moderation" }, // Skywatch Blue
  { did: "did:plc:yojwcfgpkxq35sv5wioglqad", category: "Moderation" }, // Perisai
  // Safety
  { did: "did:plc:4ugewi6aca52a62u62jccbl7", category: "Safety" }, // Anti-Transphobia
  { did: "did:plc:gqaoe3na6isc3zyvp7iuqpu7", category: "Safety" }, // Art Theft Labeler
  // Identity
  { did: "did:plc:l3nbhdfelt5d26btksecetxu", category: "Identity" }, // Pronoun Picker
  // Community
  { did: "did:plc:l624mewisyr6hymexmrjkprc", category: "Community" }, // Content Creator Labeler
  { did: "did:plc:2qawvcwumvgxmed6iy6pmt6l", category: "Community" }, // SonaSky
  { did: "did:plc:saslbwamakedc4h6c5bmshvz", category: "Community" }, // Hailey's Labeler (@labeler.hailey.at)
  // Analytics
  { did: "did:web:labeler.pan.shadowsky.io", category: "Analytics" }, // Pan Engagement Labeler
  // Fun
  { did: "did:plc:hysbs7znfgxyb4tsvetzo4sk", category: "Fun" }, // TTRPG Class Identifier
];

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
        uri: detailedView.uri,
        cid: detailedView.cid,
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
      uri: basicView.uri,
      cid: basicView.cid,
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
          uri: detailedView.uri,
          cid: detailedView.cid,
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
        uri: basicView.uri,
        cid: basicView.cid,
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
 * Get curated directory labelers with live info from the network.
 * Optionally filter by category.
 */
export async function getDirectoryLabelers(
  category?: LabelerCategory,
): Promise<LabelerInfo[]> {
  try {
    const entries =
      category && category !== "All"
        ? CURATED_LABELERS.filter((e) => e.category === category)
        : CURATED_LABELERS;

    if (entries.length === 0) return [];

    const dids = entries.map((e) => e.did);
    const infos = await getLabelerInfoBatch(dids);

    // Add category info
    return infos.map((info) => {
      const entry = entries.find((e) => e.did === info.did);
      return { ...info, category: entry?.category };
    });
  } catch (error) {
    logger.error("Failed to get directory labelers:", error);
    return [];
  }
}

/**
 * Search for labelers by handle or name.
 * Uses searchActors to find accounts, then validates them as labelers via getServices.
 */
export async function searchLabelers(
  query: string,
): Promise<LabelerInfo[]> {
  try {
    if (!query.trim()) return [];

    const client = getAtProtoClient();
    const agent = client.getAgent();

    const searchResponse = await rateLimited(
      () =>
        agent.app.bsky.actor.searchActors({
          q: query,
          limit: 25,
        }),
      ATProtoEndpointType.FEED,
    );

    if (
      !searchResponse.data.actors ||
      searchResponse.data.actors.length === 0
    ) {
      return [];
    }

    const dids = searchResponse.data.actors.map((a) => a.did);
    const labelerResponse = await rateLimited(
      () =>
        agent.app.bsky.labeler.getServices({
          dids,
          detailed: true,
        }),
      ATProtoEndpointType.FEED,
    );

    if (!labelerResponse.data.views) return [];

    return labelerResponse.data.views
      .map((view) => {
        if (
          "$type" in view &&
          view.$type === "app.bsky.labeler.defs#labelerViewDetailed"
        ) {
          const detailedView = view as AppBskyLabelerDefs.LabelerViewDetailed;
          return {
            did: detailedView.creator.did,
            uri: detailedView.uri,
            cid: detailedView.cid,
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
          uri: basicView.uri,
          cid: basicView.cid,
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
      })
      .filter(Boolean) as LabelerInfo[];
  } catch (error) {
    logger.error("Failed to search labelers:", error);
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

/**
 * Appeal a label applied to the user's own content.
 * Uses com.atproto.moderation.createReport with reasonType=reasonAppeal.
 */
export async function appealLabel(params: {
  subjectUri: string;
  subjectCid?: string;
  labelerDid: string;
  labelVal: string;
  reason: string;
}): Promise<void> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const subject = params.subjectCid
    ? {
        $type: "com.atproto.repo.strongRef" as const,
        uri: params.subjectUri,
        cid: params.subjectCid,
      }
    : {
        $type: "com.atproto.admin.defs#repoRef" as const,
        did: params.subjectUri,
      };

  await rateLimited(
    () =>
      agent.com.atproto.moderation.createReport({
        reasonType: "com.atproto.moderation.defs#reasonAppeal",
        subject: subject as any,
        reason: `Appeal label "${params.labelVal}" from ${params.labelerDid}: ${params.reason}`,
      }),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Get moderation lists that act as label sources (moderation lists).
 * These are lists with purpose "app.bsky.graph.defs#modlist".
 */
export async function getModerationLists(): Promise<
  Array<{
    uri: string;
    name: string;
    description?: string;
    avatar?: string;
    purpose: string;
    listItemCount?: number;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
    };
  }>
> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const did = agent.session?.did;
    if (!did) return [];

    const response = await rateLimited(
      () =>
        agent.app.bsky.graph.getLists({
          actor: did,
          limit: 50,
        }),
      ATProtoEndpointType.FEED,
    );

    if (!response.data.lists) return [];

    return response.data.lists
      .filter(
        (list) =>
          list.purpose === "app.bsky.graph.defs#modlist",
      )
      .map((list) => ({
        uri: list.uri,
        name: list.name,
        description: list.description,
        avatar: list.avatar,
        purpose: list.purpose,
        listItemCount: list.listItemCount,
        creator: {
          did: list.creator.did,
          handle: list.creator.handle,
          displayName: list.creator.displayName,
        },
      }));
  } catch (error) {
    logger.error("Failed to get moderation lists:", error);
    return [];
  }
}

/**
 * Like a labeler service
 * Returns the URI of the created like record
 */
export async function likeLabeler(
  labelerUri: string,
  labelerCid: string,
): Promise<string> {
  const client = getAtProtoClient();
  const agent = client.getAgent();
  const response = await rateLimited(
    () => agent.like(labelerUri, labelerCid),
    ATProtoEndpointType.RECORD,
  );
  return response.uri;
}

/**
 * Unlike a labeler service
 */
export async function unlikeLabeler(likeUri: string): Promise<void> {
  const client = getAtProtoClient();
  const agent = client.getAgent();
  await rateLimited(
    () => agent.deleteLike(likeUri),
    ATProtoEndpointType.RECORD,
  );
}
