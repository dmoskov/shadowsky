import { RichText } from "@atproto/api";
import { Loader2, Send, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  MentionTypeahead,
  type MentionTypeaheadHandle,
} from "./MentionTypeahead";

interface InlineReplyComposerProps {
  replyTo: {
    uri: string;
    cid: string;
    author: {
      handle: string;
      displayName?: string;
    };
    text?: string;
  };
  root?: {
    uri: string;
    cid: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export function InlineReplyComposer({
  replyTo,
  root,
  onClose,
  onSuccess,
}: InlineReplyComposerProps) {
  const { agent } = useAuth();
  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<MentionTypeaheadHandle>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!agent || !text.trim() || isPosting) return;

    setIsPosting(true);
    setError(null);

    try {
      // Detect facets (mentions, links, hashtags) in the text
      const rt = new RichText({ text: text.trim() });
      await rt.detectFacets(agent);

      // Get the reply structure from the post being replied to
      const replyRecord = {
        text: rt.text,
        facets: rt.facets,
        reply: {
          // If a root is provided, use it. Otherwise, this post might be the root
          root: root || {
            uri: replyTo.uri,
            cid: replyTo.cid,
          },
          // Always reply to the specific post clicked
          parent: {
            uri: replyTo.uri,
            cid: replyTo.cid,
          },
        },
      };

      await agent.post(replyRecord);

      setText("");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to post reply:", err);
      setError("Failed to post reply. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Always stop propagation to prevent parent handlers
    e.stopPropagation();

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Allow plain Enter to work normally for creating new lines

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="mt-2 rounded-lg border p-3"
      style={{
        backgroundColor: "var(--asph-bg-primary)",
        borderColor: "var(--asph-border-primary)",
      }}
      onClick={(e) => e.stopPropagation()}
      role="form"
      aria-label={`Reply to ${replyTo.author.displayName || replyTo.author.handle}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
          id="reply-to-label"
        >
          Replying to @{replyTo.author.handle}
        </span>
        <button
          onClick={onClose}
          className="touch-target-icon rounded p-1 transition-colors hover:bg-asph-bg-active"
          aria-label="Cancel reply"
        >
          <X
            size={16}
            style={{ color: "var(--asph-text-tertiary)" }}
            aria-hidden="true"
          />
        </button>
      </div>

      <MentionTypeahead
        ref={textareaRef}
        value={text}
        onChange={setText}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply..."
        className="w-full resize-none rounded border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          borderColor: "var(--asph-border-primary)",
          color: "var(--asph-text-primary)",
          minHeight: "60px",
        }}
        rows={2}
        maxLength={300}
        disabled={isPosting}
        aria-label="Reply text"
        aria-describedby="reply-to-label reply-char-count"
      />

      <div className="mt-2 flex items-center justify-between">
        <span
          id="reply-char-count"
          className="text-xs"
          style={{
            color:
              text.length > 280
                ? "var(--asph-danger)"
                : "var(--asph-text-tertiary)",
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {text.length}/300
        </span>

        <div className="flex items-center gap-2">
          {error && (
            <span
              className="text-xs"
              style={{ color: "var(--asph-danger)" }}
              role="alert"
            >
              {error}
            </span>
          )}

          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isPosting || text.length > 300}
            className="touch-target-sm flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--asph-primary)",
              color: "white",
            }}
            aria-label={isPosting ? "Posting reply..." : "Send reply"}
            aria-busy={isPosting}
          >
            {isPosting ? (
              <>
                <Loader2
                  size={14}
                  className="animate-spin"
                  aria-hidden="true"
                />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send size={14} aria-hidden="true" />
                <span>Reply</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="mt-1 text-xs"
        style={{ color: "var(--asph-text-tertiary)" }}
        aria-hidden="true"
      >
        Tip: Press Ctrl+Enter to send • Esc to cancel
      </div>
    </div>
  );
}
