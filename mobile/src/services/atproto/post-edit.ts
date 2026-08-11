import { RichText } from '@atproto/api';
import { postEdit as corePostEdit } from '@bsky/core';
import { ATProtoEndpointType, rateLimited } from '../rate-limiter';
import { getAtProtoClient } from './client';

// Singleton agent accessor for the thin wrappers that delegate to @bsky/core.
const agent = () => getAtProtoClient().getAgent();

/**
 * Post editing. The AT Protocol calls live in @bsky/core; this thin wrapper adds
 * mobile's singleton agent + per-endpoint rateLimited throttling.
 *
 * Deliberately separate from `post-editor.ts`: that module's `updatePostAltText`
 * uses `putRecord`, which is right for alt text but is permanently ignored by
 * the AppView for text changes. The core primitive instead does delete + create
 * at the same rkey in one atomic `applyWrites`, which is the only mechanism the
 * AppView reindexes. See the header of packages/core/src/atproto/post-edit.ts.
 */

export type EditEligibility = corePostEdit.EditEligibility;
export type EditCost = corePostEdit.EditCost;
export type EditPostResult = corePostEdit.EditPostResult;

/** Whether the viewer may edit this post, and how long they have left. */
export const canEditPost = corePostEdit.canEditPost;

/** Quantify what an edit will cost, for disclosure in the UI. */
export const describeEditCost = corePostEdit.describeEditCost;

/** Read the non-lexicon edit timestamp off a post record. */
export const getEditedAt = corePostEdit.getEditedAt;

/** Whether a post record carries an edit stamp. */
export const isEdited = corePostEdit.isEdited;

/** How long after posting an edit stays available. */
export const EDIT_WINDOW_MS = corePostEdit.EDIT_WINDOW_MS;

export interface EditPostTextParams {
  uri: string;
  text: string;
  /**
   * Facets for the new text. Omit to have them re-detected here — the old byte
   * offsets cannot survive new text, so something must recompute them.
   */
  facets?: RichText['facets'];
}

/**
 * Replace the text of one of your own posts, preserving its URI, `createdAt`,
 * embeds and reply references.
 *
 * Facet detection happens here rather than in the caller because it needs the
 * agent (mentions are resolved to DIDs over the network), and the agent is
 * mobile's singleton.
 */
export async function editPostText(
  params: EditPostTextParams,
): Promise<EditPostResult> {
  return rateLimited(async () => {
    const client = agent();

    let facets = params.facets;
    if (!facets) {
      const rt = new RichText({ text: params.text });
      await rt.detectFacets(client);
      facets = rt.facets;
    }

    return corePostEdit.editPostText(client, {
      uri: params.uri,
      text: params.text,
      facets,
    });
  }, ATProtoEndpointType.RECORD);
}
