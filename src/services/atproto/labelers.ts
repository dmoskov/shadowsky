/**
 * Third-Party Labeler Service
 *
 * AT Protocol supports third-party labelers - moderation services that label content.
 * Users can subscribe to labelers and have their labels applied to content.
 */

import type {
  AppBskyActorDefs,
  AppBskyLabelerDefs,
  BskyAgent,
} from "@atproto/api";
import { createLogger } from "../../utils/logger";

const logger = createLogger("LabelersService");

/**
 * Labeler information
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
  category?: string;
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
export async function getSubscribedLabelers(
  agent: BskyAgent,
): Promise<LabelerSubscription[]> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find labelersPref in preferences
    const labelersPref = preferences.find(
      (p: unknown) =>
        (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
    ) as AppBskyActorDefs.LabelersPref | undefined;

    if (!labelersPref?.labelers) {
      return [];
    }

    // Map to our interface
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
 * Curated directory of well-known labelers organized by category.
 * Since AT Protocol has no labeler discovery API, we maintain a directory
 * of known labelers and fetch their live info via getServices.
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
  "Fun",
] as const;

export type LabelerCategory = (typeof LABELER_CATEGORIES)[number];

export const CURATED_LABELERS: LabelerDirectoryEntry[] = [
  // Moderation
  {
    did: "did:plc:ar7c4by46qjdydhdevvrndac",
    category: "Moderation",
  },
  {
    did: "did:plc:e4elbtctnfqocyfcml6h2lf7",
    category: "Moderation",
  },
  {
    did: "did:plc:d2mkddsbmnrgr3domzg5qexf",
    category: "Safety",
  },
  // Safety
  {
    did: "did:plc:4ugewi6aca52a62u62jccbl7",
    category: "Safety",
  },
  {
    did: "did:plc:gqaoe3na6isc3zyvp7iuqpu7",
    category: "Safety",
  },
  // Identity
  {
    did: "did:plc:l3nbhdfelt5d26btksecetxu",
    category: "Identity",
  },
  // Community
  {
    did: "did:plc:l624mewisyr6hymexmrjkprc",
    category: "Community",
  },
  {
    did: "did:plc:2qawvcwumvgxmed6iy6pmt6l",
    category: "Community",
  },
  // Fun
  {
    did: "did:plc:hysbs7znfgxyb4tsvetzo4sk",
    category: "Fun",
  },
];

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
      if (
        "$type" in view &&
        view.$type === "app.bsky.labeler.defs#labelerViewDetailed"
      ) {
        const detailedView = view as AppBskyLabelerDefs.LabelerViewDetailed;
        const entry = entries.find((e) => e.did === detailedView.creator.did);
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
          category: entry?.category,
        };
      }
      const basicView = view as AppBskyLabelerDefs.LabelerView;
      const entry = entries.find((e) => e.did === basicView.creator.did);
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
        category: entry?.category,
      };
    });
  } catch (error) {
    logger.error("Failed to get popular labelers:", error);
    return [];
  }
}

/**
 * Search for labelers by handle or name.
 * Uses searchActors to find accounts, then validates them as labelers via getServices.
 */
export async function searchLabelers(
  agent: BskyAgent,
  query: string,
): Promise<LabelerInfo[]> {
  try {
    if (!query.trim()) return [];

    // Search for actors matching the query
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

    // Try to validate these actors as labelers via getServices
    const dids = searchResponse.data.actors.map((a) => a.did);
    const labelerResponse = await agent.app.bsky.labeler.getServices({
      dids,
      detailed: true,
    });

    if (!labelerResponse.data.views) return [];

    // Only return actors that are actually labelers (getServices returns views for them)
    return labelerResponse.data.views
      .map((view) => {
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
      })
      .filter(Boolean) as LabelerInfo[];
  } catch (error) {
    logger.error("Failed to search labelers:", error);
    return [];
  }
}

/**
 * Subscribe to a labeler
 */
export async function subscribeToLabeler(
  agent: BskyAgent,
  labelerDid: string,
): Promise<void> {
  try {
    // Get current preferences
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find existing labelersPref
    const labelersPrefIndex = preferences.findIndex(
      (p: unknown) =>
        (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
    );

    let updatedPrefs: AppBskyActorDefs.Preferences;
    if (labelersPrefIndex >= 0) {
      // Update existing labelersPref
      const labelersPref = preferences[
        labelersPrefIndex
      ] as AppBskyActorDefs.LabelersPref;
      const existingLabelers = labelersPref.labelers || [];

      // Check if already subscribed
      if (
        existingLabelers.some(
          (l: AppBskyActorDefs.LabelerPrefItem) => l.did === labelerDid,
        )
      ) {
        logger.log("Already subscribed to labeler:", labelerDid);
        return;
      }

      // Add new labeler
      updatedPrefs = [...preferences];
      updatedPrefs[labelersPrefIndex] = {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [
          ...existingLabelers,
          { $type: "app.bsky.actor.defs#labelerPrefItem", did: labelerDid },
        ],
      };
    } else {
      // Create new labelersPref
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

    // Save updated preferences
    await agent.app.bsky.actor.putPreferences({
      preferences: updatedPrefs,
    });

    logger.log("Successfully subscribed to labeler:", labelerDid);
  } catch (error) {
    logger.error("Failed to subscribe to labeler:", error);
    throw error;
  }
}

/**
 * Unsubscribe from a labeler
 */
export async function unsubscribeFromLabeler(
  agent: BskyAgent,
  labelerDid: string,
): Promise<void> {
  try {
    // Get current preferences
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find existing labelersPref
    const labelersPrefIndex = preferences.findIndex(
      (p: unknown) =>
        (p as { $type?: string }).$type === "app.bsky.actor.defs#labelersPref",
    );

    if (labelersPrefIndex < 0) {
      logger.log("No labelers subscribed");
      return;
    }

    // Update labelersPref by removing the labeler
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

    // Save updated preferences
    await agent.app.bsky.actor.putPreferences({
      preferences: updatedPrefs,
    });

    logger.log("Successfully unsubscribed from labeler:", labelerDid);
  } catch (error) {
    logger.error("Failed to unsubscribe from labeler:", error);
    throw error;
  }
}

/**
 * Get labeler information by DID
 */
export async function getLabelerInfo(
  agent: BskyAgent,
  labelerDid: string,
): Promise<LabelerInfo | null> {
  try {
    // Get labeler service details
    const response = await agent.app.bsky.labeler.getServices({
      dids: [labelerDid],
      detailed: true,
    });

    if (!response.data.views || response.data.views.length === 0) {
      return null;
    }

    const view = response.data.views[0];

    // Check if view is LabelerViewDetailed (has creator property)
    if (
      "$type" in view &&
      view.$type === "app.bsky.labeler.defs#labelerViewDetailed"
    ) {
      const detailedView = view as AppBskyLabelerDefs.LabelerViewDetailed;
      // Map to our interface
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
      };
    }

    // Fallback for basic LabelerView
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
 * Get per-labeler label preferences
 */
export async function getLabelerLabelPreferences(
  agent: BskyAgent,
  labelerDid: string,
): Promise<LabelerLabelPreference[]> {
  try {
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find all contentLabelPref entries for this labeler
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
  agent: BskyAgent,
  labelerDid: string,
  label: string,
  visibility: "show" | "warn" | "hide",
): Promise<void> {
  try {
    // Get current preferences
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find existing preference for this labeler + label
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

    // Build the new preference object
    const newPref = {
      $type: "app.bsky.actor.defs#contentLabelPref",
      labelerDid: labelerDid,
      label: label,
      visibility: visibility,
    };

    // Build updated preferences array
    const updatedPrefs =
      prefIndex >= 0
        ? [
            ...preferences.slice(0, prefIndex),
            newPref,
            ...preferences.slice(prefIndex + 1),
          ]
        : [...preferences, newPref];

    // Save updated preferences
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
