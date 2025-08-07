import React from 'react'
import { Heart, MessageCircle, Repeat2, Reply, Bookmark } from 'lucide-react'
import { AppBskyFeedDefs } from '@atproto/api'
import { proxifyBskyImage } from '../utils/image-proxy'

interface PostRendererProps {
  post: AppBskyFeedDefs.PostView
  onLike?: () => void
  onRepost?: () => void
  onReply?: () => void
  onBookmark?: () => void
  isBookmarked?: boolean
  compact?: boolean
}

export const PostRenderer: React.FC<PostRendererProps> = ({
  post,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  isBookmarked = false,
  compact = false
}) => {
  const record = post.record as any
  
  return (
    <div className={`post-renderer ${compact ? 'compact' : ''} ${record?.reply?.parent ? 'is-reply' : ''}`}
         style={{
           borderLeft: record?.reply?.parent ? '4px solid rgb(29, 155, 240)' : 'none',
           paddingLeft: record?.reply?.parent ? '12px' : '0'
         }}>
      {/* Show reply context if this post is a reply */}
      {record?.reply?.parent && (
        <div className="relative">
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" 
               style={{ 
                 backgroundColor: 'rgba(29, 155, 240, 0.1)',
                 border: '1px solid rgba(29, 155, 240, 0.2)'
               }}>
            <Reply size={16} style={{ color: 'rgb(29, 155, 240)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>
              This is a reply
            </span>
          </div>
        </div>
      )}
      
      <div className="post-content">
        <p className="post-text">{record?.text || ''}</p>
        
        {/* Render embedded images if any */}
        {post.embed && 'images' in post.embed && (post.embed as any).images && (
          <div className="post-images">
            {(post.embed as any).images.map((image: any, index: number) => (
              <img
                key={index}
                src={proxifyBskyImage(image.thumb)}
                alt={image.alt || ''}
                className="post-image"
              />
            ))}
          </div>
        )}
        
        {/* Render quoted post if any */}
        {post.embed && 'record' in post.embed && (
          <div className="mt-2 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--bsky-border-primary)' }}>
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs"
                 style={{ 
                   backgroundColor: 'var(--bsky-bg-tertiary)',
                   borderBottom: '1px solid var(--bsky-border-primary)',
                   color: 'var(--bsky-text-secondary)'
                 }}>
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div className="quote-author flex items-center gap-2 mb-2">
                <img
                  src={proxifyBskyImage((post.embed as any).record?.author?.avatar) || '/default-avatar.png'}
                  alt=""
                  className="quote-avatar w-5 h-5 rounded-full"
                />
                <span className="quote-author-name text-sm">
                  {(post.embed as any).record?.author?.displayName || (post.embed as any).record?.author?.handle}
                </span>
              </div>
              <p className="quote-text text-sm">{(post.embed as any).record?.value?.text || ''}</p>
            </div>
          </div>
        )}
      </div>
      
      {!compact && (
        <div className="post-actions">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReply?.()
            }}
            className="action-button"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.replyCount || 0}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRepost?.()
            }}
            className={`action-button ${post.viewer?.repost ? 'active repost' : ''}`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{post.repostCount || 0}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLike?.()
            }}
            className={`action-button ${post.viewer?.like ? 'active like' : ''}`}
          >
            <Heart className="w-4 h-4" fill={post.viewer?.like ? 'currentColor' : 'none'} />
            <span>{post.likeCount || 0}</span>
          </button>
          
          {onBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onBookmark()
              }}
              className={`action-button ${isBookmarked ? 'active bookmark' : ''}`}
            >
              <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}