import { useQuery } from "@tanstack/react-query";
import { fetchPostEdits } from "../services/pan-api";

/** Edits settle fast: 94% land within 10 minutes, 96.7% within 30. */
const SETTLING_WINDOW_MS = 30 * 60 * 1000;

/** While a post might still be edited, re-check on this cadence. */
const UNSETTLED_TTL_MS = 60 * 1000;

/**
 * A post's edit history from Pan, fetched on demand.
 *
 * Enabled explicitly rather than on mount: history is opened by a reader, and a
 * timeline should decide whether to offer it from the batch flags endpoint
 * instead of firing one request per post.
 *
 * Caching follows how edits actually behave — a history is append-only and
 * effectively final within half an hour, so posts older than that are cached
 * indefinitely and younger ones re-checked every minute.
 *
 * @param uri  Post to fetch. Passed through unencoded; the Pan client encodes.
 * @param createdAt Post creation time, used to pick a TTL. Treated as
 *   still-settling when absent, which is the safe direction.
 * @param enabled Set true when the reader has actually asked for the history.
 */
export function usePostEditHistory(
  uri: string | undefined,
  createdAt: string | undefined,
  enabled: boolean,
) {
  const ageMs = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
  const settled = Number.isFinite(ageMs) && ageMs > SETTLING_WINDOW_MS;

  return useQuery({
    queryKey: ["postEdits", uri],
    queryFn: () => fetchPostEdits(uri!),
    enabled: enabled && !!uri,
    // A settled history never changes, so never refetch it.
    staleTime: settled ? Infinity : UNSETTLED_TTL_MS,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}
