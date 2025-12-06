/**
 * DMMessage Component
 *
 * Renders a single DM message with status indicators for optimistic updates.
 * Shows sending, sent, failed, and retrying states.
 */

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { forwardRef } from "react";
import type { DMStatus } from "../services/dm-queue";
import { MessageReactions } from "./MessageReactions";

interface DMMessageProps {
  messageId: string;
  text: string;
  sentAt: string;
  isOwnMessage: boolean;
  isHighlighted?: boolean;
  conversationId: string;
  reactions?: Record<string, { count: number; users: string[] }>;
  // Optimistic message props
  localId?: string;
  status?: DMStatus;
  retryCount?: number;
  lastError?: string;
  isOptimistic?: boolean;
  onRetry?: (localId: string) => void;
}

export const DMMessage = forwardRef<HTMLDivElement, DMMessageProps>(
  (
    {
      messageId,
      text,
      sentAt,
      isOwnMessage,
      isHighlighted,
      conversationId,
      reactions,
      localId,
      status,
      lastError,
      isOptimistic,
      onRetry,
    },
    ref
  ) => {
    const renderStatusIndicator = () => {
      if (!isOptimistic || !status) return null;

      switch (status) {
        case "sending":
          return (
            <span
              className="inline-flex items-center gap-1 text-xs opacity-70"
              title="Sending..."
            >
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          );
        case "sent":
          return (
            <span
              className="inline-flex items-center gap-1 text-xs opacity-70"
              title="Sent"
            >
              <CheckCheck className="h-3 w-3" />
            </span>
          );
        case "retrying":
          return (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-400"
              title={`Retrying... ${lastError || ""}`}
            >
              <RefreshCw className="h-3 w-3 animate-spin" />
            </span>
          );
        case "failed":
          return (
            <span
              className="inline-flex items-center gap-1 text-xs text-red-400"
              title={lastError || "Failed to send"}
            >
              <AlertCircle className="h-3 w-3" />
            </span>
          );
        default:
          return (
            <span
              className="inline-flex items-center gap-1 text-xs opacity-70"
              title="Delivered"
            >
              <Check className="h-3 w-3" />
            </span>
          );
      }
    };

    const isFailed = status === "failed";
    const isRetrying = status === "retrying";
    const isSending = status === "sending";

    return (
      <div
        ref={ref}
        className={`mb-4 flex transition-all duration-500 ${isOwnMessage ? "justify-end" : ""} ${
          isHighlighted
            ? "rounded-lg bg-yellow-100 p-2 ring-2 ring-yellow-400 dark:bg-yellow-900/30 dark:ring-yellow-600"
            : ""
        }`}
        data-message-id={messageId}
        data-local-id={localId}
      >
        <div className="max-w-[70%]">
          <div
            className={`rounded-lg p-2 px-4 ${
              isOwnMessage
                ? isFailed
                  ? "bg-red-500/80 text-white"
                  : isRetrying
                    ? "bg-bsky-primary/70 text-white"
                    : isSending
                      ? "bg-bsky-primary/80 text-white"
                      : "bg-bsky-primary text-white"
                : "bg-bsky-bg-secondary text-bsky-text-primary"
            } ${isSending ? "opacity-80" : ""}`}
          >
            <div className="break-words">{text}</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs opacity-70">
              <span>
                {formatDistanceToNow(new Date(sentAt), {
                  addSuffix: true,
                })}
              </span>
              {isOwnMessage && renderStatusIndicator()}
            </div>
          </div>

          {/* Failed message retry button */}
          {isFailed && localId && onRetry && (
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() => onRetry(localId)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                title={lastError || "Message failed to send"}
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
              {lastError && (
                <span
                  className="max-w-[150px] truncate text-xs text-red-400"
                  title={lastError}
                >
                  {lastError}
                </span>
              )}
            </div>
          )}

          {/* Only show reactions for non-optimistic messages */}
          {!isOptimistic && (
            <MessageReactions
              conversationId={conversationId}
              messageId={messageId}
              reactions={reactions}
              isOwnMessage={isOwnMessage}
            />
          )}
        </div>
      </div>
    );
  }
);

DMMessage.displayName = "DMMessage";
