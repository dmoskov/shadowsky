import React, { useState, useRef, useEffect } from 'react'
import { Bookmark, Search, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { bookmarkService } from '../services/bookmark-service'
import { PostActionBar } from './PostActionBar'
import { ThreadModal } from './ThreadModal'
import { proxifyBskyImage, proxifyBskyVideo } from '../utils/image-proxy'
import { VideoPlayer } from './VideoPlayer'
import { ImageGallery } from './ImageGallery'
import type { AppBskyFeedDefs } from '@atproto/api'

interface BookmarksColumnProps {
  isFocused?: boolean
  onClose?: () => void
}

export const BookmarksColumn: React.FC<BookmarksColumnProps> = ({ isFocused = false, onClose }) => {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [selectedPost, setSelectedPost] = useState<AppBskyFeedDefs.PostView | null>(null)
  const [showThread, setShowThread] = useState(false)
  const [galleryImages, setGalleryImages] = useState<Array<{ thumb: string; fullsize: string; alt?: string }> | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Initialize bookmark service
  useEffect(() => {
    bookmarkService.init()
  }, [])

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ['bookmarks', searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        return await bookmarkService.searchBookmarks(searchQuery)
      }
      return await bookmarkService.getBookmarkedPosts()
    },
    staleTime: 30000,
  })

  const { data: bookmarkCount } = useQuery({
    queryKey: ['bookmarkCount'],
    queryFn: () => bookmarkService.getBookmarkCount(),
    staleTime: 30000,
  })

  const handleUnbookmark = async (postUri: string) => {
    await bookmarkService.removeBookmark(postUri)
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    queryClient.invalidateQueries({ queryKey: ['bookmarkCount'] })
  }

  const handlePostClick = (post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post)
    setShowThread(true)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isFocused || !bookmarks) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setFocusedIndex(prev => {
          const newIndex = prev === -1 ? 0 : Math.min(prev + 1, bookmarks.length - 1)
          return newIndex
        })
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setFocusedIndex(prev => {
          const newIndex = prev === -1 ? 0 : Math.max(prev - 1, 0)
          return newIndex
        })
      } else if (e.key === 'Enter' && focusedIndex >= 0 && bookmarks[focusedIndex]?.post) {
        e.preventDefault()
        handlePostClick(bookmarks[focusedIndex].post!)
      } else if (e.key === 'Delete' && focusedIndex >= 0 && bookmarks[focusedIndex]) {
        e.preventDefault()
        handleUnbookmark(bookmarks[focusedIndex].postUri)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, bookmarks, focusedIndex])

  // Focus container when column is focused
  useEffect(() => {
    if (containerRef.current && isFocused) {
      containerRef.current.focus()
    }
  }, [isFocused])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && bookmarks?.[focusedIndex]) {
      const itemEl = itemRefs.current.get(bookmarks[focusedIndex].postUri)
      if (itemEl) {
        itemEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }, [focusedIndex, bookmarks])

  const renderEmbed = (embed: any) => {
    if (!embed) return null

    if (embed.$type === 'app.bsky.embed.images#view') {
      const handleImageClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        const images = embed.images.map((img: any) => ({
          thumb: proxifyBskyImage(img.thumb),
          fullsize: proxifyBskyImage(img.fullsize),
          alt: img.alt
        }))
        setGalleryImages(images)
        setGalleryIndex(index)
      }

      return (
        <div className={`mt-2 grid gap-1 ${embed.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {embed.images.map((img: any, idx: number) => (
            <img
              key={idx}
              src={proxifyBskyImage(img.thumb)}
              alt={img.alt || ''}
              className="rounded-lg w-full h-auto cursor-pointer hover:opacity-95"
              onClick={(e) => handleImageClick(e, idx)}
            />
          ))}
        </div>
      )
    }

    if (embed.$type === 'app.bsky.embed.video#view') {
      return (
        <div className="mt-2 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist) || ''}
            thumbnail={embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined}
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="h-full flex flex-col" style={{ outline: 'none' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="px-4 py-3 flex items-center justify-between group">
          <div className="flex items-center gap-2">
            <Bookmark size={20} style={{ color: 'var(--bsky-primary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              Bookmarks
            </h2>
            {bookmarkCount !== undefined && (
              <span className="text-sm px-2 py-0.5 rounded-full" style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)', 
                color: 'var(--bsky-text-secondary)' 
              }}>
                {bookmarkCount}
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--bsky-text-secondary)' }}
              aria-label="Close column"
            >
              <X size={18} />
            </button>
          )}
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2" 
                   style={{ color: 'var(--bsky-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full text-sm"
              style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)', 
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && (!bookmarks || bookmarks.length === 0) && (
          <div className="text-center p-8">
            <Bookmark size={48} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
            <p style={{ color: 'var(--bsky-text-primary)' }}>
              {searchQuery ? 'No bookmarks found' : 'No bookmarks yet'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
              Save posts to view them here
            </p>
          </div>
        )}

        {bookmarks?.map((bookmark, index) => {
          const post = bookmark.post
          if (!post) return null

          const isFocused = focusedIndex === index

          return (
            <div
              key={bookmark.postUri}
              ref={(el) => {
                if (el) itemRefs.current.set(bookmark.postUri, el)
              }}
              className={`group border-b cursor-pointer hover:bg-opacity-5 hover:bg-blue-500 transition-colors ${
                isFocused ? 'bg-opacity-10 bg-blue-500 border-l-4 border-l-blue-500 pl-3' : ''
              }`}
              style={{ borderColor: 'var(--bsky-border-primary)' }}
              onClick={() => handlePostClick(post)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {post.author?.avatar && (
                    <img
                      src={proxifyBskyImage(post.author.avatar)}
                      alt={post.author.handle || ''}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                        {post.author?.displayName || post.author?.handle || 'Unknown'}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                        @{post.author?.handle || 'unknown'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnbookmark(bookmark.postUri)
                        }}
                        className="ml-auto p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors opacity-50 group-hover:opacity-100"
                        style={{ color: '#ffad1f' }}
                        title="Remove bookmark"
                      >
                        <Bookmark size={16} fill="currentColor" />
                      </button>
                    </div>
                    
                    <div className="mt-2 whitespace-pre-wrap break-words" style={{ color: 'var(--bsky-text-primary)' }}>
                      {(post.record as any)?.text || ''}
                    </div>
                    
                    {post.embed && renderEmbed(post.embed)}
                    
                    <PostActionBar
                      post={post}
                      onReply={() => {}}
                      onLike={() => {}}
                      onRepost={() => {}}
                      showCounts={true}
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Thread Modal */}
      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false)
            setSelectedPost(null)
          }}
        />
      )}

      {/* Image Gallery */}
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => {
            setGalleryImages(null)
            setGalleryIndex(0)
          }}
        />
      )}
    </div>
  )
}