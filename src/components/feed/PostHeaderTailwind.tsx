import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { formatPostTime } from '../../utils/post-helpers';
import { getBskyProfileUrl } from '../../utils/url-helpers';
import type { Post } from '@bsky/shared';

interface PostHeaderProps {
  post: Post;
  onMenuToggle: () => void;
}

export const PostHeaderTailwind: React.FC<PostHeaderProps> = ({ post, onMenuToggle }) => {
  return (
    <div className="twflex twitems-start twgap-3 twmb-2">
      <a 
        href={getBskyProfileUrl(post.author.handle)}
        className="twflex twitems-start twgap-3 twflex-1 twno-underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* Avatar */}
        {post.author.avatar ? (
          <img 
            src={post.author.avatar} 
            alt={post.author.handle}
            className="tww-10 twh-10 twrounded-full twobject-cover twflex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="tww-10 twh-10 twrounded-full twbg-bg-tertiary twflex twitems-center twjustify-center twflex-shrink-0 twfont-semibold twtext-xs twtext-text-secondary">
            {post.author.handle.charAt(0).toUpperCase()}
          </div>
        )}
        
        {/* Author info */}
        <div className="twflex-1 twmin-w-0">
          <div className="twflex twitems-baseline twgap-1 twflex-wrap">
            <span className="twfont-semibold twtext-text-primary twtruncate">
              {post.author.displayName || post.author.handle}
            </span>
            {post.author.displayName && (
              <span className="twtext-sm twtext-text-secondary">
                @{post.author.handle}
              </span>
            )}
            <span className="twtext-text-secondary">·</span>
            <time className="twtext-sm twtext-text-secondary">
              {formatPostTime(post)}
            </time>
          </div>
        </div>
      </a>

      {/* Menu button */}
      <div className="twflex-shrink-0">
        <motion.button
          className="twp-1.5 twrounded-full hover:twbg-bg-secondary twtransition-colors"
          onClick={onMenuToggle}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <MoreHorizontal size={18} className="twtext-text-secondary" />
        </motion.button>
      </div>
    </div>
  );
};