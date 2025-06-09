import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Users, MessageCircle, TrendingUp, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ThreadViewPost } from '../../services/atproto/thread'

interface ParticipantData {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  postCount: number
  replyDepth: number[]
  isOP: boolean
  firstPost: Date
  lastPost: Date
}

interface ThreadParticipantsProps {
  thread: ThreadViewPost
  variant?: 'compact' | 'detailed'
}

// Feature flag - easy to disable
export const THREAD_PARTICIPANTS_ENABLED = true

export const ThreadParticipants: React.FC<ThreadParticipantsProps> = ({ 
  thread, 
  variant = 'compact' 
}) => {
  const navigate = useNavigate()
  
  // Analyze thread participation
  const participantData = useMemo(() => {
    const participants = new Map<string, ParticipantData>()
    const opDid = thread.post.author.did
    
    function analyzeNode(node: ThreadViewPost, depth: number) {
      const author = node.post.author
      const existing = participants.get(author.did)
      const postDate = new Date(node.post.indexedAt)
      
      if (existing) {
        existing.postCount++
        existing.replyDepth.push(depth)
        existing.lastPost = postDate
      } else {
        participants.set(author.did, {
          did: author.did,
          handle: author.handle,
          displayName: author.displayName,
          avatar: author.avatar,
          postCount: 1,
          replyDepth: [depth],
          isOP: author.did === opDid,
          firstPost: postDate,
          lastPost: postDate
        })
      }
      
      if (node.replies) {
        node.replies.forEach(reply => {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            analyzeNode(reply as ThreadViewPost, depth + 1)
          }
        })
      }
    }
    
    analyzeNode(thread, 0)
    
    // Sort by post count and calculate stats
    const sorted = Array.from(participants.values())
      .sort((a, b) => b.postCount - a.postCount)
    
    const totalPosts = sorted.reduce((sum, p) => sum + p.postCount, 0)
    const avgDepth = sorted.reduce((sum, p) => 
      sum + p.replyDepth.reduce((d, depth) => d + depth, 0) / p.replyDepth.length, 0
    ) / sorted.length
    
    return {
      participants: sorted,
      totalPosts,
      uniqueParticipants: sorted.length,
      avgDepth: avgDepth.toFixed(1),
      threadDuration: sorted.length > 0 
        ? Math.floor((sorted[0].lastPost.getTime() - sorted[0].firstPost.getTime()) / 1000 / 60)
        : 0
    }
  }, [thread])
  
  if (!THREAD_PARTICIPANTS_ENABLED) return null
  
  const { participants, totalPosts, uniqueParticipants, avgDepth, threadDuration } = participantData
  
  // Calculate "heat" level (activity intensity)
  const heatLevel = useMemo(() => {
    const postsPerMinute = threadDuration > 0 ? totalPosts / threadDuration : 0
    if (postsPerMinute > 1) return 'hot'
    if (postsPerMinute > 0.5) return 'warm'
    return 'cool'
  }, [totalPosts, threadDuration])
  
  if (variant === 'compact') {
    return (
      <motion.div 
        className="bg-gray-800 rounded-lg p-3 border border-gray-700"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {participants.slice(0, 5).map((p, i) => (
              <motion.img
                key={p.did}
                src={p.avatar || '/default-avatar.png'}
                alt={p.handle}
                className={`w-8 h-8 rounded-full border-2 cursor-pointer hover:z-10 transition-all ${
                  p.isOP ? 'border-blue-500' : 'border-gray-700'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/profile/${p.handle}`)}
                style={{ zIndex: 5 - i }}
              />
            ))}
            {participants.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300 border-2 border-gray-600">
                +{participants.length - 5}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {uniqueParticipants} people
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={14} />
              {totalPosts} posts
            </span>
            <span className={`flex items-center gap-1 ${
              heatLevel === 'hot' ? 'text-red-400' : 
              heatLevel === 'warm' ? 'text-yellow-400' : 
              'text-blue-400'
            }`}>
              <Zap size={14} />
              {heatLevel}
            </span>
          </div>
        </div>
      </motion.div>
    )
  }
  
  // Detailed view
  return (
    <motion.div 
      className="bg-gray-800 rounded-lg border border-gray-700 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
        <Users size={18} />
        Thread Participants
      </h3>
      
      <div className="space-y-3">
        {participants.slice(0, 10).map((p, i) => {
          const participationRate = (p.postCount / totalPosts * 100).toFixed(0)
          const avgPostDepth = p.replyDepth.reduce((sum, d) => sum + d, 0) / p.replyDepth.length
          
          return (
            <motion.div
              key={p.did}
              className={`relative bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-850 transition-colors border ${
                p.isOP ? 'border-blue-500/50' : 'border-gray-700'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/profile/${p.handle}`)}
            >
              <div className="flex items-center gap-3">
                <img
                  src={p.avatar || '/default-avatar.png'}
                  alt={p.handle}
                  className="w-12 h-12 rounded-full"
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.displayName || p.handle}</span>
                    {p.isOP && <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">OP</span>}
                  </div>
                  <div className="text-sm text-gray-400">@{p.handle}</div>
                </div>
                
                <div className="flex gap-4 text-center">
                  <div>
                    <span className="block text-lg font-semibold">{p.postCount}</span>
                    <span className="block text-xs text-gray-400">posts</span>
                  </div>
                  <div>
                    <span className="block text-lg font-semibold">{participationRate}%</span>
                    <span className="block text-xs text-gray-400">of thread</span>
                  </div>
                  <div>
                    <span className="block text-lg font-semibold">{avgPostDepth.toFixed(1)}</span>
                    <span className="block text-xs text-gray-400">avg depth</span>
                  </div>
                </div>
              </div>
              
              <div 
                className="absolute bottom-0 left-0 h-1 rounded-b-lg transition-all"
                style={{ 
                  width: `${participationRate}%`,
                  backgroundColor: p.isOP ? '#3b82f6' : '#6366f1'
                }}
              />
            </motion.div>
          )
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Thread Insights</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <TrendingUp size={16} className="text-blue-400" />
            <span>Avg depth: {avgDepth} levels</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <MessageCircle size={16} className="text-green-400" />
            <span>{(totalPosts / uniqueParticipants).toFixed(1)} posts per person</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Zap size={16} className="text-yellow-400" />
            <span>{threadDuration}m conversation</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}