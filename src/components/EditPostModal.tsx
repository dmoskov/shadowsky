import { AppBskyFeedDefs, RichText } from "@atproto/api";
import { postEdit } from "@bsky/core";
import { AlertTriangle, Quote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { invalidateRepairedCounts } from "../services/edited-post-counts";
import { createLogger } from "../utils/logger";
import { Button } from "./ui/Button";
import { Modal, ModalFooter } from "./ui/Modal";

const logger = createLogger("EditPostModal");

const MAX_GRAPHEMES = 300;

interface EditPostModalProps {
  post: AppBskyFeedDefs.PostView;
  isOpen: boolean;
  onClose: () => void;
  /** Fired after a successful edit so the caller can refresh its copy. */
  onEdited?: (result: { uri: string; cid: string; text: string }) => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
    : `${seconds}s`;
}

/**
 * Edit the text of one of your own posts.
 *
 * Scoped to text deliberately: embeds, reply references and every other field
 * carry over untouched, which is what the realistic case — a typo caught right
 * after posting — actually needs.
 *
 * The cost of an edit is disclosed rather than used to block one. Editing zeroes
 * the AppView's engagement counters permanently (they increment from zero
 * afterwards and never backfill), so the honest thing is to say what will stop
 * being counted and let the author decide. Quotes get a distinct warning: unlike
 * the counters, that cost is not proportional to how recent the post is.
 */
export function EditPostModal({
  post,
  isOpen,
  onClose,
  onEdited,
}: EditPostModalProps) {
  const { agent, session } = useAuth();
  const { showToast } = useToast();

  const originalText = ((post.record as { text?: string })?.text ?? "").trim();
  const [text, setText] = useState(originalText);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Reset to the post's current text whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setText(originalText);
      setError(null);
      setNow(new Date());
    }
  }, [isOpen, originalText]);

  // Tick only while open, so a closed modal costs nothing.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const eligibility = useMemo(
    () =>
      postEdit.canEditPost({
        post,
        viewerDid: session?.did,
        now,
      }),
    [post, session?.did, now],
  );

  const cost = useMemo(() => postEdit.describeEditCost(post), [post]);

  const graphemeLength = useMemo(
    () => new RichText({ text }).graphemeLength,
    [text],
  );

  const trimmed = text.trim();
  const isUnchanged = trimmed === originalText;
  const isEmpty = trimmed.length === 0;
  const isTooLong = graphemeLength > MAX_GRAPHEMES;
  const canSave =
    eligibility.allowed && !isSaving && !isUnchanged && !isEmpty && !isTooLong;

  const handleSave = useCallback(async () => {
    if (!agent) {
      setError("You are not signed in.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Recompute facets from the new text — the old byte offsets are void.
      const rt = new RichText({ text: trimmed });
      await rt.detectFacets(agent);

      const result = await postEdit.editPostText(agent, {
        uri: post.uri,
        text: rt.text,
        facets: rt.facets,
      });

      // The CID moved, so any cached repair is keyed to a stale version.
      invalidateRepairedCounts(post.uri);

      showToast(
        cost.uncountedTotal > 0
          ? "Post edited. Engagement counts will restart from zero."
          : "Post edited.",
        { type: "success" },
      );
      onEdited?.({ uri: result.uri, cid: result.cid, text: rt.text });
      onClose();
    } catch (err) {
      logger.error("Failed to edit post", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not edit this post. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    agent,
    trimmed,
    post.uri,
    cost.uncountedTotal,
    showToast,
    onEdited,
    onClose,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      labelledBy="edit-post-title"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      className="bg-asph-bg-secondary"
    >
      <div className="p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3
            id="edit-post-title"
            className="text-lg font-semibold text-asph-text-primary"
          >
            Edit post
          </h3>
          {eligibility.allowed && (
            <span className="text-sm text-asph-text-tertiary">
              {formatRemaining(eligibility.remainingMs)} left to edit
            </span>
          )}
        </div>

        {!eligibility.allowed ? (
          <p className="text-asph-text-secondary">
            {eligibility.reason === "window-expired"
              ? "The edit window for this post has closed. You can delete it and post again instead."
              : "This post can no longer be edited."}
          </p>
        ) : (
          <>
            <label htmlFor="edit-post-text" className="sr-only">
              Post text
            </label>
            <textarea
              id="edit-post-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              autoFocus
              disabled={isSaving}
              className="w-full resize-y rounded-lg border border-asph-border-primary bg-asph-bg-primary p-3 text-asph-text-primary placeholder:text-asph-text-tertiary focus:border-asph-accent focus:outline-none disabled:opacity-50"
              placeholder="What's on your mind?"
            />

            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-asph-text-tertiary">
                Attachments, links and replies are kept as they are.
              </span>
              <span
                className={
                  isTooLong ? "text-asph-error" : "text-asph-text-tertiary"
                }
              >
                {graphemeLength}/{MAX_GRAPHEMES}
              </span>
            </div>

            {cost.uncountedTotal > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-asph-border-primary bg-asph-bg-primary p-3">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-asph-warning"
                  aria-hidden="true"
                />
                <div className="text-sm text-asph-text-secondary">
                  <p>
                    Editing restarts this post's public engagement counts from
                    zero. Nothing is deleted — the{" "}
                    {[
                      cost.likeCount > 0 &&
                        `${cost.likeCount} like${cost.likeCount === 1 ? "" : "s"}`,
                      cost.repostCount > 0 &&
                        `${cost.repostCount} repost${cost.repostCount === 1 ? "" : "s"}`,
                      cost.replyCount > 0 &&
                        `${cost.replyCount} repl${cost.replyCount === 1 ? "y" : "ies"}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    stay attached, but other apps will show zero.
                  </p>
                  <p className="mt-1 text-asph-text-tertiary">
                    Asphodel will keep showing the real numbers.
                  </p>
                </div>
              </div>
            )}

            {cost.rewritesExistingQuotes && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-asph-border-primary bg-asph-bg-primary p-3">
                <Quote
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-asph-warning"
                  aria-hidden="true"
                />
                <p className="text-sm text-asph-text-secondary">
                  {cost.quoteCount === 1
                    ? "Someone has quoted this post. Their quote will start showing your new text instead of what they quoted."
                    : `${cost.quoteCount} people have quoted this post. Their quotes will start showing your new text instead of what they quoted.`}
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-asph-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        {eligibility.allowed && (
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
