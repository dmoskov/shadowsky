import React, { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ComposeModal } from '../modals/ComposeModal'
import { ThreadNavigation } from './ThreadNavigation'
import { ThreadViewHeader } from './ThreadViewHeader'
import { ThreadViewModes } from './ThreadViewModes'
import { ThreadPostListBluesky } from './ThreadPostListBluesky'
import { useThreadData } from '../../hooks/useThreadData'

import type { Post } from '@bsky/shared'

interface ThreadViewProps {
  postUri: string
  onBack: () => void
}

export const ThreadView: React.FC<ThreadViewProps> = ({ postUri, onBack }) => {
  console.log('ThreadView rendered with postUri:', postUri);
  const navigate = useNavigate()
  const [replyTo, setReplyTo] = useState<{ post: Post; root?: Post } | undefined>()
  const [isReaderMode, setIsReaderMode] = useState(false)
  const [isCompactMode, setIsCompactMode] = useState(false)
  const [currentPostUri, setCurrentPostUri] = useState<string | undefined>()
  // const [showMap, setShowMap] = useState(false)
  // const [mapExpanded, setMapExpanded] = useState(false)
  const threadContainerRef = useRef<HTMLDivElement>(null)
  
  // Fetch the full thread context (root thread)
  const { thread, isLoading, error } = useThreadData({ postUri, fetchRoot: true })
  
  // Remember the originally clicked post URI to highlight it
  const targetPostUri = postUri
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <ThreadViewHeader
          onBack={onBack}
          isReaderMode={isReaderMode}
          isCompactMode={isCompactMode}
          onToggleReaderMode={() => setIsReaderMode(!isReaderMode)}
          onToggleCompactMode={() => setIsCompactMode(!isCompactMode)}
        />
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
          <p className="text-gray-400">Loading thread...</p>
        </div>
      </div>
    )
  }
  
  if (error || !thread) {
    return (
      <div className="min-h-screen bg-gray-900">
        <ThreadViewHeader
          onBack={onBack}
          isReaderMode={isReaderMode}
          isCompactMode={isCompactMode}
          onToggleReaderMode={() => setIsReaderMode(!isReaderMode)}
          onToggleCompactMode={() => setIsCompactMode(!isCompactMode)}
        />
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-red-400 mb-4">
            {error instanceof Error ? error.message : 'Failed to load thread'}
          </p>
          <button onClick={onBack} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            Go Back
          </button>
        </div>
      </div>
    )
  }
  
  const handleReply = (post: Post) => {
    setReplyTo({
      post,
      root: thread.post
    })
  }
  
  const handleViewThread = (uri: string) => {
    console.log('ThreadView handleViewThread called with:', uri);
    const newPath = `/thread/${encodeURIComponent(uri)}`;
    console.log('Navigating from:', window.location.pathname);
    console.log('Navigating to:', newPath);
    // Navigate to the new thread using React Router
    navigate(newPath);
  }
  
  const handleThreadNavigate = (uri: string) => {
    // Find the post element and scroll to it
    const postElement = threadContainerRef.current?.querySelector(`[data-post-uri="${uri}"]`)
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCurrentPostUri(uri)
      // Highlight the post briefly
      postElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50')
      setTimeout(() => postElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50'), 2000)
    }
  }
  
  // const handleMapNavigate = (uri: string) => {
  //   // Find the post element and scroll to it
  //   const postElement = threadContainerRef.current?.querySelector(`[data-post-uri="${uri}"]`)
  //   if (postElement) {
  //     postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  //     setCurrentPostUri(uri)
  //     // Highlight the post briefly
  //     postElement.classList.add('highlighted')
  //     setTimeout(() => postElement.classList.remove('highlighted'), 2000)
  //   }
  // }
  
  // Update current post on scroll
  // useEffect(() => {
  //   if (!showMap || !threadContainerRef.current) return
    
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       entries.forEach((entry) => {
  //         if (entry.isIntersecting) {
  //           const uri = entry.target.getAttribute('data-post-uri')
  //           if (uri) setCurrentPostUri(uri)
  //         }
  //       })
  //     },
  //     { threshold: 0.5 }
  //   )
    
  //   const posts = threadContainerRef.current.querySelectorAll('[data-post-uri]')
  //   posts.forEach(post => observer.observe(post))
    
  //   return () => observer.disconnect()
  // }, [showMap])
  
  return (
    <>
      <div className={clsx(
        "min-h-screen bg-gray-900",
        isReaderMode && "max-w-3xl mx-auto px-4"
      )} ref={threadContainerRef}>
        <ThreadViewHeader
          onBack={onBack}
          isReaderMode={isReaderMode}
          isCompactMode={isCompactMode}
          onToggleReaderMode={() => setIsReaderMode(!isReaderMode)}
          onToggleCompactMode={() => setIsCompactMode(!isCompactMode)}
        />
        
        <ThreadPostListBluesky
          thread={thread}
          onReply={handleReply}
          onViewThread={handleViewThread}
          isCompactMode={isCompactMode}
          currentPostUri={currentPostUri}
          targetPostUri={targetPostUri}  // Pass the originally clicked post
        />
      </div>
      
      {/* Thread Reader Mode Toggle (floating) */}
      <ThreadViewModes
        isReaderMode={isReaderMode}
        onToggleReaderMode={() => setIsReaderMode(true)}
      />
      
      {/* Reply Modal */}
      <ComposeModal 
        isOpen={!!replyTo}
        onClose={() => setReplyTo(undefined)}
        replyTo={replyTo}
      />
      
      {/* Thread Navigation */}
      {thread && !isReaderMode && (
        <ThreadNavigation
          thread={thread}
          currentPostUri={currentPostUri}
          onNavigate={handleThreadNavigate}
        />
      )}
      
      {/* Thread Overview Map */}
      {/* {THREAD_MAP_ENABLED && showMap && thread && (
        <ThreadOverviewMap
          thread={thread}
          currentPostUri={currentPostUri}
          onNavigate={handleMapNavigate}
          isExpanded={mapExpanded}
          onToggleExpand={() => setMapExpanded(!mapExpanded)}
          onClose={() => setShowMap(false)}
        />
      )} */}
    </>
  )
}