/**
 * Post editing against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that).
 *
 * ## Why this is shaped the way it is
 *
 * The protocol has no native edit. Two mechanisms exist and only one works:
 *
 * 1. `putRecord` on the post — the PDS accepts it and the repo really does
 *    change, but the Bluesky AppView deliberately ignores post updates. The
 *    edit is invisible in `getPosts`, `getPostThread`, and every feed, forever.
 *    Unusable as an edit, and a trap: the repo and AppView diverge permanently.
 * 2. delete + create at the *same rkey* — the AppView reindexes, so the edit is
 *    visible everywhere. This is what we do.
 *
 * We issue both operations in a single `applyWrites` commit, which is atomic
 * (no window where the post 404s), costs one firehose event instead of two, and
 * keeps image/video blobs referenced throughout so they are never orphaned.
 *
 * ## What an edit costs
 *
 * Reference resolution is keyed on the *AT-URI*, and the URI is preserved, so
 * likes, reposts, quotes and replies all stay attached — `getLikes` and
 * `viewer.like` keep working, and replies keep nesting. What breaks is the
 * AppView's denormalized aggregate counters: the delete zeroes them and the
 * create does not rebuild them. They then increment from zero on new events and
 * never backfill, so the displayed count permanently undercounts by whatever
 * existed at edit time. `describeEditCost` quantifies that for disclosure, and
 * the count-repair path in the app reads the listing endpoints to display the
 * true numbers (see `src/services/edited-post-counts.ts`).
 */

import type {
  AppBskyFeedDefs,
  AppBskyFeedPost,
  AppBskyRichtextFacet,
  BskyAgent,
} from "@atproto/api";

const POST_COLLECTION = "app.bsky.feed.post";

/**
 * How long after posting an edit stays available. Time does the work a
 * zero-engagement gate would: engagement accrues over time, so a short window
 * bounds the counter loss without blocking the common case (a typo caught
 * immediately).
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Non-lexicon field carrying the edit timestamp. `app.bsky.feed.post` has no
 * edit field, but the PDS accepts unknown properties, and mu.social already
 * writes `updatedAt` — so using the same name buys cross-client interop for
 * free. mu.social also writes `originalText`; we now write it too so that
 * users can quickly see what a post said before it was edited.
 */
export const EDITED_AT_FIELD = "updatedAt";

/**
 * Non-lexicon field carrying the pre-edit text so viewers can see the original.
 * Only stamped on the first edit; subsequent edits preserve the value so the
 * very first version is always reachable.
 */
export const ORIGINAL_TEXT_FIELD = "originalText";

/** Byte-indexed fields that a text change invalidates and must not survive it. */
const TEXT_DEPENDENT_FIELDS = ["facets", "entities"] as const;

export type EditBlockedReason =
  | "not-a-post"
  | "not-author"
  | "window-expired"
  | "no-session";

export interface EditEligibility {
  allowed: boolean;
  reason?: EditBlockedReason;
  /** Milliseconds left in the edit window; 0 once expired. */
  remainingMs: number;
}

export interface EditCost {
  likeCount: number;
  repostCount: number;
  quoteCount: number;
  replyCount: number;
  /** Total engagement that will stop being counted by other clients. */
  uncountedTotal: number;
  /**
   * True when someone has quoted this post. Unlike the counters, this is not
   * proportional to how recent the post is: quote embeds re-resolve by URI, so
   * an existing quote will silently begin displaying the *new* text.
   */
  rewritesExistingQuotes: boolean;
}

/**
 * Read the non-lexicon edit timestamp off a post record. Safe against the
 * `record` being an arbitrary unknown blob, which is how the SDK types it.
 */
export function getEditedAt(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const value = (record as Record<string, unknown>)[EDITED_AT_FIELD];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isEdited(record: unknown): boolean {
  return getEditedAt(record) !== null;
}

/**
 * Read the non-lexicon original-text field off a post record. Returns the
 * pre-edit text when present, or null for posts that were never edited (or
 * edited by a client that doesn't write this field).
 */
export function getOriginalText(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const value = (record as Record<string, unknown>)[ORIGINAL_TEXT_FIELD];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Whether the viewer may edit this post, and how long they have left.
 *
 * The window is measured from `createdAt` rather than `indexedAt`, so repeated
 * edits cannot extend it — `createdAt` is preserved across edits by design.
 */
export function canEditPost(params: {
  post: AppBskyFeedDefs.PostView;
  viewerDid: string | undefined;
  now?: Date;
}): EditEligibility {
  const { post, viewerDid } = params;
  const now = params.now ?? new Date();

  if (!viewerDid)
    return { allowed: false, reason: "no-session", remainingMs: 0 };
  if (post.author?.did !== viewerDid) {
    return { allowed: false, reason: "not-author", remainingMs: 0 };
  }

  const record = post.record as Partial<AppBskyFeedPost.Record> | undefined;
  const createdAt = record?.createdAt;
  if (typeof createdAt !== "string") {
    return { allowed: false, reason: "not-a-post", remainingMs: 0 };
  }

  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) {
    return { allowed: false, reason: "not-a-post", remainingMs: 0 };
  }

  const remainingMs = Math.max(0, createdMs + EDIT_WINDOW_MS - now.getTime());
  return remainingMs > 0
    ? { allowed: true, remainingMs }
    : { allowed: false, reason: "window-expired", remainingMs: 0 };
}

/**
 * Quantify what an edit will cost, for disclosure in the UI. Reads only the
 * aggregates already present on the post view — no extra requests.
 */
export function describeEditCost(post: AppBskyFeedDefs.PostView): EditCost {
  const likeCount = post.likeCount ?? 0;
  const repostCount = post.repostCount ?? 0;
  const quoteCount = post.quoteCount ?? 0;
  const replyCount = post.replyCount ?? 0;

  return {
    likeCount,
    repostCount,
    quoteCount,
    replyCount,
    uncountedTotal: likeCount + repostCount + quoteCount + replyCount,
    rewritesExistingQuotes: quoteCount > 0,
  };
}

/** Split an at:// URI into its three key components. */
export function parseAtUri(uri: string): {
  did: string;
  collection: string;
  rkey: string;
} | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

export interface EditPostResult {
  uri: string;
  /** New CID — the version moved, even though the URI did not. */
  cid: string;
  editedAt: string;
}

/**
 * Replace the text of an existing post, preserving its identity.
 *
 * Preserved verbatim from the authoritative record: `createdAt` (so the
 * displayed timestamp does not move), the rkey (so the URI, and the creation
 * time encoded in its TID, are stable), and every embed, reply reference,
 * language, label and tag. Only `text`, its byte-indexed companions, and the
 * edit stamp change.
 *
 * The prior record is read from the repo via `getRecord`, never from a post
 * view. This matters: a post edited by a `putRecord`-based client has a repo
 * copy that diverges from the AppView's, and rebuilding from the AppView's
 * stale copy would silently revert it.
 */
export async function editPostText(
  agent: BskyAgent,
  params: {
    uri: string;
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    editedAt?: string;
  },
): Promise<EditPostResult> {
  const { uri, text, facets } = params;

  const did = agent.session?.did;
  if (!did) throw new Error("Cannot edit post: not authenticated");

  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error(`Cannot edit post: malformed URI "${uri}"`);
  if (parsed.collection !== POST_COLLECTION) {
    throw new Error(
      `Cannot edit post: expected ${POST_COLLECTION}, got "${parsed.collection}"`,
    );
  }
  if (parsed.did !== did) {
    throw new Error("Cannot edit post: only the author may edit a post");
  }

  const existing = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: POST_COLLECTION,
    rkey: parsed.rkey,
  });

  const prior = existing.data.value as Record<string, unknown>;
  const editedAt = params.editedAt ?? new Date().toISOString();

  const next: Record<string, unknown> = {
    ...prior,
    $type: POST_COLLECTION,
    text,
    [EDITED_AT_FIELD]: editedAt,
  };
  // Stamp the pre-edit text on the first edit so viewers can see the original.
  // On re-edits the field already exists and we leave it alone.
  if (!prior[ORIGINAL_TEXT_FIELD] && typeof prior.text === "string") {
    next[ORIGINAL_TEXT_FIELD] = prior.text;
  }
  // Old byte offsets do not survive new text; drop them, then re-apply.
  for (const field of TEXT_DEPENDENT_FIELDS) delete next[field];
  if (facets && facets.length > 0) next.facets = facets;

  // Atomic: one commit, so the post is never briefly absent and the embed's
  // blobs stay referenced the whole time.
  await agent.com.atproto.repo.applyWrites({
    repo: did,
    validate: true,
    writes: [
      {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: POST_COLLECTION,
        rkey: parsed.rkey,
      },
      {
        $type: "com.atproto.repo.applyWrites#create",
        collection: POST_COLLECTION,
        rkey: parsed.rkey,
        value: next,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  });

  // applyWrites results omit the created CID on some PDS versions; read it back
  // so callers can pin strong references to the new version.
  const after = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: POST_COLLECTION,
    rkey: parsed.rkey,
  });

  return { uri, cid: after.data.cid ?? "", editedAt };
}
