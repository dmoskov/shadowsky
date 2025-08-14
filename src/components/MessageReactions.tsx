import { debug } from "@bsky/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { dmService } from "../services/dm-service";
import { EmojiPicker } from "./EmojiPicker";

interface MessageReactionsProps {
  conversationId: string;
  messageId: string;
  reactions?: {
    [emoji: string]: {
      count: number;
      users: string[];
    };
  };
  isOwnMessage: boolean;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  conversationId,
  messageId,
  reactions,
  isOwnMessage,
}) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const addReactionMutation = useMutation({
    mutationFn: ({ emoji }: { emoji: string }) =>
      dmService.addReaction(conversationId, messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", conversationId],
      });
      setShowEmojiPicker(false);
    },
    onError: (error) => {
      debug.error("Failed to add reaction:", error);
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: ({ emoji }: { emoji: string }) =>
      dmService.removeReaction(conversationId, messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", conversationId],
      });
    },
    onError: (error) => {
      debug.error("Failed to remove reaction:", error);
    },
  });

  const handleReactionClick = (emoji: string) => {
    if (!session?.did) return;

    const hasReacted = reactions?.[emoji]?.users.includes(session.did);
    if (hasReacted) {
      removeReactionMutation.mutate({ emoji });
    } else {
      addReactionMutation.mutate({ emoji });
    }
  };

  const handleAddReactionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPosition({
      top: rect.bottom + window.scrollY + 5,
      left: isOwnMessage
        ? rect.right + window.scrollX - 300
        : rect.left + window.scrollX,
    });
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    addReactionMutation.mutate({ emoji });
  };

  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  return (
    <div className="mt-1">
      {/* Display existing reactions */}
      <div className="flex flex-wrap gap-1">
        {reactions &&
          Object.entries(reactions).map(([emoji, data]) => {
            const hasReacted = session?.did && data.users.includes(session.did);
            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                  hasReacted
                    ? "bg-bsky-primary/20 dark:bg-bsky-primary/30 text-bsky-primary"
                    : "bg-bsky-bg-secondary text-bsky-text-secondary hover:bg-bsky-bg-tertiary"
                }`}
                title={`${data.count} reaction${data.count > 1 ? "s" : ""}`}
              >
                <span className="text-sm">{emoji}</span>
                {data.count > 1 && <span>{data.count}</span>}
              </button>
            );
          })}

        {/* Add reaction button */}
        <button
          onClick={handleAddReactionClick}
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-bsky-text-secondary transition-colors hover:bg-bsky-bg-secondary"
          title="Add reaction"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>
      </div>

      {/* Quick reactions on hover (for desktop) */}
      <div className="group relative hidden md:block">
        <div
          className={`invisible absolute ${isOwnMessage ? "right-0" : "left-0"} top-0 z-10 flex gap-1 rounded-lg bg-white p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 dark:bg-gray-800`}
        >
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowEmojiPicker(false)}
          />
          <div
            className="fixed z-50"
            style={{
              top: `${pickerPosition.top}px`,
              left: `${pickerPosition.left}px`,
            }}
          >
            <EmojiPicker
              onSelectEmoji={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        </>
      )}
    </div>
  );
};
