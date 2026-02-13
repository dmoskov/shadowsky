import { AppBskyDraftDefs, AtpAgent } from "@atproto/api";
import { nanoid } from "nanoid";
import {
  deleteMultipleMedia,
  generateImageRefPath,
  generateVideoRefPath,
  loadMediaFromLocal,
  mediaExists,
  saveMediaToLocal,
} from "./draft-media-storage.web";

/**
 * Composer state interface that matches what we need for drafts
 */
export interface ComposerState {
  text: string;
  images?: Array<{
    uri: string;
    altText?: string;
    mimeType?: string;
  }>;
  videos?: Array<{
    uri: string;
    mimeType: string;
  }>;
  quoteUri?: string;
  quoteCid?: string;
  replyToUri?: string;
  replyToCid?: string;
  replyToRootUri?: string;
  replyToRootCid?: string;
  threadgateAllow?: any[];
  postgateEmbeddingRules?: any[];
}

/**
 * Draft with enriched local media status
 */
export interface EnrichedDraft extends AppBskyDraftDefs.DraftView {
  hasLocalMedia: boolean;
  missingMediaCount: number;
}

/**
 * Get a stable device ID for this device
 */
async function getDeviceId(): Promise<string> {
  const DEVICE_ID_KEY = "bsky_device_id";

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new device ID
    deviceId = nanoid();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Get device name for display
 */
function getDeviceName(): string {
  // Try to get a meaningful device name from user agent
  const ua = navigator.userAgent;
  let deviceName = "Web Browser";

  if (ua.includes("Chrome")) {
    deviceName = "Chrome";
  } else if (ua.includes("Firefox")) {
    deviceName = "Firefox";
  } else if (ua.includes("Safari")) {
    deviceName = "Safari";
  } else if (ua.includes("Edge")) {
    deviceName = "Edge";
  }

  // Add OS info if available
  if (ua.includes("Windows")) {
    deviceName += " on Windows";
  } else if (ua.includes("Mac OS X")) {
    deviceName += " on macOS";
  } else if (ua.includes("Linux")) {
    deviceName += " on Linux";
  }

  // Truncate to 100 chars as per API spec
  return deviceName.substring(0, 100);
}

/**
 * Convert composer state to draft format
 */
async function composerStateToDraft(
  state: ComposerState,
): Promise<AppBskyDraftDefs.Draft> {
  const deviceId = await getDeviceId();
  const deviceName = getDeviceName();

  // Build the post object
  const draftPost: AppBskyDraftDefs.DraftPost = {
    text: state.text,
  };

  // Handle images
  if (state.images && state.images.length > 0) {
    draftPost.embedImages = await Promise.all(
      state.images.map(async (img) => {
        const localRefPath = generateImageRefPath();
        await saveMediaToLocal(localRefPath, img.uri);

        return {
          localRef: {
            path: localRefPath,
          },
          alt: img.altText || "",
        };
      }),
    );
  }

  // Handle videos
  if (state.videos && state.videos.length > 0) {
    draftPost.embedVideos = await Promise.all(
      state.videos.map(async (video) => {
        const localRefPath = generateVideoRefPath(video.mimeType);
        await saveMediaToLocal(localRefPath, video.uri);

        return {
          localRef: {
            path: localRefPath,
          },
        };
      }),
    );
  }

  // Handle quote posts
  if (state.quoteUri && state.quoteCid) {
    draftPost.embedRecords = [
      {
        record: {
          uri: state.quoteUri,
          cid: state.quoteCid,
        },
      },
    ];
  }

  // Build the draft
  const draft: AppBskyDraftDefs.Draft = {
    deviceId,
    deviceName,
    posts: [draftPost],
  };

  // Add threadgate if specified
  if (state.threadgateAllow) {
    draft.threadgateAllow = state.threadgateAllow;
  }

  // Add postgate if specified
  if (state.postgateEmbeddingRules) {
    draft.postgateEmbeddingRules = state.postgateEmbeddingRules;
  }

  return draft;
}

/**
 * Extract all localRefPaths from a draft
 */
function extractLocalRefPaths(draftView: AppBskyDraftDefs.DraftView): string[] {
  const paths: string[] = [];
  const draft = draftView.draft;

  for (const post of draft.posts || []) {
    // Extract image refs
    if (post.embedImages) {
      for (const img of post.embedImages) {
        if (img.localRef?.path) {
          paths.push(img.localRef.path);
        }
      }
    }

    // Extract video refs
    if (post.embedVideos) {
      for (const video of post.embedVideos) {
        if (video.localRef?.path) {
          paths.push(video.localRef.path);
        }
      }
    }
  }

  return paths;
}

/**
 * Create a new draft on the server
 */
export async function createDraft(
  agent: AtpAgent,
  state: ComposerState,
): Promise<string> {
  const draft = await composerStateToDraft(state);

  const response = await agent.app.bsky.draft.createDraft({
    draft,
  });

  return response.data.id;
}

/**
 * Update an existing draft on the server
 */
export async function updateDraft(
  agent: AtpAgent,
  draftId: string,
  state: ComposerState,
  originalLocalRefs?: string[],
): Promise<void> {
  const draft = await composerStateToDraft(state);

  await agent.app.bsky.draft.updateDraft({
    draft: {
      id: draftId,
      draft,
    },
  });

  // Clean up orphaned media if we're updating
  if (originalLocalRefs) {
    // Extract refs from the draft we just saved
    const draftView: AppBskyDraftDefs.DraftView = {
      id: draftId,
      draft,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newRefs = extractLocalRefPaths(draftView);
    const orphanedRefs = originalLocalRefs.filter(
      (ref) => !newRefs.includes(ref),
    );

    if (orphanedRefs.length > 0) {
      await deleteMultipleMedia(orphanedRefs);
    }
  }
}

/**
 * Delete a draft from the server and clean up local media
 */
export async function deleteDraft(
  agent: AtpAgent,
  draftId: string,
  localRefs?: string[],
): Promise<void> {
  await agent.app.bsky.draft.deleteDraft({
    id: draftId,
  });

  // Clean up local media
  if (localRefs && localRefs.length > 0) {
    await deleteMultipleMedia(localRefs);
  }
}

/**
 * Get all drafts from the server with enriched local media status
 */
export async function getDrafts(
  agent: AtpAgent,
  cursor?: string,
): Promise<{ drafts: EnrichedDraft[]; cursor?: string }> {
  const response = await agent.app.bsky.draft.getDrafts({
    cursor,
  });

  // Enrich drafts with local media status
  const enrichedDrafts = await Promise.all(
    response.data.drafts.map(async (draft) => {
      const localRefs = extractLocalRefPaths(draft);
      const mediaStatuses = await Promise.all(
        localRefs.map((ref) => mediaExists(ref)),
      );

      const hasLocalMedia = localRefs.length > 0;
      const missingMediaCount = mediaStatuses.filter(
        (exists) => !exists,
      ).length;

      return {
        ...draft,
        hasLocalMedia,
        missingMediaCount,
      };
    }),
  );

  return {
    drafts: enrichedDrafts,
    cursor: response.data.cursor,
  };
}

/**
 * Convert a draft back to composer state
 */
export async function draftToComposerState(
  draftView: AppBskyDraftDefs.DraftView,
): Promise<ComposerState> {
  const draft = draftView.draft;
  const post = draft.posts?.[0];

  if (!post) {
    throw new Error("Draft has no posts");
  }

  const state: ComposerState = {
    text: post.text || "",
  };

  // Load images
  if (post.embedImages && post.embedImages.length > 0) {
    state.images = await Promise.all(
      post.embedImages.map(async (img: AppBskyDraftDefs.DraftEmbedImage) => {
        const localRefPath = img.localRef?.path;
        let uri = "";

        if (localRefPath) {
          const loadedUri = await loadMediaFromLocal(localRefPath);
          uri = loadedUri || "";
        }

        return {
          uri,
          altText: img.alt || "",
          mimeType: "image/jpeg", // Default, actual type will be determined from blob
        };
      }),
    );
  }

  // Load videos
  if (post.embedVideos && post.embedVideos.length > 0) {
    state.videos = await Promise.all(
      post.embedVideos.map(async (video: AppBskyDraftDefs.DraftEmbedVideo) => {
        const localRefPath = video.localRef?.path;
        let uri = "";

        if (localRefPath) {
          const loadedUri = await loadMediaFromLocal(localRefPath);
          uri = loadedUri || "";
        }

        // Extract mime type from localRefPath (format: video:mime/type:id.ext)
        let mimeType = "video/mp4"; // default
        if (localRefPath) {
          const parts = localRefPath.split(":");
          if (parts.length >= 2 && parts[1].includes("/")) {
            mimeType = parts[1].split(".")[0]; // Extract mime type before any extension
          }
        }

        return {
          uri,
          mimeType,
        };
      }),
    );
  }

  // Load quote post
  if (post.embedRecords && post.embedRecords.length > 0) {
    const record = post.embedRecords[0].record;
    state.quoteUri = record.uri;
    state.quoteCid = record.cid;
  }

  // Add threadgate and postgate
  if (draft.threadgateAllow) {
    state.threadgateAllow = draft.threadgateAllow;
  }

  if (draft.postgateEmbeddingRules) {
    state.postgateEmbeddingRules = draft.postgateEmbeddingRules;
  }

  return state;
}

/**
 * Clean up orphaned media files
 * Should be called periodically to remove media from deleted drafts
 */
export async function cleanupOrphanedMedia(agent: AtpAgent): Promise<number> {
  try {
    // Get all drafts
    const { drafts } = await getDrafts(agent);

    // Get all media keys from IndexedDB
    const { getAllMediaKeys } = await import("./draft-media-storage.web");
    const allMediaKeys = await getAllMediaKeys();

    // Get all referenced media
    const referencedMedia = new Set<string>();
    for (const draft of drafts) {
      const refs = extractLocalRefPaths(draft);
      refs.forEach((ref) => referencedMedia.add(ref));
    }

    // Find orphaned media
    const orphanedMedia = allMediaKeys.filter(
      (key) => !referencedMedia.has(key),
    );

    // Delete orphaned media
    if (orphanedMedia.length > 0) {
      await deleteMultipleMedia(orphanedMedia);
    }

    return orphanedMedia.length;
  } catch (error) {
    console.error("Failed to cleanup orphaned media:", error);
    return 0;
  }
}
