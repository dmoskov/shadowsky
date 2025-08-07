import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X, Loader } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { debug } from '@bsky/shared'
import { ThreadViewer } from './ThreadViewer'
import { BaseComposer } from './BaseComposer'
import { VideoUploadService } from '../services/atproto/video-upload'
import type { AppBskyFeedDefs } from '@atproto/api'

interface ThreadModalProps {
  postUri: string
  onClose: () => void
  openToReply?: boolean  // When true, opens with the post ready to reply
}

type PostView = AppBskyFeedDefs.PostView

export function ThreadModal({ postUri, onClose, openToReply = false }: ThreadModalProps) {
  const { agent } = useAuth()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    // Store original overflow value
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('thread-modal-open')
    
    return () => {
      window.removeEventListener('keydown', handleEsc)
      // Restore original overflow value
      document.body.style.overflow = originalOverflow
      document.body.classList.remove('thread-modal-open')
    }
  }, [onClose])

  const { data: threadData, isLoading, error, refetch } = useQuery({
    queryKey: ['thread', postUri],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.getPostThread({ uri: postUri, depth: 10 })
      debug.log('Thread response:', response)
      return response.data.thread
    },
    enabled: !!agent && !!postUri
  })

  // Extract all posts from the thread structure
  const posts = React.useMemo(() => {
    if (!threadData) return []
    
    const allPosts: PostView[] = []
    const processThread = (thread: any) => {
      if (!thread) return
      
      if (thread.$type === 'app.bsky.feed.defs#threadViewPost' && thread.post) {
        allPosts.push(thread.post)
        
        // Process parent if exists
        if (thread.parent) {
          processThread(thread.parent)
        }
        
        // Process replies
        if (thread.replies && Array.isArray(thread.replies)) {
          thread.replies.forEach(processThread)
        }
      }
    }
    
    processThread(threadData)
    return allPosts
  }, [threadData])

  // Find the root post
  const rootPost = React.useMemo(() => {
    if (!threadData) return undefined
    
    let current = threadData
    while (current?.$type === 'app.bsky.feed.defs#threadViewPost') {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost
      if (threadViewPost.parent?.$type === 'app.bsky.feed.defs#threadViewPost') {
        current = threadViewPost.parent
      } else {
        break
      }
    }
    
    if (current?.$type === 'app.bsky.feed.defs#threadViewPost') {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost
      return threadViewPost.post?.uri || postUri
    }
    return postUri
  }, [threadData, postUri])

  // Find the main post that was clicked on to open this thread
  const mainPost = React.useMemo(() => {
    if (!posts.length) return null
    
    // Find the post that matches the postUri (the one clicked to open the modal)
    const targetPost = posts.find(p => p.uri === postUri)
    
    // If we found it, return it. Otherwise, return the first post
    return targetPost || posts[0]
  }, [posts, postUri])

  const handleReply = async (text: string, media?: any[]) => {
    if (!agent || !mainPost || !rootPost) throw new Error('Missing required context')
    
    const rootCid = posts.find(p => p.uri === rootPost)?.cid || mainPost.cid
    
    // Upload media if present
    let embed = undefined
    if (media && media.length > 0) {
      const hasVideo = media.some(m => m.type === 'video')
      
      if (hasVideo) {
        // Handle video upload
        const videoFile = media.find(m => m.type === 'video')
        if (videoFile) {
          // Convert File to Uint8Array
          const arrayBuffer = await videoFile.file.arrayBuffer()
          const videoData = new Uint8Array(arrayBuffer)
          
          const uploadService = new VideoUploadService(agent)
          const videoBlob = await uploadService.uploadVideo(
            videoData,
            videoFile.file.type || 'video/mp4'
          )
          
          embed = {
            $type: 'app.bsky.embed.video',
            video: videoBlob.blob,
            aspectRatio: videoBlob.aspectRatio
          }
        }
      } else {
        // Handle image uploads
        const images = await Promise.all(
          media.filter(m => m.type === 'image').map(async (img) => {
            const response = await agent.uploadBlob(img.file, { encoding: 'image/jpeg' })
            return {
              alt: img.alt || '',
              image: response.data.blob,
              aspectRatio: undefined // Let Bluesky determine this
            }
          })
        )
        
        if (images.length > 0) {
          embed = {
            $type: 'app.bsky.embed.images',
            images
          }
        }
      }
    }
    
    const record = {
      text: text.trim(),
      reply: {
        root: { uri: rootPost, cid: rootCid },
        parent: { uri: mainPost.uri, cid: mainPost.cid }
      },
      embed,
      createdAt: new Date().toISOString()
    }
    
    await agent.post(record)
    refetch() // Refresh the thread to show the new reply
  }

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl shadow-xl z-[101] thread-modal-container flex flex-col" style={{ backgroundColor: 'var(--bsky-bg-primary)' }}>
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ 
          backgroundColor: 'var(--bsky-bg-primary)', 
          borderColor: 'var(--bsky-border-primary)' 
        }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>Thread</h2>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            style={{ color: 'var(--bsky-text-secondary)' }}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto skydeck-scrollbar" style={{ minHeight: 0 }}>
          <div className="p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="animate-spin" size={32} style={{ color: 'var(--bsky-primary)' }} />
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <p style={{ color: 'var(--bsky-text-secondary)' }}>Failed to load thread</p>
            </div>
          )}
          
          {posts.length > 0 && (
            <>
              
              <ThreadViewer
                posts={posts}
                rootUri={rootPost}
                highlightUri={postUri}
                showUnreadIndicators={false}
                className="max-w-full"
                onReplySuccess={() => {
                  // Refresh the thread to show the new reply
                  refetch()
                }}
              />
            </>
          )}
          </div>
        </div>
        
        {/* Fixed composer at the bottom - only show when explicitly replying */}
        {posts.length > 0 && mainPost && openToReply && (
          <div className="flex-shrink-0 border-t p-4" style={{ 
            backgroundColor: 'var(--bsky-bg-primary)', 
            borderColor: 'var(--bsky-border-primary)' 
          }}>
            <BaseComposer
              onSubmit={handleReply}
              placeholder={`Reply to @${mainPost.author.handle}...`}
              autoFocus={openToReply}
              replyTo={{
                uri: mainPost.uri,
                cid: mainPost.cid,
                author: {
                  handle: mainPost.author.handle,
                  displayName: mainPost.author.displayName
                }
              }}
              features={{
                media: true,
                emoji: true,
                giphy: false, // Can enable if needed
                altTextGeneration: true,
                shortcuts: true
              }}
              layout="full"
              showCharCount={true}
              submitLabel="Reply"
            />
          </div>
        )}
      </div>
    </>,
    document.body
  )
}