import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react';
import clsx from 'clsx';
import type { Post } from '@bsky/shared/types/atproto';
import { Tooltip } from '../ui/Tooltip';

interface PostEngagementBarProps {
  post: Post;
  isLiked: boolean;
  isReposted: boolean;
  likeCount: number;
  repostCount: number;
  isLiking: boolean;
  isReposting: boolean;
  onReply: () => void;
  onRepost: () => void;
  onLike: () => void;
  onShare: () => void;
}

export const PostEngagementBar: React.FC<PostEngagementBarProps> = ({
  post,
  isLiked,
  isReposted,
  likeCount,
  repostCount,
  isLiking,
  isReposting,
  onReply,
  onRepost,
  onLike,
  onShare,
}) => {
  return (
    <div className="post-engagement">
      <Tooltip content="Reply" position="top">
        <motion.button
          className={clsx("engagement-btn", { active: false })}
          onClick={onReply}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <MessageCircle size={18} />
          <span>{post.replyCount || 0}</span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Repost" position="top">
        <motion.button
          className={clsx("engagement-btn", { 
            active: isReposted, 
            reposted: isReposted,
            'btn-loading': isReposting 
          })}
          onClick={onRepost}
          disabled={isReposting}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: isReposted ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            style={{ opacity: isReposting ? 0 : 1 }}
          >
            <Repeat2 size={18} />
          </motion.div>
          <span className={clsx("number-transition", { changing: isReposting })}>
            {repostCount}
          </span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Like" position="top">
        <motion.button
          className={clsx("engagement-btn like-btn", { 
            active: isLiked,
            liked: isLiked,
            'btn-loading': isLiking 
          })}
          onClick={onLike}
          disabled={isLiking}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            style={{ opacity: isLiking ? 0 : 1 }}
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          </motion.div>
          <span className={clsx("number-transition", { changing: isLiking })}>
            {likeCount}
          </span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Share" position="top">
        <motion.button
          className="engagement-btn"
          onClick={onShare}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Share size={18} />
        </motion.button>
      </Tooltip>
    </div>
  );
};