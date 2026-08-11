import React from "react";
import { type EditedFlag, fetchEditedFlags } from "../services/pan-api";

/**
 * Which of the given posts carry edit history, for badging a timeline.
 *
 * Batched and incremental: each render only asks about URIs it hasn't asked
 * about before, so appending a page costs one request for that page rather than
 * re-querying the whole feed. Never one request per post — that is exactly what
 * the batch endpoint exists to avoid.
 *
 * Most edited posts are not self-describing: the repo keeps only the current
 * version, so a post's own record cannot reveal that it was edited. Without this
 * a timeline shows no badge at all for the majority of edited posts.
 *
 * Returns an accumulating map. Absent means "not edited, as far as we know" —
 * indistinguishable from "Pan is down", which is deliberate: a timeline renders
 * unbadged rather than failing.
 */
export function useEditedFlags(uris: string[]): Record<string, EditedFlag> {
  const [flags, setFlags] = React.useState<Record<string, EditedFlag>>({});
  // URIs already asked about, so growing the feed doesn't re-ask.
  const asked = React.useRef<Set<string>>(new Set());

  // Joined so the effect keys off content rather than array identity, which
  // changes on every render of the feed.
  const key = uris.join(",");

  React.useEffect(() => {
    const fresh = uris.filter((uri) => uri && !asked.current.has(uri));
    if (fresh.length === 0) return;

    for (const uri of fresh) asked.current.add(uri);

    let cancelled = false;
    void fetchEditedFlags(fresh)
      .then((result) => {
        if (cancelled) return;
        if (Object.keys(result).length === 0) {
          // Either none were edited, or Pan is unavailable. Allow a retry on a
          // later page so a transient failure doesn't un-badge for the session;
          // the client's circuit breaker makes a repeat attempt cheap.
          for (const uri of fresh) asked.current.delete(uri);
          return;
        }
        setFlags((prev) => ({ ...prev, ...result }));
      })
      .catch(() => {
        for (const uri of fresh) asked.current.delete(uri);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return flags;
}
