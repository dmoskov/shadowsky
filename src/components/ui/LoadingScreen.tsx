import React from 'react'
import { motion } from 'framer-motion'
import { LoadingSpinner } from './LoadingSpinner'

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-4">
          <LoadingSpinner size="xl" />
        </div>
        <h2 className="text-xl font-semibold text-gray-200 mb-2">
          Loading Bluesky
        </h2>
        <p className="text-gray-400">
          Getting things ready for you...
        </p>
      </motion.div>
    </div>
  )
}