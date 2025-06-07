import React from 'react'
import type { Post } from '../../types/atproto'
import { getPostText, formatPostTime } from '../../utils/post-helpers'

interface ParentPostProps {
  post: Post
  isRoot?: boolean
}

export const ParentPost: React.FC<ParentPostProps> = ({ post, isRoot = false }) => {
  const postText = getPostText(post)
  const postTime = formatPostTime(post)

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
            {postTime}
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
      <p className="parent-post-text">{postText || <span className="text-tertiary">[No text content]</span>}</p>
      <div className="thread-connector"></div>
    </div>
  )
}