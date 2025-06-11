import React from 'react'
import { Link } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { 
  AppBskyEmbedImages, 
  AppBskyEmbedExternal, 
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia
} from '@atproto/api'

interface PostEmbedsProps {
  embed: any
  onViewThread?: (uri: string) => void
}

export const PostEmbeds: React.FC<PostEmbedsProps> = ({ embed, onViewThread }) => {
  if (!embed) return null

  // Handle different embed types based on $type
  const embedType = embed.$type

  // Images embed
  if (embedType === 'app.bsky.embed.images#view') {
    const imagesEmbed = embed as AppBskyEmbedImages.View
    const images = imagesEmbed.images || []
    
    return (
      <div className={`grid gap-0.5 mt-2 rounded-lg overflow-hidden ${
        images.length === 1 ? 'grid-cols-1' : 
        images.length === 2 ? 'grid-cols-2' : 
        images.length === 3 ? 'grid-cols-2' : 
        'grid-cols-2'
      }`}>
        {images.map((img, index) => (
          <div 
            key={index}
            className={`relative bg-gray-800 ${
              images.length === 3 && index === 0 ? 'row-span-2' : ''
            }`}
          >
            <img
              src={img.thumb}
              alt={img.alt || ''}
              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Open image viewer
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  // External link embed
  if (embedType === 'app.bsky.embed.external#view') {
    const externalEmbed = embed as AppBskyEmbedExternal.View
    const external = externalEmbed.external
    
    return (
      <a
        href={external.uri}
        target="_blank"
        rel="noopener noreferrer"
        className="flex mt-2 border border-gray-700 rounded-lg overflow-hidden hover:bg-gray-800/50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {external.thumb && (
          <div className="w-32 h-32 flex-shrink-0 bg-gray-800">
            <img
              src={external.thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-3">
          <h4 className="font-medium text-gray-100 line-clamp-1">
            {external.title}
          </h4>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
            {external.description}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-600 mt-2">
            <Link size={12} />
            <span>{new URL(external.uri).hostname}</span>
          </div>
        </div>
      </a>
    )
  }

  // Quote post embed
  if (embedType === 'app.bsky.embed.record#view') {
    const recordEmbed = embed as AppBskyEmbedRecord.View
    const record = recordEmbed.record
    
    // Check if it's a valid post record
    if (record.$type === 'app.bsky.embed.record#viewRecord') {
      const quotedPost = record as any
      const author = quotedPost.author
      const postRecord = quotedPost.value
      
      return (
        <div 
          className="mt-2 border border-gray-700 rounded-lg p-3 hover:bg-gray-800/30 cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (quotedPost.uri && onViewThread) {
              onViewThread(quotedPost.uri)
            }
          }}
        >
          {/* Mini header */}
          <div className="flex items-center gap-2 mb-2">
            <img 
              src={author?.avatar || '/default-avatar.png'} 
              alt={author?.handle || 'User'}
              className="w-5 h-5 rounded-full bg-gray-700"
            />
            <div className="flex items-baseline gap-1 text-sm">
              <span className="font-medium text-gray-100">
                {author?.displayName || author?.handle}
              </span>
              <span className="text-gray-500">
                @{author?.handle}
              </span>
              {quotedPost.indexedAt && (
                <>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500">
                    {formatDistanceToNow(new Date(quotedPost.indexedAt), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Quote content */}
          {postRecord?.text && (
            <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">
              {postRecord.text}
            </p>
          )}
          
          {/* Nested embeds in quote */}
          {quotedPost.embeds?.[0] && (
            <div className="mt-2">
              <PostEmbeds embed={quotedPost.embeds[0]} onViewThread={onViewThread} />
            </div>
          )}
        </div>
      )
    }
    
    // Handle deleted or blocked posts
    if (record.$type === 'app.bsky.embed.record#viewNotFound' || 
        record.$type === 'app.bsky.embed.record#viewBlocked') {
      return (
        <div className="mt-2 border border-gray-700 rounded-lg p-3 bg-gray-800/30">
          <p className="text-sm text-gray-500 italic">
            {record.$type === 'app.bsky.embed.record#viewBlocked' 
              ? 'Blocked post' 
              : 'Post not found'}
          </p>
        </div>
      )
    }
  }

  // Record with media (quote + images)
  if (embedType === 'app.bsky.embed.recordWithMedia#view') {
    const recordWithMedia = embed as AppBskyEmbedRecordWithMedia.View
    return (
      <>
        {recordWithMedia.media && (
          <PostEmbeds embed={recordWithMedia.media} onViewThread={onViewThread} />
        )}
        {recordWithMedia.record && (
          <PostEmbeds embed={recordWithMedia.record} onViewThread={onViewThread} />
        )}
      </>
    )
  }

  return null
}