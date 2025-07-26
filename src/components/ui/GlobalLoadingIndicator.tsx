import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLoading } from '../../contexts/LoadingContext'

export const GlobalLoadingIndicator: React.FC = () => {
  const { loading, isAnyLoading } = useLoading()
  
  // Get loading message based on what's loading
  const getLoadingMessage = () => {
    if (loading.feed) return 'Updating timeline...'
    if (loading.notifications) return 'Checking notifications...'
    if (loading.search) return 'Searching...'
    if (loading.profile) return 'Loading profile...'
    return 'Loading...'
  }
  
  return (
    <AnimatePresence>
      {isAnyLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="fixed top-16 right-4 z-50 bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center space-x-3"
        >
          {/* Animated dots */}
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
          
          <span className="text-sm text-gray-300">{getLoadingMessage()}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Inline loading indicator for header
export const HeaderLoadingIndicator: React.FC = () => {
  const { loading } = useLoading()
  
  const isContentLoading = loading.feed || loading.notifications || loading.search
  
  if (!isContentLoading) return null
  
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-400">
      <div className="relative">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
      <span className="hidden sm:inline">Updating...</span>
    </div>
  )
}