import React from 'react'
import { motion } from 'framer-motion'

// Post Skeleton
export const PostSkeleton: React.FC = () => (
  <motion.div
    className="post-skeleton card"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="skeleton-header">
      <div className="skeleton skeleton-avatar" />
      <div className="skeleton-info">
        <div className="skeleton skeleton-name" />
        <div className="skeleton skeleton-handle" />
      </div>
    </div>
    <div className="skeleton skeleton-content" />
    <div className="skeleton skeleton-content short" />
    <div className="skeleton-actions">
      <div className="skeleton skeleton-action" />
      <div className="skeleton skeleton-action" />
      <div className="skeleton skeleton-action" />
    </div>
  </motion.div>
)

// Profile Skeleton
export const ProfileSkeleton: React.FC = () => (
  <div className="profile-skeleton">
    <div className="skeleton skeleton-banner" />
    <div className="profile-skeleton-main">
      <div className="skeleton skeleton-avatar large" />
      <div className="skeleton skeleton-button" />
    </div>
    <div className="profile-skeleton-info">
      <div className="skeleton skeleton-name" />
      <div className="skeleton skeleton-handle" />
      <div className="skeleton skeleton-bio" />
      <div className="skeleton skeleton-bio" />
    </div>
    <div className="profile-skeleton-stats">
      <div className="skeleton skeleton-stat" />
      <div className="skeleton skeleton-stat" />
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
  <div className="user-card-skeleton card">
    <div className="skeleton skeleton-avatar" />
    <div className="user-skeleton-info">
      <div className="skeleton skeleton-name" />
      <div className="skeleton skeleton-handle" />
      <div className="skeleton skeleton-bio" />
    </div>
  </div>
)

// Feed Loading State
export const FeedLoading: React.FC = () => (
  <div className="feed-loading">
    {[1, 2, 3].map(i => (
      <PostSkeleton key={i} />
    ))}
  </div>
)

// Search Results Loading
export const SearchLoading: React.FC = () => (
  <div className="search-loading">
    <div className="skeleton skeleton-search-header" />
    {[1, 2, 3].map(i => (
      <PostSkeleton key={i} />
    ))}
  </div>
)

// Inline Loading Spinner
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <span className={`inline-loader spinner spinner-${size}`} />
)

// Loading Button
export const LoadingButton: React.FC<{
  loading?: boolean
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}> = ({ loading, children, className = '', onClick, disabled }) => (
  <button
    className={`btn ${className} ${loading ? 'loading' : ''}`}
    onClick={onClick}
    disabled={disabled || loading}
  >
    {loading ? <span className="spinner spinner-sm" /> : children}
  </button>
)

// Page Loading State
export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="page-loader">
    <div className="spinner spinner-lg" />
    <p className="text-secondary">{message}</p>
  </div>
)