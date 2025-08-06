import React, { memo } from 'react'
import { Heart, MessageCircle, Repeat2, Bookmark, Share } from 'lucide-react'
import { useBookmarks } from '../hooks/useBookmarks'
import type { AppBskyFeedDefs } from '@atproto/api'
import '../styles/post-action-bar.css'

interface PostActionBarProps {
  post: AppBskyFeedDefs.PostView
  onReply?: () => void
  onRepost?: () => void
  onLike?: () => void
  onShare?: () => void
  showCounts?: boolean
  size?: 'small' | 'medium' | 'large'
}

export const PostActionBar: React.FC<PostActionBarProps> = memo(({
  post,
  onReply,
  onRepost,
  onLike,
  onShare,
  showCounts = true,
  size = 'medium'
}) => {
  const { isBookmarked, toggleBookmark } = useBookmarks()
  
  const iconSize = size === 'small' ? 14 : size === 'medium' ? 16 : 18
  const isLiked = !!post.viewer?.like
  const isReposted = !!post.viewer?.repost
  const bookmarked = isBookmarked(post.uri)
  
  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    action?.()
  }
  
  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleBookmark(post)
  }

  return (
    <div className={`post-action-bar ${size}`} onClick={(e) => e.stopPropagation()} data-post-uri={post.uri}>
      {/* Reply */}
      <button
        className="action-item reply"
        onClick={(e) => handleAction(e, onReply)}
        aria-label="Reply"
      >
        <MessageCircle size={iconSize} />
        {showCounts && <span className="action-count">{post.replyCount || 0}</span>}
      </button>

      {/* Repost */}
      <button
        className={`action-item repost ${isReposted ? 'active' : ''}`}
        onClick={(e) => handleAction(e, onRepost)}
        aria-label="Repost"
      >
        <Repeat2 size={iconSize} />
        {showCounts && <span className="action-count">{post.repostCount || 0}</span>}
      </button>

      {/* Like */}
      <button
        className={`action-item like ${isLiked ? 'active' : ''}`}
        onClick={(e) => handleAction(e, onLike)}
        aria-label="Like"
      >
        <Heart size={iconSize} fill={isLiked ? 'currentColor' : 'none'} />
        {showCounts && <span className="action-count">{post.likeCount || 0}</span>}
      </button>

      {/* Bookmark */}
      <button
        className={`action-item bookmark ${bookmarked ? 'active' : ''}`}
        onClick={handleBookmark}
        aria-label="Bookmark"
      >
        <Bookmark 
          size={iconSize} 
          fill={bookmarked ? 'currentColor' : 'none'}
          className={`bookmark-icon ${bookmarked ? 'filling' : ''}`}
        />
      </button>

      {/* Share */}
      {onShare && (
        <button
          className="action-item share"
          onClick={(e) => handleAction(e, onShare)}
          aria-label="Share"
        >
          <Share size={iconSize} />
        </button>
      )}
    </div>
  )
})