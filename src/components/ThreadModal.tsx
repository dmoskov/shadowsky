import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X, Loader } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { debug } from '@bsky/shared'
import { ThreadViewer } from './ThreadViewer'
import type { AppBskyFeedDefs } from '@atproto/api'

interface ThreadModalProps {
  postUri: string
  onClose: () => void
}

type PostView = AppBskyFeedDefs.PostView

export function ThreadModal({ postUri, onClose }: ThreadModalProps) {
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
          )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}