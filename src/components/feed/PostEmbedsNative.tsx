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
        className="flex mt-3 border border-gray-700 rounded-xl overflow-hidden hover:bg-gray-800/20 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {external.thumb && (
          <div className="w-[120px] flex-shrink-0 bg-gray-800">
            <img
              src={external.thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-3">
          <div className="flex items-start gap-1.5 text-[13px] text-gray-500 mb-1">
            <Link size={12} className="mt-0.5 flex-shrink-0" />
            <span className="truncate">{new URL(external.uri).hostname}</span>
          </div>
          <h4 className="font-semibold text-[15px] text-gray-100 line-clamp-2 leading-tight">
            {external.title}
          </h4>
          {external.description && (
            <p className="text-[13px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
              {external.description}
            </p>
          )}
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
          className="mt-2 border border-gray-700 rounded-lg overflow-hidden cursor-pointer transition-colors hover:bg-gray-800/30"
          onClick={(e) => {
            e.stopPropagation()
            if (quotedPost.uri && onViewThread) {
              onViewThread(quotedPost.uri)
            }
          }}
        >
          <div className="p-3">
            {/* Mini header */}
            <div className="flex items-center gap-2.5 mb-2">
              <img 
                src={author?.avatar || '/default-avatar.png'} 
                alt={author?.handle || 'User'}
                className="w-5 h-5 rounded-full bg-gray-700 object-cover"
              />
              <div className="flex items-baseline gap-1 text-[13px] min-w-0">
                <span className="font-semibold text-gray-100 truncate max-w-[150px]">
                  {author?.displayName || author?.handle}
                </span>
                <span className="text-gray-500 truncate">
                  @{author?.handle}
                </span>
                {quotedPost.indexedAt && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(quotedPost.indexedAt), { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
            </div>
          
            {/* Quote content */}
            {postRecord?.text && (
              <p className="text-[14px] text-gray-200 whitespace-pre-wrap break-words leading-[1.4]">
                {postRecord.text}
              </p>
            )}
          </div>
          
          {/* Nested embeds in quote - images, links etc */}
          {quotedPost.embeds?.[0] && (
            <div className="border-t border-gray-700">
              <QuoteEmbeds embed={quotedPost.embeds[0]} />
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

// Simplified embeds for quotes - no click handlers, smaller sizing
const QuoteEmbeds: React.FC<{ embed: any }> = ({ embed }) => {
  if (!embed) return null
  
  const embedType = embed.$type
  
  // Images in quotes
  if (embedType === 'app.bsky.embed.images#view') {
    const imagesEmbed = embed as AppBskyEmbedImages.View
    const images = imagesEmbed.images || []
    
    if (images.length === 1) {
      return (
        <div className="relative aspect-video bg-gray-800">
          <img
            src={images[0].thumb}
            alt={images[0].alt || ''}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )
    }
    
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {images.slice(0, 4).map((img, index) => (
          <div key={index} className="relative aspect-video bg-gray-800">
            <img
              src={img.thumb}
              alt={img.alt || ''}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    )
  }
  
  // External links in quotes
  if (embedType === 'app.bsky.embed.external#view') {
    const externalEmbed = embed as AppBskyEmbedExternal.View
    const external = externalEmbed.external
    
    return (
      <div className="flex">
        {external.thumb && (
          <div className="w-[100px] flex-shrink-0 bg-gray-800">
            <img
              src={external.thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-3">
          <div className="flex items-center gap-1 text-[12px] text-gray-500 mb-1">
            <Link size={10} />
            <span className="truncate">{new URL(external.uri).hostname}</span>
          </div>
          <h4 className="text-[13px] font-medium text-gray-100 line-clamp-1">
            {external.title}
          </h4>
          {external.description && (
            <p className="text-[12px] text-gray-400 line-clamp-2 mt-0.5">
              {external.description}
            </p>
          )}
        </div>
      </div>
    )
  }
  
  return null
}