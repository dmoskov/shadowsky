/**
 * ComposerTextArea - Level 1 (Primary) Component
 * Always visible - the main text input area for composing posts
 */

import { Loader, Sparkles } from "lucide-react";
import React from "react";
import { LinkPreview } from "../LinkPreview";
import {
  MentionTypeahead,
  type MentionTypeaheadHandle,
} from "../MentionTypeahead";
import type { HashtagSuggestion } from "./types";

interface ComposerTextAreaProps {
  text: string;
  onTextChange: (text: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  isPosting: boolean;
  textareaRef: React.RefObject<MentionTypeaheadHandle>;

  // Link preview
  linkPreviewEnabled: boolean;
  linkPreview: {
    metadata: {
      url: string;
      title: string;
      description: string;
      imageUrl?: string;
    } | null;
    isLoading: boolean;
    error: string | null;
    clearPreview: () => void;
  };
  mediaCount: number;
  onLinkPreviewRemove: () => void;

  // Hashtag suggestions (optional - shown when enabled)
  showHashtagSuggestions?: boolean;
  hashtagSuggestions?: HashtagSuggestion[];
  isLoadingHashtags?: boolean;
  onApplyHashtag?: (tag: string) => void;
}

export const ComposerTextArea: React.FC<ComposerTextAreaProps> = ({
  text,
  onTextChange,
  onPaste,
  isPosting,
  textareaRef,
  linkPreviewEnabled,
  linkPreview,
  mediaCount,
  onLinkPreviewRemove,
  showHashtagSuggestions = false,
  hashtagSuggestions = [],
  isLoadingHashtags = false,
  onApplyHashtag,
}) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <MentionTypeahead
          ref={textareaRef}
          value={text}
          onChange={onTextChange}
          onPaste={onPaste}
          placeholder="What's on your mind?"
          className="composer-textarea font-inherit w-full rounded-lg p-4 transition-all focus-visible:border-blue-500"
          style={{
            background: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-primary)",
            outline: "none",
          }}
          disabled={isPosting}
        />
      </div>

      {/* Hashtag Suggestions */}
      {(showHashtagSuggestions || isLoadingHashtags) && text.length >= 20 && (
        <div className="mb-3 mt-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles
              size={14}
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Suggested Hashtags
            </span>
            {isLoadingHashtags && <Loader size={12} className="animate-spin" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {hashtagSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onApplyHashtag?.(suggestion.tag)}
                disabled={isPosting}
                className="group relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor:
                    suggestion.relevance > 0.7
                      ? "var(--bsky-primary)"
                      : "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
              >
                <span>#{suggestion.tag}</span>
                {suggestion.isTrending && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--bsky-primary)" }}
                    title="Trending"
                  >
                    🔥
                  </span>
                )}
                {suggestion.relevance > 0.7 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-2 w-2 rounded-full"
                    style={{ background: "var(--bsky-primary)" }}
                    title="Highly relevant"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Link Preview */}
      {linkPreviewEnabled &&
        mediaCount === 0 &&
        (linkPreview.isLoading ||
          linkPreview.metadata ||
          linkPreview.error) && (
          <LinkPreview
            metadata={linkPreview.metadata}
            isLoading={linkPreview.isLoading}
            error={linkPreview.error}
            onRemove={onLinkPreviewRemove}
          />
        )}
    </div>
  );
};

export default ComposerTextArea;
