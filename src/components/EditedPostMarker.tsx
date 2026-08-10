import { postEdit } from "@bsky/core";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import React from "react";
import { usePostEditHistory } from "../hooks/usePostEditHistory";
import { stripEditSignature } from "../services/edit-signature";

interface EditedPostMarkerProps {
  /** The raw post record. Safe to pass anything. */
  record: unknown;
  /** Post URI. Enables Pan lookup, which is the only source for most history. */
  uri?: string;
  /**
   * Edit count from a batch fetchEditedFlags call. Set this on timelines so the
   * badge appears for posts whose record says nothing, without a per-post
   * request.
   */
  knownEditCount?: number;
  /** Compact suits dense contexts like nested thread replies. */
  size?: "default" | "compact";
  className?: string;
}

/** One version as rendered, after signature stripping. */
interface DisplayVersion {
  text: string;
  writtenAt: string | null;
  /** A real edit that changed something other than the text. */
  textUnchanged: boolean;
}

/**
 * "Edited" marker with the post's prior versions behind a disclosure.
 *
 * Prefers Pan's captured history over the record's own fields. That matters
 * more than it sounds: most edited posts are not self-describing — the repo
 * keeps only the current version, so no amount of client-side parsing recovers
 * what they used to say. Pan watched the edits go past and is the only source.
 * Record fields (skeetsAppHistory, originalText) are the fallback, and are all
 * we have when Pan is unavailable.
 *
 * Fetches on demand, when a reader opens the history.
 */
export const EditedPostMarker: React.FC<EditedPostMarkerProps> = ({
  record,
  uri,
  knownEditCount,
  size = "default",
  className = "",
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const createdAt = (record as { createdAt?: string } | null)?.createdAt;

  const { data: panHistory, isLoading } = usePostEditHistory(
    uri,
    createdAt,
    expanded,
  );

  // What the record itself admits to, used before Pan answers and as fallback.
  const recordHistory = React.useMemo(
    () => postEdit.getEditHistory(record, createdAt),
    [record, createdAt],
  );

  const versions: DisplayVersion[] = React.useMemo(() => {
    if (panHistory) {
      // Pan's last version is the *current* text, so drop it — the post itself
      // is already on screen directly above this.
      const prior = panHistory.versions.slice(0, -1);
      return prior.map((v) => ({
        text: stripEditSignature(v.text),
        writtenAt: v.at,
        // text_changed describes this version against the one before it.
        textUnchanged: v.text_changed === false,
      }));
    }
    return recordHistory.versions.map((v) => ({
      text: stripEditSignature(v.text),
      // skeetsAppHistory stamps the post's createdAt on every entry, so these
      // timestamps are all identical and not worth showing. Array order is the
      // only reliable sequence.
      writtenAt: recordHistory.sources.includes("skeetsAppHistory")
        ? null
        : v.writtenAt,
      textUnchanged: false,
    }));
  }, [panHistory, recordHistory]);

  const editedAt = panHistory?.last_edited_at ?? recordHistory.editedAt;
  const editCount =
    panHistory?.edit_count ??
    knownEditCount ??
    (recordHistory.versions.length || 0);

  // Pan may know about an edit the record is silent about, so trust either.
  const isEdited =
    postEdit.isEdited(record) || (knownEditCount ?? 0) > 0 || !!panHistory;
  if (!isEdited) return null;

  const textSize = size === "compact" ? "text-[10px]" : "text-xs";
  const editedAgo = editedAt
    ? formatDistanceToNow(new Date(editedAt), { addSuffix: true })
    : null;
  const label = editCount > 1 ? `Edited ${editCount}×` : "Edited";

  // Nothing to show and no way to look for more.
  const canExpand = uri != null || recordHistory.versions.length > 0;
  if (!canExpand) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} ${className}`}
        style={{ color: "var(--asph-text-tertiary)" }}
        title={editedAgo ? `Edited ${editedAgo}` : "Edited"}
      >
        <Pencil size={10} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span className={className}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className={`inline-flex items-center gap-1 ${textSize} transition-opacity hover:opacity-70`}
        style={{ color: "var(--asph-text-tertiary)" }}
        aria-expanded={expanded}
        aria-label={`Edited — ${expanded ? "hide" : "show"} previous versions`}
        title={
          editedAgo
            ? `Edited ${editedAgo} — click to ${expanded ? "hide" : "show"}`
            : `Click to ${expanded ? "hide" : "show"} previous versions`
        }
      >
        <Pencil size={10} aria-hidden="true" />
        <span className="underline decoration-dotted">{label}</span>
      </button>

      {expanded && (
        <span className="mt-1 block space-y-1.5">
          {isLoading && versions.length === 0 && (
            <span
              className={`block ${textSize}`}
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              Loading history…
            </span>
          )}

          {!isLoading && versions.length === 0 && (
            <span
              className={`block ${textSize}`}
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              No earlier text was preserved for this post.
            </span>
          )}

          {versions.map((version, index) => (
            <span
              key={`${version.writtenAt ?? "undated"}-${index}`}
              className="block rounded border-l-2 pl-2"
              style={{ borderColor: "var(--asph-text-tertiary)" }}
            >
              {/* Plain text on purpose: facets index into the *current* text,
                  so applying them to a different-length version puts mentions
                  and links in the wrong place. */}
              <span
                className={`block whitespace-pre-wrap break-words ${textSize}`}
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {version.text}
              </span>
              <span
                className="mt-0.5 block text-[10px]"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {`Version ${index + 1}`}
                {version.writtenAt
                  ? ` · ${formatDistanceToNow(new Date(version.writtenAt), {
                      addSuffix: true,
                    })}`
                  : ""}
                {/* A real edit that touched alt text or an embed rather than
                    the words — worth showing, but there is no diff to see. */}
                {version.textUnchanged ? " · no text change" : ""}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
};
