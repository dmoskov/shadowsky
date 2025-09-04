import { Loader2, Send, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { generateSmartReplies, type SmartReply } from "../services/anthropic";
import { appPreferencesService } from "../services/app-preferences-service";
import { createLogger } from "../utils/logger";

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

const logger = createLogger("InlineReplyComposer");

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

  // Smart reply state
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [enableSmartReplies, setEnableSmartReplies] = useState(false);

  useEffect(() => {
    textareaRef.current?.focus();
    // Load AI settings from app preferences
    const loadSettings = async () => {
      const prefs = await appPreferencesService.getPreferences();
      if (prefs?.aiSettings) {
        setEnableSmartReplies(prefs.aiSettings.enableSmartReplies || false);
      }
    };
    loadSettings();
  }, []);

  // Load smart replies when component mounts
  useEffect(() => {
    if (replyTo.text && enableSmartReplies) {
      loadSmartReplies();
    }
  }, [replyTo.text, enableSmartReplies]);

  const loadSmartReplies = useCallback(async () => {
    if (!replyTo.text) return;

    setIsLoadingReplies(true);
    try {
      const result = await generateSmartReplies(
        replyTo.text,
        replyTo.author.handle,
      );
      setSmartReplies(result.suggestions);
      setShowSmartReplies(true);
    } catch (error) {
      logger.error("Failed to generate smart replies:", error);
      // Silently fail - don't show error to user for AI features
    } finally {
      setIsLoadingReplies(false);
    }
  }, [replyTo.text, replyTo.author.handle]);

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

  const handleSelectSmartReply = useCallback((reply: SmartReply) => {
    setText(reply.text);
    setShowSmartReplies(false);
    textareaRef.current?.focus();
  }, []);

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

      {/* Smart Reply Suggestions */}
      {showSmartReplies && smartReplies.length > 0 && !text && (
        <div className="mt-2 space-y-1">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles
              size={12}
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Smart Replies
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {smartReplies.slice(0, 3).map((reply, index) => (
              <button
                key={index}
                onClick={() => handleSelectSmartReply(reply)}
                className="rounded-lg border p-2 text-left text-sm transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
                disabled={isPosting}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-xs opacity-60">
                    {reply.tone === "casual"
                      ? "😊"
                      : reply.tone === "professional"
                        ? "💼"
                        : reply.tone === "humorous"
                          ? "😄"
                          : reply.tone === "informative"
                            ? "📚"
                            : reply.tone === "inspirational"
                              ? "✨"
                              : "💬"}
                  </span>
                  <span className="line-clamp-2">{reply.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Smart Replies */}
      {isLoadingReplies && !text && (
        <div
          className="mt-2 flex items-center gap-2 text-sm"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          <Loader2 size={14} className="animate-spin" />
          <span>Generating smart replies...</span>
        </div>
      )}

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
