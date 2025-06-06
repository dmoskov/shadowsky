import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Post } from '../types/atproto'

interface ParentPostProps {
  post: Post
  isRoot?: boolean
}

export const ParentPost: React.FC<ParentPostProps> = ({ post, isRoot = false }) => {
  const getPostText = (): string => {
    // Standard PostView structure: text is in post.record.text
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      return (post.record as { text?: string }).text || ''
    }
    
    // Fallback for edge cases
    if (post.record && typeof post.record === 'object') {
      const record = post.record as any
      // Check if record has $type indicating it's a post
      if (record.$type === 'app.bsky.feed.post' && record.text) {
        return record.text
      }
    }
    
    return ''
  }

  const getPostDate = (): string => {
    // Check record.createdAt first (standard location)
    if (post.record && typeof post.record === 'object' && 'createdAt' in post.record) {
      return (post.record as { createdAt?: string }).createdAt || post.indexedAt
    }
    // Fall back to indexedAt
    return post.indexedAt || new Date().toISOString()
  }

  return (
    <div className={`parent-post ${isRoot ? 'is-root' : ''}`}>
      <div className="parent-post-header">
        {post.author.avatar ? (
          <img 
            src={post.author.avatar} 
            alt={post.author.handle}
            className="parent-avatar"
          />
        ) : (
          <div className="parent-avatar-placeholder">
            {post.author.handle.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="parent-author-info">
          <div className="parent-author-name">
            <span className="author-display-name">
              {post.author.displayName || post.author.handle}
            </span>
            <span className="text-tertiary">@{post.author.handle}</span>
          </div>
          <time className="text-tertiary text-caption">
            {formatDistanceToNow(new Date(getPostDate()), { addSuffix: true })}
          </time>
        </div>
        {post.author.displayName && (
          <div className="post-actions">
            <button className="btn btn-icon btn-ghost btn-sm">
              <span>•••</span>
            </button>
          </div>
        )}
      </div>
      <p className="parent-post-text">{getPostText() || <span className="text-tertiary">[No text content]</span>}</p>
      <div className="thread-connector"></div>
    </div>
  )
}