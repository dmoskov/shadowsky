import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Repeat, Heart, Star } from 'lucide-react'
import type { NetworkMetrics } from '@bsky/shared'

interface Props {
  topEngagers: NetworkMetrics['topEngagers']
  totalFollowers: number
}

interface EngagerWithBreakdown {
  did: string
  handle: string
  interactions: number
  replies?: number
  likes?: number
  reposts?: number
  influence?: 'high' | 'medium' | 'low'
}

export const PowerUsers: React.FC<Props> = ({ topEngagers, totalFollowers }) => {
  if (topEngagers.length === 0) {
    return (
      <div className="power-users empty">
        <h4>Power Users</h4>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          No engagement data yet. Keep posting to identify your most engaged followers!
        </p>
      </div>
    )
  }
  
  // Simulate engagement breakdown (in real app, this would come from backend)
  const engagersWithBreakdown: EngagerWithBreakdown[] = topEngagers.slice(0, 10).map(engager => {
    const total = engager.interactions
    const likes = Math.floor(total * 0.6)
    const replies = Math.floor(total * 0.25)
    const reposts = total - likes - replies
    
    // Influence based on engagement consistency and reach
    const engagementRate = total / (totalFollowers * 0.1) // Assume they've seen 10% of posts
    const influence = engagementRate > 0.5 ? 'high' : 
                     engagementRate > 0.2 ? 'medium' : 'low'
    
    return {
      ...engager,
      likes,
      replies,
      reposts,
      influence
    }
  })
  
  return (
    <div className="power-users">
      <div className="power-users-header">
        <h4>Power Users</h4>
        <span className="subtitle">Top 10% by engagement</span>
      </div>
      
      <div className="power-users-list">
        {engagersWithBreakdown.map((engager, index) => (
          <motion.div
            key={engager.did}
            className="power-user-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="user-avatar">
              <div 
                className="avatar-circle"
                style={{ backgroundColor: `hsl(${index * 36}, 70%, 50%)` }}
              >
                {engager.handle.charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div className="user-info">
              <div className="user-handle">@{engager.handle}</div>
              <div className="engagement-breakdown">
                <span className="breakdown-item" title={`${engager.replies} replies`}>
                  <MessageCircle size={12} />
                  <span className="dot-indicator" style={{ 
                    width: `${Math.min(5, engager.replies || 0) * 8}px`,
                    opacity: engager.replies ? 1 : 0.3
                  }}>
                    {'●'.repeat(Math.min(5, engager.replies || 0))}
                  </span>
                </span>
                <span className="breakdown-item" title={`${engager.likes} likes`}>
                  <Heart size={12} />
                  <span className="dot-indicator" style={{ 
                    width: `${Math.min(5, Math.round((engager.likes || 0) / 2)) * 8}px`,
                    opacity: engager.likes ? 1 : 0.3
                  }}>
                    {'●'.repeat(Math.min(5, Math.round((engager.likes || 0) / 2)))}
                  </span>
                </span>
                <span className="breakdown-item" title={`${engager.reposts} reposts`}>
                  <Repeat size={12} />
                  <span className="dot-indicator" style={{ 
                    width: `${Math.min(5, engager.reposts || 0) * 8}px`,
                    opacity: engager.reposts ? 1 : 0.3
                  }}>
                    {'●'.repeat(Math.min(5, engager.reposts || 0))}
                  </span>
                </span>
              </div>
              <div className="engagement-summary">
                ({engager.replies}R, {engager.likes}L, {engager.reposts}S)
              </div>
            </div>
            
            <div className="user-influence">
              <span className={`influence-badge ${engager.influence}`}>
                <Star size={12} />
                Influence: {engager.influence}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}