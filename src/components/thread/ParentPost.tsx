import React from 'react'
import type { Post } from '@bsky/shared'
import { getPostText, formatPostTime } from '../../utils/post-helpers'

interface ParentPostProps {
  post: Post
  isRoot?: boolean
}

export const ParentPost: React.FC<ParentPostProps> = ({ post, isRoot = false }) => {
  const postText = getPostText(post)
  const postTime = formatPostTime(post)

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 relative ${
      isRoot ? 'border-blue-500/50' : ''
    }`}>
      <div className="flex items-start gap-3 mb-3">
        {post.author.avatar ? (
          <img 
            src={post.author.avatar} 
            alt={post.author.handle}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-semibold">
            {post.author.handle.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold truncate">
              {post.author.displayName || post.author.handle}
            </span>
            <span className="text-gray-400 text-sm">@{post.author.handle}</span>
          </div>
          <time className="text-gray-400 text-xs">
            {postTime}
          </time>
        </div>
        {post.author.displayName && (
          <div>
            <button className="p-1 rounded hover:bg-gray-700 transition-colors">
              <span className="text-gray-400">•••</span>
            </button>
          </div>
        )}
      </div>
      <p className="text-gray-100 leading-relaxed">{postText || <span className="text-gray-500">[No text content]</span>}</p>
      <div className="absolute bottom-0 left-1/2 w-0.5 h-4 bg-gray-600 transform translate-y-4"></div>
    </div>
  )
}