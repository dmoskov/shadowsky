import React, { useEffect } from 'react'
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
    document.body.style.overflow = 'hidden'
    document.body.classList.add('thread-modal-open')
    
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
      document.body.classList.remove('thread-modal-open')
    }
  }, [onClose])

  const { data: threadData, isLoading, error } = useQuery({
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
    if (!threadData) return null
    
    let current = threadData
    while (current?.parent?.$type === 'app.bsky.feed.defs#threadViewPost') {
      current = current.parent
    }
    
    return current?.post?.uri || postUri
  }, [threadData, postUri])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden flex flex-col thread-modal-container">
        <div className="relative flex-1 overflow-y-auto skydeck-scrollbar" style={{ backgroundColor: 'var(--bsky-bg-primary)' }}>
          {/* Close button with higher z-index and explicit pointer events */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            style={{ color: 'var(--bsky-text-secondary)', pointerEvents: 'auto' }}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          
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
            />
          )}
          </div>
        </div>
      </div>
    </>
  )
}