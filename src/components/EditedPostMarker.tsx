import { postEdit } from "@bsky/core";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import React from "react";

interface EditedPostMarkerProps {
  /** The raw post record. Safe to pass anything — unedited posts render null. */
  record: unknown;
  /** Compact suits dense contexts like nested thread replies. */
  size?: "default" | "compact";
  className?: string;
}

/**
 * "Edited" marker with the post's prior versions behind a disclosure.
 *
 * Self-contained (owns its expand state) so it can be dropped into surfaces
 * that render posts inside a map, where a parent-held toggle would need a
 * per-URI set. PostRenderer keeps its own inline version because its chip lives
 * in the metadata row, separate from the panel under the text.
 *
 * Reads every edit format we know about via getEditHistory, so it shows history
 * from other clients too — not just posts edited in Asphodel.
 */
export const EditedPostMarker: React.FC<EditedPostMarkerProps> = ({
  record,
  size = "default",
  className = "",
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const history = React.useMemo(
    () =>
      postEdit.getEditHistory(
        record,
        (record as { createdAt?: string } | null)?.createdAt,
      ),
    [record],
  );

  if (!postEdit.isEdited(record)) return null;

  const { versions, editedAt } = history;
  const textSize = size === "compact" ? "text-[10px]" : "text-xs";
  const editedAgo = editedAt
    ? formatDistanceToNow(new Date(editedAt), { addSuffix: true })
    : null;

  // Edited, but by a client that kept nothing we can show.
  if (versions.length === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} ${className}`}
        style={{ color: "var(--asph-text-tertiary)" }}
        title={editedAgo ? `Edited ${editedAgo}` : "Edited"}
      >
        <Pencil size={10} aria-hidden="true" />
        Edited
      </span>
    );
  }

  const label = versions.length > 1 ? `Edited ${versions.length}×` : "Edited";

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
        aria-label={`Edited — ${expanded ? "hide" : "show"} previous ${
          versions.length > 1 ? "versions" : "version"
        }`}
        title={
          editedAgo
            ? `Edited ${editedAgo} — click to ${expanded ? "hide" : "show"}`
            : `Click to ${expanded ? "hide" : "show"} previous text`
        }
      >
        <Pencil size={10} aria-hidden="true" />
        <span className="underline decoration-dotted">{label}</span>
      </button>

      {expanded && (
        <span className="mt-1 block space-y-1.5">
          {versions.map((version, index) => (
            <span
              key={`${version.writtenAt ?? "undated"}-${index}`}
              className="block rounded border-l-2 pl-2"
              style={{ borderColor: "var(--asph-text-tertiary)" }}
            >
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
                {/* Only the earliest entry is the true original; later ones are
                    intermediate revisions. Undated versions come from clients
                    that don't timestamp them. */}
                {index === 0 ? "Original" : `Revision ${index + 1}`}
                {version.writtenAt
                  ? ` · ${formatDistanceToNow(new Date(version.writtenAt), {
                      addSuffix: true,
                    })}`
                  : ""}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
};
