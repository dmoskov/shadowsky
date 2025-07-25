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
import { getBskyProfileUrl } from '../../utils/url-helpers'
import type { Post } from '@bsky/shared'
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
    window.open(getBskyProfileUrl(handle), '_blank', 'noopener,noreferrer')
  }

  const handleSuggestionClick = (handle: string) => {
    setShowSuggestions(false)
    handleViewProfile(handle)
  }

  const UserCard: React.FC<{ user: ProfileView }> = ({ user }) => (
    <motion.div
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={() => handleViewProfile(user.handle)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {user.avatar ? (
            <img src={user.avatar} alt={user.handle} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center font-semibold">
              {user.handle.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">
            {user.displayName || user.handle}
          </h3>
          <p className="text-gray-400 text-sm">@{user.handle}</p>
          {user.description && (
            <p className="text-gray-300 text-sm mt-1 line-clamp-2">{user.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1">
              <span className="font-medium">{(user as any).followersCount || 0}</span>
              <span className="text-gray-500">followers</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium">{(user as any).followsCount || 0}</span>
              <span className="text-gray-500">following</span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.header 
        className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center gap-3">
          <motion.button
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={handleBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="relative flex-1">
            <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search Bluesky..."
              className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <motion.button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-700 transition-colors"
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
              className="absolute left-4 right-4 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {suggestions.map((user) => (
                <button
                  key={user.did}
                  className="w-full px-4 py-3 hover:bg-gray-700 transition-colors flex items-center gap-3 text-left"
                  onClick={() => handleSuggestionClick(user.handle)}
                >
                  <div className="flex-shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.handle} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{user.displayName || user.handle}</div>
                    <div className="text-gray-400 text-sm">@{user.handle}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Tabs */}
      {searchQuery && (
        <div className="flex border-b border-gray-800 px-4">
          <button
            className={`flex-1 py-4 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'posts' 
                ? 'text-blue-400 border-blue-400' 
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('posts')}
          >
            <FileText size={16} />
            Posts
          </button>
          <button
            className={`flex-1 py-4 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'users' 
                ? 'text-blue-400 border-blue-400' 
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            Users
          </button>
        </div>
      )}

      {/* Results */}
      <div className="px-4">
        {!searchQuery ? (
          <div className="text-center py-16">
            <SearchIcon size={48} className="mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold mb-2">Search Bluesky</h2>
            <p className="text-gray-400">
              Find posts and users across the network
            </p>
          </div>
        ) : activeTab === 'posts' ? (
          <>
            {postsLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader className="animate-spin mb-2" size={32} />
                <p className="text-gray-400">Searching posts...</p>
              </div>
            ) : postsError ? (
              <div className="text-center py-8">
                <p className="text-red-400 font-medium">Error searching posts</p>
                <p className="text-gray-400 text-sm mt-1">{postsError.message}</p>
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
              <div className="text-center py-8">
                <p className="text-gray-400">No posts found for "{searchQuery}"</p>
              </div>
            )}
          </>
        ) : (
          <>
            {usersLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader className="animate-spin mb-2" size={32} />
                <p className="text-gray-400">Searching users...</p>
              </div>
            ) : usersError ? (
              <div className="text-center py-8">
                <p className="text-red-400 font-medium">Error searching users</p>
                <p className="text-gray-400 text-sm mt-1">{usersError.message}</p>
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
              <div className="text-center py-8">
                <p className="text-gray-400">No users found for "{searchQuery}"</p>
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