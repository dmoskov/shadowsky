import React from 'react'
import { motion } from 'framer-motion'

// Post Skeleton
export const PostSkeleton: React.FC = () => (
  <motion.div
    className="bg-gray-900 border border-gray-800 rounded-lg p-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-start gap-3 mb-3">
      <div className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
        <div className="h-3 bg-gray-800 rounded w-24 animate-pulse" />
      </div>
    </div>
    <div className="space-y-2 mb-3">
      <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
      <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
    </div>
    <div className="flex gap-6">
      <div className="h-5 bg-gray-800 rounded w-16 animate-pulse" />
      <div className="h-5 bg-gray-800 rounded w-16 animate-pulse" />
      <div className="h-5 bg-gray-800 rounded w-16 animate-pulse" />
    </div>
  </motion.div>
)

// Profile Skeleton
export const ProfileSkeleton: React.FC = () => (
  <div>
    <div className="h-32 bg-gray-800 animate-pulse" />
    <div className="px-4 pb-4">
      <div className="flex items-end justify-between -mt-8 mb-4">
        <div className="w-20 h-20 rounded-full bg-gray-800 animate-pulse border-4 border-gray-900" />
        <div className="w-24 h-9 bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-6 bg-gray-800 rounded w-48 animate-pulse" />
        <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-6 mt-4">
        <div className="h-5 bg-gray-800 rounded w-20 animate-pulse" />
        <div className="h-5 bg-gray-800 rounded w-20 animate-pulse" />
      </div>
    </div>
  </div>
)

// Thread Skeleton
export const ThreadSkeleton: React.FC = () => (
  <div className="thread-skeleton">
    <PostSkeleton />
    <div className="thread-skeleton-replies">
      <div className="skeleton skeleton-reply-header" />
      {[1, 2, 3].map(i => (
        <div key={i} className="thread-skeleton-reply">
          <div className="skeleton skeleton-connector" />
          <PostSkeleton />
        </div>
      ))}
    </div>
  </div>
)

// User Card Skeleton
export const UserCardSkeleton: React.FC = () => (
  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
    <div className="flex gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
        <div className="h-3 bg-gray-800 rounded w-24 animate-pulse" />
        <div className="h-3 bg-gray-800 rounded w-full animate-pulse" />
      </div>
    </div>
  </div>
)

// Feed Loading State
export const FeedLoading: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <PostSkeleton key={i} />
    ))}
  </div>
)

// Search Results Loading
export const SearchLoading: React.FC = () => (
  <div className="space-y-4">
    <div className="h-8 bg-gray-800 rounded w-48 animate-pulse mb-4" />
    {[1, 2, 3].map(i => (
      <PostSkeleton key={i} />
    ))}
  </div>
)

// Inline Loading Spinner
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }
  
  return (
    <span className={`inline-block ${sizeClasses[size]} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`} />
  )
}

// Loading Button
export const LoadingButton: React.FC<{
  loading?: boolean
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}> = ({ loading, children, className = '', onClick, disabled }) => (
  <button
    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${className}`}
    onClick={onClick}
    disabled={disabled || loading}
  >
    {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : children}
  </button>
)

// Page Loading State
export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
    <p className="text-gray-400">{message}</p>
  </div>
)