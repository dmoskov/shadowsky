import React from 'react'
import { motion } from 'framer-motion'

interface ThreadLineProps {
  depth: number
  isLast: boolean
  hasReplies: boolean
  isCollapsed?: boolean
}

export const ThreadLine: React.FC<ThreadLineProps> = ({ 
  depth, 
  isLast, 
  hasReplies,
  isCollapsed = false
}) => {
  return (
    <>
      {/* Vertical line from parent */}
      {depth > 0 && (
        <motion.div 
          className="thread-line vertical"
          initial={{ height: 0 }}
          animate={{ height: isLast ? '50%' : '100%' }}
          transition={{ duration: 0.3 }}
          style={{ left: `${(depth - 1) * 20 + 24}px` }}
        />
      )}
      
      {/* Horizontal connector */}
      {depth > 0 && (
        <motion.div 
          className="thread-line horizontal"
          initial={{ width: 0 }}
          animate={{ width: 20 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          style={{ left: `${(depth - 1) * 20 + 24}px` }}
        />
      )}
      
      {/* Continuation line for children */}
      {hasReplies && !isCollapsed && (
        <div 
          className="thread-line vertical continuation"
          style={{ left: `${depth * 20 + 24}px` }}
        />
      )}
    </>
  )
}

// Thread depth indicator
export const ThreadDepthIndicator: React.FC<{ depth: number }> = ({ depth }) => {
  if (depth === 0) return null
  
  return (
    <div className="thread-depth-indicator">
      {Array.from({ length: Math.min(depth, 5) }).map((_, i) => (
        <div 
          key={i}
          className="depth-dot"
          style={{ 
            opacity: 1 - (i * 0.15),
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

// Collapsible thread indicator
export const ThreadCollapseButton: React.FC<{
  isCollapsed: boolean
  replyCount: number
  onClick: () => void
}> = ({ isCollapsed, replyCount, onClick }) => {
  return (
    <motion.button
      className="thread-collapse-btn"
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={isCollapsed ? 'Expand thread' : 'Collapse thread'}
    >
      <motion.div
        animate={{ rotate: isCollapsed ? -90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        ▼
      </motion.div>
      {isCollapsed && (
        <span className="collapse-count">{replyCount}</span>
      )}
    </motion.button>
  )
}