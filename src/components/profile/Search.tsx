import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft,
  Search as SearchIcon,
  X,
  Users,
  FileText,
  Loader,
  User
} from 'lucide-react'
import { useSearchActors, useSearchPosts, useSearchTypeahead } from '../../hooks/useSearch'
import { PostCard } from '../feed/PostCard'
import { ComposeModal } from '../modals/ComposeModal'
import type { Post } from '../../types/atproto'
import type { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs'

type SearchTab = 'posts' | 'users'

export const Search: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>('posts')
  const [replyingTo, setReplyingTo] = useState<Post | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: postsData, isLoading: postsLoading, error: postsError } = useSearchPosts(searchQuery)
  const { data: usersData, isLoading: usersLoading, error: usersError } = useSearchActors(searchQuery)
  const { data: suggestions } = useSearchTypeahead(searchQuery)

  // Log errors for debugging
  useEffect(() => {
    if (postsError) console.error('Posts search error:', postsError)
    if (usersError) console.error('Users search error:', usersError)
  }, [postsError, usersError])

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const handleBack = () => {
    navigate('/')
  }

  const handleViewThread = (uri: string) => {
    navigate(`/thread/${encodeURIComponent(uri)}`)
  }

  const handleViewProfile = (handle: string) => {
    navigate(`/profile/${handle}`)
  }

  const handleSuggestionClick = (handle: string) => {
    setShowSuggestions(false)
    handleViewProfile(handle)
  }

  const UserCard: React.FC<{ user: ProfileView }> = ({ user }) => (
    <motion.div
      className="user-card card"
      onClick={() => handleViewProfile(user.handle)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="user-card-content">
        <div className="user-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.handle} />
          ) : (
            <div className="avatar-placeholder">
              {user.handle.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="user-info">
          <h3 className="user-display-name">
            {user.displayName || user.handle}
          </h3>
          <p className="user-handle text-secondary">@{user.handle}</p>
          {user.description && (
            <p className="user-bio text-secondary">{user.description}</p>
          )}
          <div className="user-stats">
            <span className="stat-item">
              <span className="stat-value">{(user as any).followersCount || 0}</span>
              <span className="stat-label text-tertiary">followers</span>
            </span>
            <span className="stat-item">
              <span className="stat-value">{(user as any).followsCount || 0}</span>
              <span className="stat-label text-tertiary">following</span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="search-page">
      {/* Header */}
      <motion.header 
        className="search-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="search-header-nav">
          <motion.button
            className="btn btn-icon btn-ghost"
            onClick={handleBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="search-input-wrapper">
            <SearchIcon size={20} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search Bluesky..."
              className="search-input"
            />
            {searchQuery && (
              <motion.button
                className="btn btn-icon btn-ghost clear-btn"
                onClick={() => setSearchQuery('')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={18} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions && suggestions.length > 0 && (
            <motion.div
              className="search-suggestions"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {suggestions.map((user) => (
                <button
                  key={user.did}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(user.handle)}
                >
                  <div className="suggestion-avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.handle} />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="suggestion-info">
                    <span className="suggestion-name">{user.displayName || user.handle}</span>
                    <span className="suggestion-handle text-secondary">@{user.handle}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Tabs */}
      {searchQuery && (
        <div className="search-tabs">
          <button
            className={`tab-item ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <FileText size={16} />
            Posts
          </button>
          <button
            className={`tab-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            Users
          </button>
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {!searchQuery ? (
          <div className="empty-state">
            <SearchIcon size={48} className="empty-icon" />
            <h2>Search Bluesky</h2>
            <p className="text-secondary">
              Find posts and users across the network
            </p>
          </div>
        ) : activeTab === 'posts' ? (
          <>
            {postsLoading ? (
              <div className="loading-state">
                <Loader className="spinner" size={32} />
                <p className="text-secondary">Searching posts...</p>
              </div>
            ) : postsError ? (
              <div className="error-state">
                <p className="text-error">Error searching posts</p>
                <p className="text-secondary text-sm">{postsError.message}</p>
              </div>
            ) : postsData && 'posts' in postsData && postsData.posts && postsData.posts.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {postsData.posts.map((post: Post, index: number) => (
                  <motion.div
                    key={post.uri}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <PostCard 
                      item={{ post, reply: undefined, reason: undefined }} 
                      onReply={setReplyingTo}
                      onViewThread={handleViewThread}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="empty-state">
                <p className="text-secondary">No posts found for "{searchQuery}"</p>
              </div>
            )}
          </>
        ) : (
          <>
            {usersLoading ? (
              <div className="loading-state">
                <Loader className="spinner" size={32} />
                <p className="text-secondary">Searching users...</p>
              </div>
            ) : usersError ? (
              <div className="error-state">
                <p className="text-error">Error searching users</p>
                <p className="text-secondary text-sm">{usersError.message}</p>
              </div>
            ) : usersData && 'actors' in usersData && usersData.actors && usersData.actors.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {usersData.actors.map((user: ProfileView, index: number) => (
                  <motion.div
                    key={user.did}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <UserCard user={user} />
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="empty-state">
                <p className="text-secondary">No users found for "{searchQuery}"</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compose Modal */}
      {replyingTo && (
        <ComposeModal
          isOpen={!!replyingTo}
          onClose={() => setReplyingTo(null)}
          replyTo={{ post: replyingTo }}
        />
      )}
    </div>
  )
}