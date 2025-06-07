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
        className="thread-participants-compact"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="participants-summary">
          <div className="participant-avatars">
            {participants.slice(0, 5).map((p, i) => (
              <motion.img
                key={p.did}
                src={p.avatar || '/default-avatar.png'}
                alt={p.handle}
                className={`participant-avatar ${p.isOP ? 'is-op' : ''}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/profile/${p.handle}`)}
                style={{ zIndex: 5 - i }}
              />
            ))}
            {participants.length > 5 && (
              <div className="participant-overflow">
                +{participants.length - 5}
              </div>
            )}
          </div>
          
          <div className="participants-stats">
            <span className="stat-item">
              <Users size={14} />
              {uniqueParticipants} people
            </span>
            <span className="stat-item">
              <MessageCircle size={14} />
              {totalPosts} posts
            </span>
            <span className={`stat-item heat-${heatLevel}`}>
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
      className="thread-participants-detailed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="participants-title">
        <Users size={18} />
        Thread Participants
      </h3>
      
      <div className="participants-list">
        {participants.slice(0, 10).map((p, i) => {
          const participationRate = (p.postCount / totalPosts * 100).toFixed(0)
          const avgPostDepth = p.replyDepth.reduce((sum, d) => sum + d, 0) / p.replyDepth.length
          
          return (
            <motion.div
              key={p.did}
              className={`participant-card ${p.isOP ? 'is-op' : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/profile/${p.handle}`)}
            >
              <img
                src={p.avatar || '/default-avatar.png'}
                alt={p.handle}
                className="participant-avatar-large"
              />
              
              <div className="participant-info">
                <div className="participant-name">
                  <span className="display-name">{p.displayName || p.handle}</span>
                  {p.isOP && <span className="op-badge">OP</span>}
                </div>
                <div className="participant-handle">@{p.handle}</div>
              </div>
              
              <div className="participant-stats">
                <div className="stat">
                  <span className="stat-value">{p.postCount}</span>
                  <span className="stat-label">posts</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{participationRate}%</span>
                  <span className="stat-label">of thread</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{avgPostDepth.toFixed(1)}</span>
                  <span className="stat-label">avg depth</span>
                </div>
              </div>
              
              <div 
                className="participation-bar"
                style={{ 
                  width: `${participationRate}%`,
                  backgroundColor: p.isOP ? 'var(--color-brand-primary)' : 'var(--color-brand-secondary)'
                }}
              />
            </motion.div>
          )
        })}
      </div>
      
      <div className="thread-insights">
        <h4>Thread Insights</h4>
        <div className="insights-grid">
          <div className="insight">
            <TrendingUp size={16} />
            <span>Avg depth: {avgDepth} levels</span>
          </div>
          <div className="insight">
            <MessageCircle size={16} />
            <span>{(totalPosts / uniqueParticipants).toFixed(1)} posts per person</span>
          </div>
          <div className="insight">
            <Zap size={16} />
            <span>{threadDuration}m conversation</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}