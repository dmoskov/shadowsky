import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, Home, Search, ChevronRight, ChevronLeft } from 'lucide-react'
import { ThreadBranchDiagram } from './ThreadBranchDiagramCompact'
import type { ThreadViewPost } from '../../services/atproto/thread'

interface ThreadNavigationProps {
  thread: ThreadViewPost
  currentPostUri?: string
  onNavigate: (uri: string) => void
}

export const ThreadNavigation: React.FC<ThreadNavigationProps> = ({
  thread,
  currentPostUri,
  onNavigate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      switch(e.key.toLowerCase()) {
        case 'j': // Next post
          navigateNext()
          break
        case 'k': // Previous post
          navigatePrevious()
          break
        case 'h': // Go to thread root
          onNavigate(thread.post.uri)
          break
        case 'n': // Next branch
          navigateNextBranch()
          break
        case 'p': // Previous branch
          navigatePreviousBranch()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPostUri, thread])

  const getAllPosts = (): string[] => {
    const posts: string[] = []
    
    const traverse = (node: ThreadViewPost) => {
      posts.push(node.post.uri)
      if (node.replies) {
        node.replies.forEach(reply => {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            traverse(reply as ThreadViewPost)
          }
        })
      }
    }
    
    // Add ancestors if any
    let current = thread
    while (current.parent && current.parent.$type === 'app.bsky.feed.defs#threadViewPost') {
      posts.unshift((current.parent as ThreadViewPost).post.uri)
      current = current.parent as ThreadViewPost
    }
    
    traverse(thread)
    return posts
  }

  const navigateNext = () => {
    const posts = getAllPosts()
    const currentIndex = posts.indexOf(currentPostUri || thread.post.uri)
    if (currentIndex < posts.length - 1) {
      onNavigate(posts[currentIndex + 1])
    }
  }

  const navigatePrevious = () => {
    const posts = getAllPosts()
    const currentIndex = posts.indexOf(currentPostUri || thread.post.uri)
    if (currentIndex > 0) {
      onNavigate(posts[currentIndex - 1])
    }
  }

  const navigateNextBranch = () => {
    // Find next post with multiple replies
    const posts = getAllPosts()
    const currentIndex = posts.indexOf(currentPostUri || thread.post.uri)
    
    for (let i = currentIndex + 1; i < posts.length; i++) {
      // This is simplified - in real implementation, check if post has multiple replies
      onNavigate(posts[i])
      break
    }
  }

  const navigatePreviousBranch = () => {
    const posts = getAllPosts()
    const currentIndex = posts.indexOf(currentPostUri || thread.post.uri)
    
    for (let i = currentIndex - 1; i >= 0; i--) {
      onNavigate(posts[i])
      break
    }
  }


  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-20">
      {/* Collapse/Expand Toggle */}
      <motion.button 
        className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 bg-gray-800 hover:bg-gray-700 rounded-l-lg transition-colors shadow-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
        whileTap={{ scale: 0.95 }}
        title={isCollapsed ? "Expand thread navigation" : "Collapse thread navigation"}
      >
        {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </motion.button>

      {/* Navigation Panel */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            className="bg-gray-900 border-l border-gray-800 shadow-xl overflow-hidden"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-semibold mb-2">Thread Navigation</h3>
              <div className="flex gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-gray-800 rounded">J/K</span>
                <span className="px-2 py-1 bg-gray-800 rounded">H: Home</span>
              </div>
            </div>

            <div className="flex justify-center gap-2 p-4">
              <button 
                onClick={navigatePrevious}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Previous post (K)"
              >
                <ChevronUp size={16} />
              </button>
              
              <button 
                onClick={() => onNavigate(thread.post.uri)}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Go to main post (H)"
              >
                <Home size={16} />
              </button>
              
              <button 
                onClick={navigateNext}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Next post (J)"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto">
              <ThreadBranchDiagram 
                thread={thread}
                currentPostUri={currentPostUri}
                onNavigate={onNavigate}
              />
            </div>

            <button className="w-full p-3 border-t border-gray-800 hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm text-gray-400">
              <Search size={14} />
              <span>Search in thread</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}