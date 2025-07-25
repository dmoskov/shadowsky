import React, { useState } from 'react'
import { Search as SearchIcon, User, FileText, Hash } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

type SearchTab = 'users' | 'posts' | 'tags'

export const Search: React.FC = () => {
  const { agent } = useAuth()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('users')

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', query, activeTab],
    queryFn: async () => {
      if (!agent || query.length < 2) return null

      if (activeTab === 'users') {
        const response = await agent.searchActors({ q: query, limit: 20 })
        return { type: 'users', data: response.data.actors }
      } else if (activeTab === 'posts') {
        const response = await agent.app.bsky.feed.searchPosts({ q: query, limit: 20 })
        return { type: 'posts', data: response.data.posts }
      }
      
      return null
    },
    enabled: query.length >= 2 && !!agent
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      {/* Search Input */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-4 top-3.5 text-gray-400" size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Bluesky..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Search Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <User size={18} />
          Users
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <FileText size={18} />
          Posts
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'tags'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <Hash size={18} />
          Tags
        </button>
      </div>

      {/* Search Results */}
      <div>
        {query.length < 2 ? (
          <div className="text-center text-gray-400 py-12">
            Type at least 2 characters to search
          </div>
        ) : isLoading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 h-20"></div>
            ))}
          </div>
        ) : searchResults?.type === 'users' ? (
          <div className="space-y-2">
            {searchResults.data.length === 0 ? (
              <div className="text-center text-gray-400 py-12">No users found</div>
            ) : (
              searchResults.data.map((user) => (
                <Link
                  key={user.did}
                  to={`/profile/${user.handle}`}
                  className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.handle}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                      {user.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{user.displayName || user.handle}</div>
                    <div className="text-sm text-gray-400">@{user.handle}</div>
                    {user.description && (
                      <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {user.description}
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : searchResults?.type === 'posts' ? (
          <div className="space-y-4">
            {searchResults.data.length === 0 ? (
              <div className="text-center text-gray-400 py-12">No posts found</div>
            ) : (
              searchResults.data.map((post) => (
                <div key={post.uri} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {post.author.avatar ? (
                      <img 
                        src={post.author.avatar} 
                        alt={post.author.handle}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        {post.author.handle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{post.author.displayName || post.author.handle}</span>
                        <span className="text-gray-400">@{post.author.handle}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">
                        {(post.record as any).text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'tags' ? (
          <div className="text-center text-gray-400 py-12">
            Tag search coming soon
          </div>
        ) : null}
      </div>
    </div>
  )
}