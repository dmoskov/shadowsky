/**
 * Third-Party Labeler Service
 *
 * AT Protocol supports third-party labelers — moderation services that label
 * content. Users can subscribe to labelers and have their labels applied.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that). Error logging goes
 * through the injectable @bsky/core `logger`.
 */

import type {
  AppBskyActorDefs,
  AppBskyLabelerDefs,
  BskyAgent,
} from "@atproto/api";
import { logger } from "../logger";

/** Labeler information. */
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
  // Label-value definitions from a detailed view (used by moderation UIs).
  policies?: AppBskyLabelerDefs.LabelerViewDetailed["policies"];
  category?: string;
}

/** Labeler subscription preference. */
export interface LabelerSubscription {
  did: string;
  displayName?: string;
  handle?: string;
}

/** Per-labeler label preferences. */
export interface LabelerLabelPreference {
  labelerDid: string;
  label: string;
  visibility: "show" | "warn" | "hide";
}

/** Get the user's subscribed labelers from AT Protocol preferences. */
export async function getSubscribedLabelers(
  agent: BskyAgent,
): Promise<LabelerSubscription[]> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
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
 * Curated directory of well-known labelers organized by category. AT Protocol
 * has no labeler discovery API, so we maintain a directory of known labelers
 * and fetch their live info via getServices.
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

function mapLabelerView(
  view: AppBskyLabelerDefs.LabelerView | AppBskyLabelerDefs.LabelerViewDetailed,
  category?: string,
): LabelerInfo {
  return {
    did: view.creator.did,
    uri: view.uri,
    cid: view.cid,
    creator: {
      did: view.creator.did,
      handle: view.creator.handle,
      displayName: view.creator.displayName,
      avatar: view.creator.avatar,
      description: view.creator.description,
    },
    likeCount: view.likeCount,
    viewer: view.viewer,
    indexedAt: view.indexedAt,
    labels: view.labels,
    policies: "policies" in view ? view.policies : undefined,
    category,
  };
}

/**
 * Get curated directory labelers with live info from the network.
 * Optionally filter by category.
 */
export async function getPopularLabelers(
  agent: BskyAgent,
  category?: LabelerCategory,
): Promise<LabelerInfo[]> {
  try {
    const entries =
      category && category !== "All"
        ? CURATED_LABELERS.filter((e) => e.category === category)
        : CURATED_LABELERS;

    if (entries.length === 0) return [];

    const dids = entries.map((e) => e.did);
    const response = await agent.app.bsky.labeler.getServices({
      dids,
      detailed: true,
    });

    if (!response.data.views) return [];

    return response.data.views.map((view) => {
      const v = view as
        | AppBskyLabelerDefs.LabelerView
        | AppBskyLabelerDefs.LabelerViewDetailed;
      const entry = entries.find((e) => e.did === v.creator.did);
      return mapLabelerView(v, entry?.category);
    });
  } catch (error) {
    logger.error("Failed to get popular labelers:", error);
    return [];
  }
}

/**
 * Search for labelers by handle or name. Uses searchActors to find accounts,
 * then validates them as labelers via getServices.
 */
export async function searchLabelers(
  agent: BskyAgent,
  query: string,
): Promise<LabelerInfo[]> {
  try {
    if (!query.trim()) return [];

    const searchResponse = await agent.app.bsky.actor.searchActors({
      q: query,
      limit: 25,
    });

    if (
      !searchResponse.data.actors ||
      searchResponse.data.actors.length === 0
    ) {
      return [];
    }

    const dids = searchResponse.data.actors.map((a) => a.did);
    const labelerResponse = await agent.app.bsky.labeler.getServices({
      dids,
      detailed: true,
    });

    if (!labelerResponse.data.views) return [];

    return labelerResponse.data.views.map((view) =>
      mapLabelerView(
        view as
          | AppBskyLabelerDefs.LabelerView
          | AppBskyLabelerDefs.LabelerViewDetailed,
      ),
    );
  } catch (error) {
    logger.error("Failed to search labelers:", error);
    return [];
  }
}

/** Subscribe to a labeler (adds it to the user's labelersPref). */
export async function subscribeToLabeler(
  agent: BskyAgent,
  labelerDid: string,
): Promise<void> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
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
        logger.log("Already subscribed to labeler:", labelerDid);
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

    await agent.app.bsky.actor.putPreferences({ preferences: updatedPrefs });
    logger.log("Successfully subscribed to labeler:", labelerDid);
  } catch (error) {
    logger.error("Failed to subscribe to labeler:", error);
    throw error;
  }
}

/** Unsubscribe from a labeler (removes it from the user's labelersPref). */
export async function unsubscribeFromLabeler(
  agent: BskyAgent,
  labelerDid: string,
): Promise<void> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    const labelersPrefIndex = preferences.findIndex(
      (p: unknown) =>
        (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
    );

    if (labelersPrefIndex < 0) {
      logger.log("No labelers subscribed");
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

    await agent.app.bsky.actor.putPreferences({ preferences: updatedPrefs });
    logger.log("Successfully unsubscribed from labeler:", labelerDid);
  } catch (error) {
    logger.error("Failed to unsubscribe from labeler:", error);
    throw error;
  }
}

/** Get labeler information by DID. */
export async function getLabelerInfo(
  agent: BskyAgent,
  labelerDid: string,
): Promise<LabelerInfo | null> {
  try {
    const response = await agent.app.bsky.labeler.getServices({
      dids: [labelerDid],
      detailed: true,
    });

    if (!response.data.views || response.data.views.length === 0) {
      return null;
    }

    const view = response.data.views[0] as
      | AppBskyLabelerDefs.LabelerView
      | AppBskyLabelerDefs.LabelerViewDetailed;
    return { ...mapLabelerView(view), did: labelerDid };
  } catch (error) {
    logger.error("Failed to get labeler info:", error);
    return null;
  }
}

/** Get per-labeler label preferences. */
export async function getLabelerLabelPreferences(
  agent: BskyAgent,
  labelerDid: string,
): Promise<LabelerLabelPreference[]> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
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

/** Set the preference for a specific label from a labeler. */
export async function setLabelerLabelPreference(
  agent: BskyAgent,
  labelerDid: string,
  label: string,
  visibility: "show" | "warn" | "hide",
): Promise<void> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
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

    await agent.app.bsky.actor.putPreferences({
      preferences: updatedPrefs as unknown as AppBskyActorDefs.Preferences,
    });

    logger.log(
      `Set labeler label preference: ${labelerDid}/${label} = ${visibility}`,
    );
  } catch (error) {
    logger.error("Failed to set labeler label preference:", error);
    throw error;
  }
}

/** Like a labeler service. Returns the URI of the created like record. */
export async function likeLabeler(
  agent: BskyAgent,
  labelerUri: string,
  labelerCid: string,
): Promise<string> {
  const response = await agent.like(labelerUri, labelerCid);
  return response.uri;
}

/** Unlike a labeler service. */
export async function unlikeLabeler(
  agent: BskyAgent,
  likeUri: string,
): Promise<void> {
  await agent.deleteLike(likeUri);
}

/** Get info for multiple labelers at once. */
export async function getLabelerInfoBatch(
  agent: BskyAgent,
  dids: string[],
): Promise<LabelerInfo[]> {
  if (dids.length === 0) return [];
  try {
    const response = await agent.app.bsky.labeler.getServices({
      dids,
      detailed: true,
    });
    if (!response.data.views) return [];
    return response.data.views.map((view) =>
      mapLabelerView(
        view as
          | AppBskyLabelerDefs.LabelerView
          | AppBskyLabelerDefs.LabelerViewDetailed,
      ),
    );
  } catch (error) {
    logger.error("Failed to get labeler info batch:", error);
    return [];
  }
}

/**
 * Get curated directory labelers with live info (via batch), optionally
 * filtered by category. Mirrors getPopularLabelers using the batch fetch.
 */
export async function getDirectoryLabelers(
  agent: BskyAgent,
  category?: LabelerCategory,
): Promise<LabelerInfo[]> {
  try {
    const entries =
      category && category !== "All"
        ? CURATED_LABELERS.filter((e) => e.category === category)
        : CURATED_LABELERS;

    if (entries.length === 0) return [];

    const dids = entries.map((e) => e.did);
    const infos = await getLabelerInfoBatch(agent, dids);

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
 * Appeal a label applied to the user's own content. Uses
 * com.atproto.moderation.createReport with reasonType=reasonAppeal.
 */
export async function appealLabel(
  agent: BskyAgent,
  params: {
    subjectUri: string;
    subjectCid?: string;
    labelerDid: string;
    labelVal: string;
    reason: string;
  },
): Promise<void> {
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

  await agent.com.atproto.moderation.createReport({
    reasonType: "com.atproto.moderation.defs#reasonAppeal",
    subject: subject as any,
    reason: `Appeal label "${params.labelVal}" from ${params.labelerDid}: ${params.reason}`,
  });
}

/**
 * Get the current user's moderation lists (purpose modlist), which can act as
 * label sources.
 */
export async function getModerationLists(agent: BskyAgent): Promise<
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
    const did = agent.session?.did;
    if (!did) return [];

    const response = await agent.app.bsky.graph.getLists({
      actor: did,
      limit: 50,
    });

    if (!response.data.lists) return [];

    return response.data.lists
      .filter((list) => list.purpose === "app.bsky.graph.defs#modlist")
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
