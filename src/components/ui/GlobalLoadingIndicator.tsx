import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { LoadingSpinner } from './LoadingSpinner'

export const GlobalLoadingIndicator: React.FC = () => {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const isLoading = isFetching > 0 || isMutating > 0

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed top-4 right-4 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-300">Loading...</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}