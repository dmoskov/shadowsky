import { Loader2, Send, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface InlineReplyComposerProps {
  replyTo: {
    uri: string;
    cid: string;
    author: {
      handle: string;
      displayName?: string;
    };
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!agent || !text.trim() || isPosting) return;

    setIsPosting(true);
    setError(null);

    try {
      // Get the reply structure from the post being replied to
      const replyRecord = {
        text: text.trim(),
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
    } else if (e.key === "Enter") {
      // Prevent plain Enter from bubbling up and triggering navigation
      e.preventDefault();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="mt-2 rounded-lg border p-3"
      style={{
        backgroundColor: "var(--bsky-bg-primary)",
        borderColor: "var(--bsky-border-primary)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Replying to @{replyTo.author.handle}
        </span>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-gray-500 hover:bg-opacity-10"
          aria-label="Cancel reply"
        >
          <X size={16} style={{ color: "var(--bsky-text-tertiary)" }} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply..."
        className="w-full resize-none rounded border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border-primary)",
          color: "var(--bsky-text-primary)",
          minHeight: "60px",
        }}
        rows={2}
        maxLength={300}
        disabled={isPosting}
      />

      <div className="mt-2 flex items-center justify-between">
        <span
          className="text-xs"
          style={{
            color:
              text.length > 280
                ? "var(--bsky-danger)"
                : "var(--bsky-text-tertiary)",
          }}
        >
          {text.length}/300
        </span>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs" style={{ color: "var(--bsky-danger)" }}>
              {error}
            </span>
          )}

          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isPosting || text.length > 300}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--bsky-primary)",
              color: "white",
            }}
          >
            {isPosting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Reply</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="mt-1 text-xs"
        style={{ color: "var(--bsky-text-tertiary)" }}
      >
        Tip: Press Ctrl+Enter to send • Esc to cancel
      </div>
    </div>
  );
}
