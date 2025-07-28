import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, MessageCircle, TrendingUp, Search } from 'lucide-react'
import { ConversationsCached as Conversations } from './ConversationsCached'
import { ThreadReader } from './ThreadReader'
import { useAuth } from '../../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { atProtoClient } from '../../services/atproto'

type TabType = 'messages' | 'threads' | 'trending'

interface TrendingThread {
  uri: string
  post: any
  replyCount: number
  participants: number
  lastActivity: string
}

export const ConversationsEnhanced: React.FC = () => {
  const { agent } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('messages')
  const [selectedThreadUri, setSelectedThreadUri] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Fetch trending threads (mock data for now, would need real API)
  const { data: trendingThreads } = useQuery({
    queryKey: ['trending-threads'],
    queryFn: async () => {
      if (!agent) throw new Error('No authenticated agent')
      
      // This is mock data - in reality, you'd fetch popular threads
      // from the Bluesky API based on engagement metrics
      const mockThreads: TrendingThread[] = []
      
      try {
        // Try to fetch user's timeline to find posts with high engagement
        const timeline = await agent.app.bsky.feed.getTimeline({ limit: 50 })
        
        // Filter posts with replies to find active threads
        const threadsWithReplies = timeline.data.feed
          .filter(item => item.post.replyCount && item.post.replyCount > 0)
          .sort((a, b) => (b.post.replyCount || 0) - (a.post.replyCount || 0))
          .slice(0, 10)
          .map(item => ({
            uri: item.post.uri,
            post: item.post,
            replyCount: item.post.replyCount || 0,
            participants: Math.min(5, item.post.replyCount || 0), // Mock participant count
            lastActivity: item.post.indexedAt
          }))
        
        return threadsWithReplies
      } catch (error) {
        console.error('Failed to fetch trending threads:', error)
        return []
      }
    },
    enabled: !!agent && activeTab === 'threads',
    refetchInterval: 60000 // Refresh every minute
  })
  
  const filteredThreads = trendingThreads?.filter(thread => {
    if (!searchQuery) return true
    
    const text = thread.post.record?.value?.text?.toLowerCase() || ''
    const author = thread.post.author?.displayName?.toLowerCase() || 
                   thread.post.author?.handle?.toLowerCase() || ''
    
    return text.includes(searchQuery.toLowerCase()) || 
           author.includes(searchQuery.toLowerCase())
  }) || []
  
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors
                      ${activeTab === 'messages' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : 'text-gray-400 hover:text-gray-200'}`}
          >
            <MessageSquare size={20} />
            <span className="font-medium">Messages</span>
          </button>
          
          <button
            onClick={() => setActiveTab('threads')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors
                      ${activeTab === 'threads' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : 'text-gray-400 hover:text-gray-200'}`}
          >
            <MessageCircle size={20} />
            <span className="font-medium">Thread Reader</span>
          </button>
          
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors
                      ${activeTab === 'trending' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : 'text-gray-400 hover:text-gray-200'}`}
          >
            <TrendingUp size={20} />
            <span className="font-medium">Trending</span>
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'messages' && (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <Conversations />
            </motion.div>
          )}
          
          {activeTab === 'threads' && (
            <motion.div
              key="threads"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex"
            >
              {/* Thread list */}
              <div className={`${selectedThreadUri ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-800`}>
                <div className="p-4 border-b border-gray-800">
                  <h2 className="text-lg font-semibold text-gray-100 mb-3">Active Threads</h2>
                  <div className="relative">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search threads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                               text-gray-100 placeholder-gray-400 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {filteredThreads.map((thread) => (
                    <button
                      key={thread.uri}
                      onClick={() => setSelectedThreadUri(thread.uri)}
                      className={`w-full text-left p-4 hover:bg-gray-800 transition-colors border-b border-gray-800
                                ${selectedThreadUri === thread.uri ? 'bg-gray-800' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-600 
                                      flex items-center justify-center text-gray-200 font-medium flex-shrink-0">
                          {thread.post.author?.displayName?.[0] || thread.post.author?.handle?.[0] || 'U'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-100">
                              {thread.post.author?.displayName || thread.post.author?.handle || 'Unknown'}
                            </h3>
                            <span className="text-xs text-gray-400">
                              {thread.replyCount} replies
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {thread.post.record?.value?.text || 'No content'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{thread.participants} participants</span>
                            <span>Active {new Date(thread.lastActivity).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {filteredThreads.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No active threads found</p>
                      <p className="text-sm mt-2">Threads with replies will appear here</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Thread reader */}
              {selectedThreadUri ? (
                <div className="flex-1">
                  <ThreadReader 
                    postUri={selectedThreadUri}
                    onClose={() => setSelectedThreadUri(null)}
                  />
                </div>
              ) : (
                <div className="hidden md:flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <MessageCircle size={64} className="mx-auto mb-4 text-gray-600" />
                    <h2 className="text-xl font-semibold text-gray-200 mb-2">Select a thread</h2>
                    <p className="text-gray-400">Choose a thread from the left to explore the conversation</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center"
            >
              <div className="text-center">
                <TrendingUp size={64} className="mx-auto mb-4 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-200 mb-2">Trending Threads</h2>
                <p className="text-gray-400">Coming soon: Discover the most engaging conversations</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}