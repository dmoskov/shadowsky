import { AppBskyDraftDefs } from '@atproto/api';
import { getAgent } from './atproto/client';
import { rateLimited, ATProtoEndpointType } from './rate-limiter';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import {
  saveMediaToLocal,
  loadMediaFromLocal,
  deleteMediaFromLocal,
  deleteMultipleMedia,
  generateImageRefPath,
  generateVideoRefPath,
} from './draft-media-storage';

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
  // Use a combination of device identifiers to create a stable ID
  // Store in AsyncStorage to maintain consistency
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const DEVICE_ID_KEY = '@shadowsky/deviceId';

  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new device ID
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    deviceId = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Get device name for display
 */
function getDeviceName(): string {
  const deviceName = Device.deviceName || Device.modelName || 'Mobile Device';
  // Truncate to 100 chars as per API spec
  return deviceName.substring(0, 100);
}

/**
 * Convert composer state to draft format
 */
async function composerStateToDraft(
  state: ComposerState
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
          alt: img.altText || '',
        };
      })
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
      })
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
 * Create a new draft on the server
 */
export async function createDraft(state: ComposerState): Promise<string> {
  const agent = getAgent();
  const draft = await composerStateToDraft(state);

  const response = await rateLimited(
    async () =>
      agent.app.bsky.draft.createDraft({
        draft,
      }),
    ATProtoEndpointType.RECORD
  );

  return response.data.id;
}

/**
 * Update an existing draft on the server
 */
export async function updateDraft(
  draftId: string,
  state: ComposerState,
  originalLocalRefs?: string[]
): Promise<void> {
  const agent = getAgent();
  const draft = await composerStateToDraft(state);

  await rateLimited(
    async () =>
      agent.app.bsky.draft.updateDraft({
        draft: {
          id: draftId,
          draft,
        },
      }),
    ATProtoEndpointType.RECORD
  );

  // Clean up orphaned media if we're updating
  if (originalLocalRefs) {
    const currentLocalRefs = new Set<string>();

    // Collect all current local refs
    for (const post of draft.posts) {
      if (post.embedImages) {
        for (const img of post.embedImages) {
          if (img.localRef?.path) {
            currentLocalRefs.add(img.localRef.path);
          }
        }
      }
      if (post.embedVideos) {
        for (const video of post.embedVideos) {
          if (video.localRef?.path) {
            currentLocalRefs.add(video.localRef.path);
          }
        }
      }
    }

    // Delete orphaned media
    const orphanedRefs = originalLocalRefs.filter((ref) => !currentLocalRefs.has(ref));
    await deleteMultipleMedia(orphanedRefs);
  }
}

/**
 * Get all drafts from the server, enriched with local media status
 */
export async function getDrafts(cursor?: string): Promise<{
  drafts: EnrichedDraft[];
  cursor?: string;
}> {
  const agent = getAgent();

  const response = await rateLimited(
    async () =>
      agent.app.bsky.draft.getDrafts({
        cursor,
      }),
    ATProtoEndpointType.RECORD
  );

  // Enrich drafts with local media status
  const enrichedDrafts: EnrichedDraft[] = await Promise.all(
    response.data.drafts.map(async (draftView) => {
      let hasLocalMedia = true;
      let missingMediaCount = 0;

      // Check if all media files exist locally
      for (const post of draftView.draft.posts || []) {
        if (post.embedImages) {
          for (const img of post.embedImages) {
            if (img.localRef?.path) {
              const exists = await loadMediaFromLocal(img.localRef.path);
              if (!exists) {
                hasLocalMedia = false;
                missingMediaCount++;
              }
            }
          }
        }

        if (post.embedVideos) {
          for (const video of post.embedVideos) {
            if (video.localRef?.path) {
              const exists = await loadMediaFromLocal(video.localRef.path);
              if (!exists) {
                hasLocalMedia = false;
                missingMediaCount++;
              }
            }
          }
        }
      }

      return {
        ...draftView,
        hasLocalMedia,
        missingMediaCount,
      };
    })
  );

  return {
    drafts: enrichedDrafts,
    cursor: response.data.cursor,
  };
}

/**
 * Delete a draft from the server and clean up local media
 */
export async function deleteDraft(draftId: string): Promise<void> {
  const agent = getAgent();

  // First, get the draft to find its media
  const { drafts } = await getDrafts();
  const draft = drafts.find((d) => d.id === draftId);

  // Delete from server
  await rateLimited(
    async () =>
      agent.app.bsky.draft.deleteDraft({
        id: draftId,
      }),
    ATProtoEndpointType.RECORD
  );

  // Clean up local media
  if (draft) {
    const localRefs: string[] = [];

    for (const post of draft.draft.posts || []) {
      if (post.embedImages) {
        for (const img of post.embedImages) {
          if (img.localRef?.path) {
            localRefs.push(img.localRef.path);
          }
        }
      }

      if (post.embedVideos) {
        for (const video of post.embedVideos) {
          if (video.localRef?.path) {
            localRefs.push(video.localRef.path);
          }
        }
      }
    }

    await deleteMultipleMedia(localRefs);
  }
}

/**
 * Load media files for a draft
 * Returns URIs that can be used in the composer
 */
export async function loadDraftMedia(draft: EnrichedDraft): Promise<{
  images: Array<{ uri: string; altText?: string; mimeType?: string }>;
  videos: Array<{ uri: string; mimeType: string }>;
}> {
  const images: Array<{ uri: string; altText?: string; mimeType?: string }> = [];
  const videos: Array<{ uri: string; mimeType: string }> = [];

  for (const post of draft.draft.posts || []) {
    if (post.embedImages) {
      for (const img of post.embedImages) {
        if (img.localRef?.path) {
          const localUri = await loadMediaFromLocal(img.localRef.path);
          if (localUri) {
            images.push({
              uri: localUri,
              altText: img.alt,
              mimeType: 'image/jpeg', // Default, could be enhanced
            });
          }
        }
      }
    }

    if (post.embedVideos) {
      for (const video of post.embedVideos) {
        if (video.localRef?.path) {
          const localUri = await loadMediaFromLocal(video.localRef.path);
          if (localUri) {
            // Extract mimeType from localRefPath (format: video:mimeType:id)
            const parts = video.localRef.path.split(':');
            const mimeType = parts.length > 1 ? parts[1] : 'video/mp4';

            videos.push({
              uri: localUri,
              mimeType,
            });
          }
        }
      }
    }
  }

  return { images, videos };
}

/**
 * Convert a draft back to composer state
 */
export async function draftToComposerState(
  draft: EnrichedDraft
): Promise<ComposerState> {
  const post = draft.draft.posts?.[0]; // For now, only handle single posts

  if (!post) {
    return { text: '' };
  }

  const { images, videos } = await loadDraftMedia(draft);

  const state: ComposerState = {
    text: post.text || '',
    images: images.length > 0 ? images : undefined,
    videos: videos.length > 0 ? videos : undefined,
  };

  // Handle quote posts
  if (post.embedRecords && post.embedRecords.length > 0) {
    const quoteRecord = post.embedRecords[0];
    if (quoteRecord.record) {
      state.quoteUri = quoteRecord.record.uri;
      state.quoteCid = quoteRecord.record.cid;
    }
  }

  // Handle threadgate
  if (draft.draft.threadgateAllow) {
    state.threadgateAllow = draft.draft.threadgateAllow;
  }

  // Handle postgate
  if (draft.draft.postgateEmbeddingRules) {
    state.postgateEmbeddingRules = draft.draft.postgateEmbeddingRules;
  }

  return state;
}

export type { ComposerState as DraftComposerState };
