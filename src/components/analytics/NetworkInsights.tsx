import React from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, TrendingUp, Users, MessageSquare } from 'lucide-react'
import type { NetworkMetrics } from '../../services/atproto/analytics'

interface Props {
  metrics: NetworkMetrics
  engagementRate: number
  topEngagers: NetworkMetrics['topEngagers']
}

export const NetworkInsights: React.FC<Props> = ({ metrics, engagementRate, topEngagers }) => {
  const generateInsights = () => {
    const insights = []
    
    // Super fans insight
    const superFanCount = topEngagers.filter(e => e.interactions > 10).length
    if (superFanCount > 0) {
      const topFan = topEngagers[0]
      insights.push({
        icon: <Users size={16} />,
        text: `Your super fans (like @${topFan.handle}) drive ${Math.round(superFanCount / metrics.activeFollowers.size * 100)}% of total engagement`,
        type: 'positive'
      })
    }
    
    // Engagement distribution
    if (topEngagers.length > 5) {
      const top5Engagement = topEngagers.slice(0, 5).reduce((sum, e) => sum + e.interactions, 0)
      const totalEngagement = topEngagers.reduce((sum, e) => sum + e.interactions, 0)
      const concentration = top5Engagement / totalEngagement
      
      if (concentration > 0.8) {
        insights.push({
          icon: <TrendingUp size={16} />,
          text: 'Engagement is highly concentrated - consider strategies to activate more followers',
          type: 'warning'
        })
      } else {
        insights.push({
          icon: <TrendingUp size={16} />,
          text: 'Engagement is well-distributed across your network (healthy)',
          type: 'positive'
        })
      }
    }
    
    // High influence user recommendation
    const highInfluenceUsers = topEngagers.filter(e => e.interactions > 5)
    if (highInfluenceUsers.length > 0 && highInfluenceUsers.length < 5) {
      insights.push({
        icon: <MessageSquare size={16} />,
        text: `Consider engaging more with @${highInfluenceUsers[0].handle} (high influence)`,
        type: 'action'
      })
    }
    
    // Growth opportunity
    if (engagementRate < 0.1) {
      insights.push({
        icon: <Lightbulb size={16} />,
        text: 'Try posting at different times to reach more of your audience',
        type: 'action'
      })
    }
    
    return insights
  }
  
  const insights = generateInsights()
  
  return (
    <div className="network-insights">
      <h4>Network Insights</h4>
      <div className="insights-list">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            className={`insight-item ${insight.type}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="insight-icon">{insight.icon}</div>
            <div className="insight-text">{insight.text}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}