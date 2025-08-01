import React, { useState } from 'react'
import { X, Search, Plus, Check, Star, TrendingUp, Users, Hash } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { proxifyBskyImage } from '../utils/image-proxy'
import { debug } from '@bsky/shared'

interface FeedDiscoveryProps {
  isOpen: boolean
  onClose: () => void
}

interface FeedGenerator {
  uri: string
  cid: string
  did: string
  creator: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  displayName: string
  description?: string
  avatar?: string
  likeCount?: number
  viewer?: {
    like?: string
  }
}

export const FeedDiscovery: React.FC<FeedDiscoveryProps> = ({ isOpen, onClose }) => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'suggested' | 'popular'>('suggested')

  // Get user's saved feeds to check what's already added
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      return await agent.getPreferences()
    },
    enabled: !!agent
  })

  // Fetch suggested or popular feeds based on active tab
  const { data: feeds, isLoading } = useQuery({
    queryKey: ['feedDiscovery', activeTab],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      
      if (activeTab === 'suggested') {
        const response = await agent.app.bsky.feed.getSuggestedFeeds({ limit: 30 })
        debug.log('Suggested feeds:', response.data)
        return response.data.feeds
      } else {
        const response = await agent.app.bsky.unspecced.getPopularFeedGenerators({ limit: 30 })
        debug.log('Popular feeds:', response.data)
        return response.data.feeds
      }
    },
    enabled: !!agent && isOpen
  })

  // Add feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async (feedUri: string) => {
      if (!agent) throw new Error('Not authenticated')
      
      const newSavedFeed = {
        id: `feed-${Date.now()}`,
        type: 'feed' as const,
        value: feedUri,
        pinned: false
      }
      
      await agent.addSavedFeeds([newSavedFeed])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] })
    }
  })

  // Remove feed mutation
  const removeFeedMutation = useMutation({
    mutationFn: async (feedUri: string) => {
      if (!agent || !userPrefs?.savedFeeds) throw new Error('Not authenticated')
      
      const feedToRemove = userPrefs.savedFeeds.find(
        (f: any) => f.value === feedUri
      )
      
      if (feedToRemove) {
        await agent.removeSavedFeeds([feedToRemove.id])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] })
    }
  })

  const isFeedSaved = (feedUri: string) => {
    return userPrefs?.savedFeeds?.some((f: any) => f.value === feedUri) || false
  }

  const handleToggleFeed = async (feed: FeedGenerator) => {
    if (isFeedSaved(feed.uri)) {
      await removeFeedMutation.mutateAsync(feed.uri)
    } else {
      await addFeedMutation.mutateAsync(feed.uri)
    }
  }

  const filteredFeeds = feeds?.filter((feed: FeedGenerator) => 
    feed.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    feed.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden rounded-2xl shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--bsky-bg-primary)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              Discover Feeds
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-500 transition-colors"
            >
              <X size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
            </button>
          </div>

          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--bsky-text-secondary)' }}
            />
            <input
              type="text"
              placeholder="Search feeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bsky-bg-secondary)',
                borderColor: 'var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('suggested')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'suggested' ? 'text-white' : ''
              }`}
              style={{
                backgroundColor: activeTab === 'suggested' ? 'var(--bsky-primary)' : 'transparent',
                color: activeTab === 'suggested' ? 'white' : 'var(--bsky-text-secondary)'
              }}
            >
              Suggested
            </button>
            <button
              onClick={() => setActiveTab('popular')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'popular' ? 'text-white' : ''
              }`}
              style={{
                backgroundColor: activeTab === 'popular' ? 'var(--bsky-primary)' : 'transparent',
                color: activeTab === 'popular' ? 'white' : 'var(--bsky-text-secondary)'
              }}
            >
              Popular
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8" style={{ color: 'var(--bsky-text-secondary)' }}>
              Loading feeds...
            </div>
          ) : filteredFeeds && filteredFeeds.length > 0 ? (
            <div className="space-y-4">
              {filteredFeeds.map((feed: FeedGenerator) => (
                <div
                  key={feed.uri}
                  className="flex items-start gap-3 p-4 rounded-lg border hover:bg-opacity-5 hover:bg-blue-500 transition-colors"
                  style={{ borderColor: 'var(--bsky-border-primary)' }}
                >
                  {feed.avatar ? (
                    <img
                      src={proxifyBskyImage(feed.avatar)}
                      alt={feed.displayName}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}
                    >
                      <Hash size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                          {feed.displayName}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                          by @{feed.creator.handle}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleFeed(feed)}
                        disabled={addFeedMutation.isPending || removeFeedMutation.isPending}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          isFeedSaved(feed.uri) 
                            ? 'border' 
                            : 'text-white'
                        }`}
                        style={{
                          backgroundColor: isFeedSaved(feed.uri) ? 'transparent' : 'var(--bsky-primary)',
                          borderColor: isFeedSaved(feed.uri) ? 'var(--bsky-border-primary)' : 'transparent',
                          color: isFeedSaved(feed.uri) ? 'var(--bsky-text-secondary)' : 'white'
                        }}
                      >
                        {isFeedSaved(feed.uri) ? (
                          <>
                            <Check size={16} className="inline mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus size={16} className="inline mr-1" />
                            Add
                          </>
                        )}
                      </button>
                    </div>
                    
                    {feed.description && (
                      <p className="text-sm mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                        {feed.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        <Users size={14} className="inline mr-1" />
                        {feed.likeCount || 0} likes
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--bsky-text-secondary)' }}>
              No feeds found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}