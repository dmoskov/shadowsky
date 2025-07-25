import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { formatPostTime } from '../../utils/post-helpers';
import type { Post } from '@bsky/shared';

interface PostHeaderProps {
  post: Post;
  onMenuToggle: () => void;
}

export const PostHeader: React.FC<PostHeaderProps> = ({ post, onMenuToggle }) => {
  return (
    <div className="post-header">
      <a 
        href={`/profile/${post.author.handle}`}
        className="post-author"
        onClick={(e) => e.preventDefault()}
      >
        {post.author.avatar ? (
          <img 
            src={post.author.avatar} 
            alt={post.author.handle}
            className="avatar-image"
            loading="lazy"
          />
        ) : (
          <div className="avatar-placeholder">
            {post.author.handle.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="author-info">
          <span className="author-name">
            {post.author.displayName || post.author.handle}
          </span>
          {post.author.displayName && (
            <span className="author-handle text-secondary">
              @{post.author.handle}
            </span>
          )}
        </div>
        <time className="post-time text-tertiary text-caption">
          {formatPostTime(post)}
        </time>
      </a>

      <div className="post-actions">
        <motion.button
          className="btn btn-icon btn-ghost"
          onClick={onMenuToggle}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <MoreHorizontal size={18} />
        </motion.button>
      </div>
    </div>
  );
};