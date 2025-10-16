import { AppBskyFeedDefs } from "@atproto/api";
import React from "react";
import { PostActionBar } from "./PostActionBar";
import { PostRenderer } from "./PostRenderer";

interface PostCardProps {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  onClick?: () => void;
  onQuoteClick?: (uri: string) => void;
  showBorder?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  reason,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onClick,
  onQuoteClick,
  showBorder = true,
}) => {
  return (
    <div
      className={showBorder ? "border-b" : ""}
      style={showBorder ? { borderColor: "var(--bsky-border-primary)" } : {}}
    >
      <PostRenderer
        post={post}
        reason={reason}
        showActions={false}
        onClick={onClick}
        onQuoteClick={onQuoteClick}
      />
      <div className="px-4 pb-3">
        <PostActionBar
          post={post}
          onLike={onLike}
          onRepost={onRepost}
          onReply={onReply}
          onQuote={onQuote}
          onBookmark={onBookmark}
          showCounts={true}
        />
      </div>
    </div>
  );
};
