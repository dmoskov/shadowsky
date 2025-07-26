import React from 'react'
import { motion } from 'framer-motion'

interface ContentEndIndicatorProps {
  hasMore: boolean
  totalLoaded: number
  isLoading: boolean
}

export const ContentEndIndicator: React.FC<ContentEndIndicatorProps> = ({ 
  hasMore, 
  totalLoaded, 
  isLoading 
}) => {
  if (isLoading || hasMore) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="py-12 text-center"
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Visual indicator */}
        <div className="flex items-center space-x-2">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gray-700" />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="w-2 h-2 bg-blue-500 rounded-full"
          />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gray-700" />
        </div>
        
        {/* Message */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-300">
            You're all caught up! 🎉
          </h3>
          <p className="text-sm text-gray-500">
            {totalLoaded} posts loaded • No more new content
          </p>
        </div>
        
        {/* Action */}
        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="mt-4 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 
                     border border-gray-700 hover:border-gray-600 rounded-full
                     transition-colors duration-200"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Back to top ↑
        </motion.button>
      </div>
    </motion.div>
  )
}