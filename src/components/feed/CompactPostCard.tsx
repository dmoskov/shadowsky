import React from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Repeat2 } from 'lucide-react'
import clsx from 'clsx'
import type { Post } from '@bsky/shared/types/atproto'
import { getPostText, formatPostTime } from '../../utils/post-helpers'

interface CompactPostCardProps {
  post: Post
  isConsecutive?: boolean
  depth?: number
  onReply?: (post: Post) => void
  onClick?: () => void
}

export const CompactPostCard: React.FC<CompactPostCardProps> = ({ 
  post, 
  isConsecutive = false,
  depth = 0,
  onReply,
  onClick
}) => {
  const postText = getPostText(post)
  const postTime = formatPostTime(post)

  return (
    <motion.div
      className={clsx("compact-post-card", {
        "is-consecutive": isConsecutive,
        [`depth-${Math.min(depth, 5)}`]: depth > 0
      })}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      {!isConsecutive && (
        <div className="compact-author">
          <img 
            src={post.author.avatar || '/default-avatar.png'} 
            alt={post.author.handle}
            className="compact-avatar"
          />
          <div className="compact-author-info">
            <span className="compact-display-name">
              {post.author.displayName || post.author.handle}
            </span>
            <span className="compact-handle">@{post.author.handle}</span>
            <span className="compact-time">{postTime}</span>
          </div>
        </div>
      )}
      
      <div className={clsx("compact-content", {
        "with-indent": isConsecutive
      })}>
        <p className="compact-text">{postText}</p>
        
        <div className="compact-engagement">
          <button 
            className="compact-action"
            onClick={(e) => {
              e.stopPropagation()
              onReply?.(post)
            }}
          >
            <MessageCircle size={14} />
            {post.replyCount || 0}
          </button>
          
          <button className="compact-action">
            <Repeat2 size={14} />
            {post.repostCount || 0}
          </button>
          
          <button className="compact-action">
            <Heart size={14} />
            {post.likeCount || 0}
          </button>
        </div>
      </div>
    </motion.div>
  )
}