/**
 * Bridges the native SwiftUI context menu's "Edit Post" action to the RN edit
 * sheet.
 *
 * The native event carries only a URI — Swift has no `PostView` to hand back —
 * so the caller supplies a lookup against whatever data it already holds (the
 * feed query pages, the thread tree). Screens hosting a native post surface use
 * this instead of duplicating the state plumbing four times.
 */

import { AppBskyFeedDefs } from '@atproto/api';
import { useCallback, useMemo, useState } from 'react';
import { getAtProtoClient } from '../services/atproto/client';

interface NativeEditPostEvent {
  nativeEvent: { uri: string };
}

export interface NativePostEditor {
  /** Viewer's DID — pass to the native view so `isOwnPost` can be true. */
  currentUserDid?: string;
  /** Post being edited, or null when the sheet is closed. */
  editingPost: AppBskyFeedDefs.PostView | null;
  /** Attach to the native view's `onEditPost`. */
  handleNativeEditPost: (event: NativeEditPostEvent) => void;
  closeEditor: () => void;
}

export function useNativePostEditor(
  findPostByUri: (uri: string) => AppBskyFeedDefs.PostView | undefined,
): NativePostEditor {
  // Read the DID off the ATProto client rather than AuthContext. Two reasons:
  // it is the same session `editPostText` will actually write as, so the two
  // cannot disagree about who the author is; and AuthContext transitively pulls
  // in the background-fetch/task-manager stack, which is a heavy dependency to
  // add to every screen hosting a feed. The DID only changes on sign-in or
  // account switch, both of which remount these screens.
  const currentUserDid = getAtProtoClient().getSession()?.did;
  const [editingUri, setEditingUri] = useState<string | null>(null);

  const handleNativeEditPost = useCallback((event: NativeEditPostEvent) => {
    setEditingUri(event.nativeEvent?.uri ?? null);
  }, []);

  const closeEditor = useCallback(() => setEditingUri(null), []);

  // Resolved on each render rather than snapshotted at open time, so the sheet
  // follows the refetched post after a save instead of holding stale counts.
  const editingPost = useMemo(
    () => (editingUri ? findPostByUri(editingUri) ?? null : null),
    [editingUri, findPostByUri],
  );

  return {
    currentUserDid,
    editingPost,
    handleNativeEditPost,
    closeEditor,
  };
}

/**
 * Find a post by URI in a React Query infinite feed cache. Checks the feed
 * items' own posts and their reply parents, which is where the native feed's
 * rows come from.
 */
export function findPostInFeedPages(
  pages: Array<{ feed: AppBskyFeedDefs.FeedViewPost[] }> | undefined,
  uri: string,
): AppBskyFeedDefs.PostView | undefined {
  if (!pages) return undefined;

  for (const page of pages) {
    for (const item of page.feed) {
      if (item.post?.uri === uri) return item.post;
      const parent = item.reply?.parent as AppBskyFeedDefs.PostView | undefined;
      if (parent?.uri === uri) return parent;
    }
  }

  return undefined;
}
