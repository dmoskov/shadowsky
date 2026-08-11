/**
 * Shared Pan API client.
 *
 * Pan (the firehose narrative/sentiment service) backs trending and Network
 * Weather. All callers share one circuit breaker: when every endpoint fails
 * (404 because the routes aren't deployed, 5xx, or network errors), Pan is
 * skipped entirely with exponential backoff so prod consoles and the API
 * hosts aren't hammered with doomed requests. Success resets the breaker.
 */

import { debug } from "@bsky/shared";

const PAN_API_URLS = ["https://api.shadowsky.io", "https://api.asphodel.is"];

const FETCH_TIMEOUT = 8000;
const BACKOFF_BASE_MS = 5 * 60 * 1000; // 5 min
const BACKOFF_MAX_MS = 60 * 60 * 1000; // 1 hour cap

let failedUntil = 0;
let consecutiveFailures = 0;

/** True while the breaker is open and Pan calls are being skipped. */
export function panUnavailable(): boolean {
  return Date.now() < failedUntil;
}

/**
 * Fetch JSON from the first reachable Pan endpoint, or null when Pan is
 * unavailable (breaker open or all endpoints failed). Callers treat null as
 * "feature degrades silently".
 */
export async function fetchFromPan(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown | null> {
  if (panUnavailable()) return null;

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  const qs = query.toString() ? `?${query.toString()}` : "";

  for (const baseUrl of PAN_API_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const resp = await fetch(`${baseUrl}${path}${qs}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        debug.log(`Pan API ${baseUrl}${path} returned ${resp.status}`);
        continue;
      }
      consecutiveFailures = 0;
      return await resp.json();
    } catch {
      debug.log(`Pan API ${baseUrl} unreachable for ${path}`);
    }
  }

  consecutiveFailures++;
  const backoff = Math.min(
    BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1),
    BACKOFF_MAX_MS,
  );
  failedUntil = Date.now() + backoff;
  debug.log(
    `Pan API unavailable; backing off ${Math.round(backoff / 60000)}min`,
  );
  return null;
}

/** Aggregated author signals from Pan, backing the profile hover card. */
export interface AuthorCard {
  did: string;
  reputation?: { score: number; class: string; confidence: number | null };
  activity?: { total_posts: number; last_post_at: string | null };
  sentiment_recent?: {
    positive: number;
    negative: number;
    neutral: number;
    sample: number;
    model_share: number;
  };
  community_count?: number;
  narratives?: { name: string; post_count: number }[];
}

/**
 * Fetch aggregated author signals for a DID, or null when Pan is unavailable
 * (breaker open) or the author is unknown (response carries only the did).
 */
export async function fetchAuthorCard(did: string): Promise<AuthorCard | null> {
  const res = await fetchFromPan(
    `/api/cards/author/${encodeURIComponent(did)}`,
  );
  const data = (res as { data?: AuthorCard } | null)?.data;
  return data?.did ? data : null;
}

// ─── Post edit history ────────────────────────────────────

/** One version of a post, oldest first. */
export interface PostVersion {
  seq: number;
  text: string;
  at: string;
  /**
   * Where this version came from. "edit" is one Pan watched go past;
   * "skeetsAppHistory"/"originalText" rode along inside the record.
   */
  origin: "skeetsAppHistory" | "originalText" | "captured" | "edit";
  delay_seconds: number | null;
  /**
   * Whether this version's text differs from the one before it. `false` means
   * a real edit that changed something other than the text — alt text or an
   * embed — so render it as an edit event with no diff, not as a no-op.
   */
  text_changed: boolean | null;
}

export interface PostEditHistory {
  uri: string;
  author_did: string;
  edit_count: number;
  last_edited_at: string;
  original_created_at: string | null;
  sources: ("declared" | "recreate")[];
  /**
   * False means every version came from Pan's firehose capture and exists
   * nowhere else on the network — not in the repo, not from any AppView call.
   * That is most of the corpus, and the reason to call this API rather than
   * parsing records client-side.
   */
  self_describing: boolean;
  /**
   * Oldest first. NOTE: these are post-edit states, and the last entry is the
   * *current* text — verified against the live record. The pre-first-edit
   * original is not included and is not retrievable from this endpoint.
   */
  versions: PostVersion[];
}

/**
 * Full version history for one post, or null if it was never edited.
 *
 * Fetch on demand when someone opens the history, not eagerly — use
 * fetchEditedFlags to decide whether to offer it at all.
 *
 * The URI is passed unencoded on purpose: fetchFromPan builds it into
 * URLSearchParams, which encodes it. Calling encodeURIComponent here would
 * double-encode and silently match nothing.
 */
export async function fetchPostEdits(
  uri: string,
): Promise<PostEditHistory | null> {
  const res = await fetchFromPan("/api/posts/edits", { uri });
  const data = (res as { data?: PostEditHistory } | null)?.data;
  return data && data.edit_count > 0 ? data : null;
}

export interface EditedFlag {
  edit_count: number;
  last_edited_at: string;
  self_describing: boolean;
}

/** Batch cap the endpoint accepts; callers must chunk above this. */
export const EDITED_FLAGS_BATCH_LIMIT = 100;

/**
 * Which of these posts carry edit history, for badging a timeline. One call per
 * rendered page — never per post, which is what this endpoint exists to avoid.
 *
 * Returns an empty object when Pan is unavailable, so a timeline renders
 * unbadged rather than failing. URIs absent from the response were never
 * edited.
 */
export async function fetchEditedFlags(
  uris: string[],
): Promise<Record<string, EditedFlag>> {
  if (uris.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < uris.length; i += EDITED_FLAGS_BATCH_LIMIT) {
    chunks.push(uris.slice(i, i + EDITED_FLAGS_BATCH_LIMIT));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetchFromPan("/api/posts/edited", {
        uris: chunk.join(","),
      });
      return (
        (res as { data?: { edited?: Record<string, EditedFlag> } } | null)?.data
          ?.edited ?? {}
      );
    }),
  );

  return Object.assign({}, ...results) as Record<string, EditedFlag>;
}
