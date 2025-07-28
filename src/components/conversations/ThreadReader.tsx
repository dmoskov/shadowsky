import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronRight, 
  ChevronDown, 
  MessageCircle, 
  AlertTriangle,
  Home,
  Maximize2,
  Minimize2,
  Users,
  BarChart3,
  Loader2,
  Keyboard
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { getEnhancedThreadService } from '../../services/thread/EnhancedThreadService'
import type { ThreadNode, ThreadNavigationState } from '../../services/thread/EnhancedThreadService'
import { PostCardBluesky } from '../feed/PostCardBluesky'
import { ErrorBoundary } from '../core/ErrorBoundary'
import type { Post, FeedItem } from '@bsky/shared'
import type { ThreadViewPost } from '../../services/atproto/thread'

interface ThreadReaderProps {
  postUri: string
  onReply?: (post: Post) => void
  onClose?: () => void
}

export const ThreadReader: React.FC<ThreadReaderProps> = ({ 
  postUri, 
  onReply = () => {},
  onClose 
}) => {
  const { agent } = useAuth()
  const [navigationState, setNavigationState] = useState<ThreadNavigationState>({
    focusedThreadUri: undefined,
    expandedNodes: new Set<string>(),
    visitedNodes: new Set<string>(),
    breadcrumbs: []
  })
  const [showStats, setShowStats] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0)
  const threadContainerRef = useRef<HTMLDivElement>(null)
  
  // Fetch thread data with infinite loop protection
  const { data: threadData, isLoading, error } = useQuery({
    queryKey: ['enhanced-thread', postUri, navigationState.focusedThreadUri],
    queryFn: async () => {
      if (!agent) throw new Error('No authenticated agent')
      
      const service = getEnhancedThreadService(agent)
      
      if (navigationState.focusedThreadUri) {
        // Get focused subthread view
        return await service.getFocusedSubthread(
          postUri, 
          navigationState.focusedThreadUri,
          3 // Context depth
        )
      } else {
        // Get full thread
        const tree = await service.buildThreadTree(postUri, 10)
        return { 
          focusedNode: tree, 
          breadcrumbs: [], 
          context: tree 
        }
      }
    },
    enabled: !!agent
  })
  
  // Calculate thread statistics
  const threadStats = React.useMemo(() => {
    if (!threadData?.context) return null
    
    const service = getEnhancedThreadService(agent!)
    return service.getThreadStats(threadData.context)
  }, [threadData, agent])
  
  // Toggle node expansion
  const toggleNode = useCallback((node: ThreadNode) => {
    const service = getEnhancedThreadService(agent!)
    service.toggleNodeExpansion(node)
    
    // Force re-render
    setNavigationState(prev => ({
      ...prev,
      expandedNodes: new Set(prev.expandedNodes) // Create new set to trigger update
    }))
  }, [agent])
  
  // Focus on a subthread
  const focusOnSubthread = useCallback((uri: string) => {
    setNavigationState(prev => ({
      ...prev,
      focusedThreadUri: uri,
      breadcrumbs: [...prev.breadcrumbs, uri]
    }))
  }, [])
  
  // Navigate back in breadcrumbs
  const navigateBack = useCallback(() => {
    setNavigationState(prev => {
      const newBreadcrumbs = [...prev.breadcrumbs]
      newBreadcrumbs.pop()
      const newFocusUri = newBreadcrumbs[newBreadcrumbs.length - 1] || undefined
      
      return {
        ...prev,
        focusedThreadUri: newFocusUri,
        breadcrumbs: newBreadcrumbs
      }
    })
  }, [])
  
  // Reset to root thread
  const navigateToRoot = useCallback(() => {
    setNavigationState({
      focusedThreadUri: undefined,
      expandedNodes: new Set<string>(),
      visitedNodes: new Set<string>(),
      breadcrumbs: []
    })
  }, [])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!threadData?.focusedNode) return
      
      const nodes = threadContainerRef.current?.querySelectorAll('[data-post-uri]')
      if (!nodes || nodes.length === 0) return
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedNodeIndex(prev => Math.min(prev + 1, nodes.length - 1))
          break
          
        case 'ArrowUp':
          e.preventDefault()
          setSelectedNodeIndex(prev => Math.max(prev - 1, 0))
          break
          
        case 'Enter':
        case ' ':
          e.preventDefault()
          const selectedNode = nodes[selectedNodeIndex]
          if (selectedNode) {
            const expandButton = selectedNode.querySelector('button[aria-label*="expand"]') as HTMLButtonElement
            expandButton?.click()
          }
          break
          
        case 'f':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            const selectedNode = nodes[selectedNodeIndex]
            if (selectedNode) {
              const uri = selectedNode.getAttribute('data-post-uri')
              if (uri) focusOnSubthread(uri)
            }
          }
          break
          
        case 'Escape':
          if (navigationState.breadcrumbs.length > 0) {
            e.preventDefault()
            navigateBack()
          } else if (onClose) {
            e.preventDefault()
            onClose()
          }
          break
          
        case 'h':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            navigateToRoot()
          }
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [threadData, selectedNodeIndex, navigationState.breadcrumbs, focusOnSubthread, navigateBack, navigateToRoot, onClose])
  
  // Highlight selected node
  useEffect(() => {
    const nodes = threadContainerRef.current?.querySelectorAll('[data-post-uri]')
    if (!nodes) return
    
    nodes.forEach((node, index) => {
      if (index === selectedNodeIndex) {
        node.classList.add('bg-gray-800')
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        node.classList.remove('bg-gray-800')
      }
    })
  }, [selectedNodeIndex])
  
  // Convert ThreadNode to FeedItem for PostCard
  const nodeToFeedItem = (node: ThreadNode, parent?: ThreadNode): FeedItem => {
    return {
      post: node.post.post,
      reply: parent ? {
        root: threadData?.context?.post.post || node.post.post,
        parent: parent.post.post
      } : undefined
    }
  }
  
  // Render a thread node and its replies
  const renderThreadNode = (
    node: ThreadNode, 
    parentNode?: ThreadNode,
    isLast = false
  ): React.ReactNode => {
    const hasReplies = node.replies.length > 0
    const isExpanded = !node.isCollapsed
    
    return (
      <div key={node.post.post.uri} className="relative">
        {/* Thread line for visual hierarchy */}
        {node.depth > 0 && (
          <div 
            className="absolute left-6 top-0 bottom-0 w-px bg-gray-700"
            style={{ 
              marginLeft: `${(node.depth - 1) * 24}px`,
              height: isLast && !hasReplies ? '50%' : '100%'
            }}
          />
        )}
        
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`relative ${node.depth > 0 ? 'ml-6' : ''}`}
          style={{ paddingLeft: `${node.depth * 24}px` }}
        >
          {/* Expand/Collapse button */}
          {hasReplies && (
            <button
              onClick={() => toggleNode(node)}
              className="absolute left-2 top-4 p-1 rounded hover:bg-gray-800 transition-colors"
              style={{ marginLeft: `${node.depth * 24}px` }}
              aria-label={isExpanded ? 'Collapse thread' : 'Expand thread'}
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )}
            </button>
          )}
          
          {/* Circular reference warning */}
          {node.hasCircularReference && (
            <div className="absolute right-4 top-4 flex items-center gap-2 px-2 py-1 bg-yellow-900/20 border border-yellow-500/20 rounded">
              <AlertTriangle size={14} className="text-yellow-500" />
              <span className="text-xs text-yellow-500">Circular Reference</span>
            </div>
          )}
          
          {/* Post content */}
          <div 
            data-post-uri={node.post.post.uri}
            className={`border-b border-gray-800 ${
              node.isFocused ? 'bg-gray-800 border-l-2 border-blue-500' : ''
            } ${node.hasCircularReference ? 'opacity-50' : ''}`}
          >
            <ErrorBoundary
              fallback={(_, reset) => (
                <div className="p-4 bg-red-900/20 border border-red-500/20">
                  <p className="text-red-400 mb-2">Failed to display post</p>
                  <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-200">
                    Retry
                  </button>
                </div>
              )}
            >
              <PostCardBluesky
                item={nodeToFeedItem(node, parentNode)}
                onReply={() => onReply(node.post.post)}
                onViewThread={() => focusOnSubthread(node.post.post.uri)}
                isInThread={true}
                isMainPost={node.isFocused}
                hasMoreReplies={hasReplies && !isExpanded}
                depth={node.depth}
              />
            </ErrorBoundary>
            
            {/* Subthread actions */}
            {hasReplies && !node.hasCircularReference && (
              <div className="px-4 py-2 flex items-center gap-4 text-sm">
                <button
                  onClick={() => focusOnSubthread(node.post.post.uri)}
                  className="flex items-center gap-1 text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <Maximize2 size={14} />
                  <span>Focus on this thread ({node.replies.length} replies)</span>
                </button>
                
                {node.depth === 0 && (
                  <span className="text-gray-500">
                    {isExpanded ? 'Click to collapse' : 'Click to expand'}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Render replies if expanded */}
        <AnimatePresence>
          {isExpanded && hasReplies && !node.hasCircularReference && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {node.replies.map((reply, index) => 
                renderThreadNode(
                  reply, 
                  node,
                  index === node.replies.length - 1
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mb-4 text-blue-500 mx-auto" />
          <p className="text-gray-400">Loading thread...</p>
        </div>
      </div>
    )
  }
  
  if (error || !threadData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            {error instanceof Error ? error.message : 'Failed to load thread'}
          </p>
          {onClose && (
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }
  
  const currentNode = threadData.focusedNode
  const breadcrumbs = threadData.breadcrumbs
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header with breadcrumbs and stats */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <MessageCircle size={24} />
              Thread Reader
            </h2>
            
            <div className="flex items-center gap-2">
              {/* Keyboard help toggle */}
              <button
                onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Keyboard shortcuts"
              >
                <Keyboard size={20} className="text-gray-400" />
              </button>
              
              {/* Thread stats toggle */}
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Thread statistics"
              >
                <BarChart3 size={20} className="text-gray-400" />
              </button>
              
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          
          {/* Breadcrumb navigation */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={navigateToRoot}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Home size={14} />
                <span>Root</span>
              </button>
              
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <ChevronRight size={14} className="text-gray-600" />
                  <span className="text-gray-400 truncate max-w-[150px]">
                    {crumb.post.author.displayName || crumb.post.author.handle}
                  </span>
                </React.Fragment>
              ))}
              
              <button
                onClick={navigateBack}
                className="ml-4 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                <Minimize2 size={12} className="inline mr-1" />
                Back
              </button>
            </div>
          )}
        </div>
        
        {/* Thread statistics */}
        <AnimatePresence>
          {showStats && threadStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-3 flex items-center gap-6 text-sm text-gray-400 border-t border-gray-800"
            >
              <div className="flex items-center gap-2">
                <MessageCircle size={14} />
                <span>{threadStats.totalPosts} posts</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>{threadStats.authors.size} participants</span>
              </div>
              <div>
                Max depth: {threadStats.maxDepth}
              </div>
              {threadStats.circularReferences > 0 && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertTriangle size={14} />
                  <span>{threadStats.circularReferences} circular references</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Keyboard shortcuts help */}
        <AnimatePresence>
          {showKeyboardHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-3 border-t border-gray-800"
            >
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Navigate</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">↑ ↓</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expand/Collapse</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">Enter</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Focus subthread</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">F</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Go back</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">Esc</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Go to root</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">H</kbd>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Thread content */}
      <div ref={threadContainerRef} className="max-w-[800px] mx-auto">
        {currentNode && renderThreadNode(currentNode)}
      </div>
    </div>
  )
}