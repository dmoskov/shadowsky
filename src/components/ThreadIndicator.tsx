import React from 'react'
import { motion } from 'framer-motion'

interface ThreadIndicatorProps {
  hasParent: boolean
  hasReplies: boolean
}

export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({ 
  hasParent, 
  hasReplies 
}) => {
  if (!hasParent && !hasReplies) return null

  return (
    <div className="thread-indicator">
      {hasParent && (
        <motion.div 
          className="thread-line thread-line-up"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {hasReplies && (
        <motion.div 
          className="thread-line thread-line-down"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        />
      )}
    </div>
  )
}