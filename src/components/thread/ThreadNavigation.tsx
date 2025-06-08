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

  // Get key participants
  const getKeyParticipants = () => {
    const participants = new Map<string, { handle: string, count: number, displayName?: string }>()
    
    const traverse = (node: ThreadViewPost) => {
      if (!node || !node.post || !node.post.author) return
      
      const author = node.post.author
      const handle = author.handle
      const current = participants.get(handle) || { 
        handle, 
        count: 0,
        displayName: author.displayName
      }
      participants.set(handle, { 
        ...current, 
        count: current.count + 1 
      })
      
      if (node.replies && Array.isArray(node.replies)) {
        node.replies.forEach(reply => {
          if (reply && reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            traverse(reply as ThreadViewPost)
          }
        })
      }
    }
    
    // Also check ancestors
    let current = thread
    while (current && current.parent && current.parent.$type === 'app.bsky.feed.defs#threadViewPost') {
      const parent = current.parent as ThreadViewPost
      if (parent.post && parent.post.author) {
        const author = parent.post.author
        const existing = participants.get(author.handle) || { 
          handle: author.handle, 
          count: 0,
          displayName: author.displayName
        }
        participants.set(author.handle, { 
          ...existing, 
          count: existing.count + 1 
        })
      }
      current = parent
    }
    
    traverse(thread)
    
    return Array.from(participants.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  return (
    <div className="thread-navigation-container">
      {/* Collapse/Expand Toggle */}
      <motion.button 
        className="thread-nav-toggle"
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
            className="thread-navigation"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="thread-nav-header">
              <h3>Thread Navigation</h3>
              <div className="keyboard-hints">
                <span>J/K</span>
                <span>H: Home</span>
              </div>
            </div>

            <div className="thread-nav-actions">
              <button 
                onClick={navigatePrevious}
                className="nav-button"
                title="Previous post (K)"
              >
                <ChevronUp size={16} />
              </button>
              
              <button 
                onClick={() => onNavigate(thread.post.uri)}
                className="nav-button active"
                title="Go to main post (H)"
              >
                <Home size={16} />
              </button>
              
              <button 
                onClick={navigateNext}
                className="nav-button"
                title="Next post (J)"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="thread-diagram-container">
              <ThreadBranchDiagram 
                thread={thread}
                currentPostUri={currentPostUri}
                onNavigate={onNavigate}
              />
            </div>

            <button className="thread-search-btn">
              <Search size={14} />
              <span>Search in thread</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}