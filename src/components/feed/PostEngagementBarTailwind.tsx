import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react';
import clsx from 'clsx';
import type { Post } from '../../types/atproto';
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

export const PostEngagementBarTailwind: React.FC<PostEngagementBarProps> = ({
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
    <div className="twflex twitems-center twgap-1 tw-mt-1">
      <Tooltip content="Reply" position="top">
        <motion.button
          className="twflex twitems-center twgap-1.5 twpx-3 twpy-1.5 twrounded-full hover:twbg-bg-secondary twtransition-colors twtext-text-secondary hover:twtext-text-primary"
          onClick={onReply}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageCircle size={18} />
          <span className="twtext-sm">{post.replyCount || 0}</span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Repost" position="top">
        <motion.button
          className={clsx(
            "twflex twitems-center twgap-1.5 twpx-3 twpy-1.5 twrounded-full hover:twbg-bg-secondary twtransition-colors",
            isReposted 
              ? "twtext-success" 
              : "twtext-text-secondary hover:twtext-success",
            isReposting && "twopacity-50 twcursor-wait"
          )}
          onClick={onRepost}
          disabled={isReposting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isReposted ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className={isReposting ? "twopacity-0" : ""}
          >
            <Repeat2 size={18} />
          </motion.div>
          <span className={clsx("twtext-sm twtransition-all", isReposting && "twopacity-0")}>
            {repostCount}
          </span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Like" position="top">
        <motion.button
          className={clsx(
            "twflex twitems-center twgap-1.5 twpx-3 twpy-1.5 twrounded-full hover:twbg-bg-secondary twtransition-colors",
            isLiked 
              ? "twtext-error" 
              : "twtext-text-secondary hover:twtext-error",
            isLiking && "twopacity-50 twcursor-wait"
          )}
          onClick={onLike}
          disabled={isLiking}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className={isLiking ? "twopacity-0" : ""}
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          </motion.div>
          <span className={clsx("twtext-sm twtransition-all", isLiking && "twopacity-0")}>
            {likeCount}
          </span>
        </motion.button>
      </Tooltip>

      <Tooltip content="Share" position="top">
        <motion.button
          className="twflex twitems-center twgap-1.5 twpx-3 twpy-1.5 twrounded-full hover:twbg-bg-secondary twtransition-colors twtext-text-secondary hover:twtext-text-primary"
          onClick={onShare}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Share size={18} />
        </motion.button>
      </Tooltip>
    </div>
  );
};