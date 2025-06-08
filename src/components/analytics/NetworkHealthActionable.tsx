import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Star,
  ArrowRight,
  Target,
  Zap,
  Heart
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { NetworkMetrics } from '../../services/atproto/analytics'

interface Props {
  metrics: NetworkMetrics
  totalPosts: number
  engagementRate: number
  followerGrowth?: {
    percentChange: number
    trend: 'up' | 'down' | 'stable'
  }
  onComposePost?: (template?: string) => void
}

interface HealthStatus {
  label: string
  icon: string
  color: string
  message: string
}

interface ActionCard {
  id: string
  priority: 'high' | 'medium' | 'low'
  icon: React.ReactNode
  title: string
  description: string
  actionLabel: string
  onClick: () => void
  expectedImpact: string
}

interface QuickDiagnosis {
  icon: React.ReactNode
  issue: string
  comparison: string
  severity: 'critical' | 'warning' | 'info'
}

export const NetworkHealthActionable: React.FC<Props> = ({ 
  metrics, 
  totalPosts, 
  engagementRate,
  followerGrowth,
  onComposePost
}) => {
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(false)
  
  // Calculate health score (reusing logic from NetworkHealth)
  const calculateHealthScore = (): number => {
    const { followers, activeFollowers } = metrics
    
    const engagementScore = Math.min(100, engagementRate * 500) // 0.2% = 100
    const activePercentage = followers > 0 ? (activeFollowers.size / followers) * 100 : 0
    const activeScore = Math.min(100, activePercentage * 6.67)
    const growthScore = followerGrowth 
      ? followerGrowth.trend === 'up' ? Math.min(100, followerGrowth.percentChange * 10)
      : followerGrowth.trend === 'down' ? Math.max(0, 50 + followerGrowth.percentChange * 5)
      : 50
      : 50
    
    return Math.round(
      engagementScore * 0.4 +
      activeScore * 0.3 +
      growthScore * 0.3
    )
  }
  
  const getHealthStatus = (score: number): HealthStatus => {
    if (score < 20) return { 
      label: "Needs Attention", 
      icon: "🟠", 
      color: "var(--color-warning)",
      message: "Your network isn't engaging with your content"
    }
    if (score < 50) return { 
      label: "Building Momentum", 
      icon: "🟡",
      color: "var(--color-warning)",
      message: "You're starting to build an engaged audience" 
    }
    if (score < 80) return { 
      label: "Healthy & Growing", 
      icon: "🟢",
      color: "var(--color-success)",
      message: "Your network actively engages with your content"
    }
    return { 
      label: "Thriving Community", 
      icon: "🌟",
      color: "var(--color-success)",
      message: "You've built an exceptional engaged community"
    }
  }
  
  const generateQuickDiagnosis = (): QuickDiagnosis[] => {
    const diagnosis: QuickDiagnosis[] = []
    
    // Check engagement rate
    if (engagementRate < 0.1) {
      diagnosis.push({
        icon: <AlertCircle size={16} />,
        issue: `Low engagement (${engagementRate.toFixed(1)}%)`,
        comparison: "vs 2.5% typical",
        severity: 'critical'
      })
    }
    
    // Check ghost followers
    const ghostPercentage = metrics.followers > 0 
      ? ((metrics.followers - metrics.activeFollowers.size) / metrics.followers) * 100
      : 0
    if (ghostPercentage > 50) {
      diagnosis.push({
        icon: <Users size={16} />,
        issue: `High ghost followers (${Math.round(ghostPercentage)}%)`,
        comparison: "vs 30% typical",
        severity: 'warning'
      })
    }
    
    // Check growth
    if (followerGrowth && followerGrowth.percentChange <= 0) {
      diagnosis.push({
        icon: <TrendingUp size={16} />,
        issue: `No recent growth (${followerGrowth.percentChange}%)`,
        comparison: "this week",
        severity: 'info'
      })
    }
    
    return diagnosis.slice(0, 3)
  }
  
  const generateActions = (): ActionCard[] => {
    const actions: ActionCard[] = []
    
    // Low engagement? Suggest conversation starters
    if (engagementRate < 0.1) {
      actions.push({
        id: 'start-conversation',
        priority: 'high',
        icon: <MessageSquare size={20} />,
        title: 'Start a conversation',
        description: 'Ask a question your followers care about',
        actionLabel: 'Write a Question Post',
        onClick: () => onComposePost?.('question'),
        expectedImpact: '+50% engagement'
      })
    }
    
    // Have supportive users? Nurture them
    if (metrics.topEngagers.length > 0) {
      const topFan = metrics.topEngagers[0]
      actions.push({
        id: 'engage-supporters',
        priority: 'medium',
        icon: <Heart size={20} />,
        title: 'Engage with your top supporters',
        description: `@${topFan.handle} liked ${topFan.interactions} of your posts`,
        actionLabel: 'Reply to Their Latest',
        onClick: () => navigate(`/profile/${topFan.handle}`),
        expectedImpact: 'Strengthen core network'
      })
    }
    
    // Suggest optimal posting times
    actions.push({
      id: 'optimal-timing',
      priority: 'medium',
      icon: <Clock size={20} />,
      title: 'Post at peak times',
      description: 'Your followers are most active at 7-9 PM',
      actionLabel: 'Schedule a Post',
      onClick: () => onComposePost?.(),
      expectedImpact: '+30% visibility'
    })
    
    // Re-engage ghost followers
    const ghostPercentage = metrics.followers > 0 
      ? ((metrics.followers - metrics.activeFollowers.size) / metrics.followers) * 100
      : 0
    if (ghostPercentage > 50) {
      actions.push({
        id: 'reactivate-ghosts',
        priority: 'low',
        icon: <Zap size={20} />,
        title: 'Re-activate silent followers',
        description: 'Share something unexpected to spark interest',
        actionLabel: 'Try a New Topic',
        onClick: () => onComposePost?.('reactivation'),
        expectedImpact: 'Wake up dormant followers'
      })
    }
    
    return actions.slice(0, 3)
  }
  
  const healthScore = calculateHealthScore()
  const healthStatus = getHealthStatus(healthScore)
  const diagnosis = generateQuickDiagnosis()
  const actions = generateActions()
  
  return (
    <div className="network-health-actionable">
      {/* Header with Health Status */}
      <div className="health-header" style={{ borderColor: healthStatus.color }}>
        <div className="health-status">
          <h3>
            Your Network Health: {healthStatus.label} {healthStatus.icon}
          </h3>
          <p>{healthStatus.message}</p>
        </div>
        <button 
          className="btn-text"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide' : 'View'} Detailed Analytics
        </button>
      </div>
      
      {/* Quick Diagnosis */}
      {diagnosis.length > 0 && (
        <div className="quick-diagnosis">
          <h4>📊 Quick Diagnosis</h4>
          <div className="diagnosis-list">
            {diagnosis.map((item, index) => (
              <motion.div
                key={index}
                className={`diagnosis-item ${item.severity}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <span className="diagnosis-icon">{item.icon}</span>
                <span className="diagnosis-text">
                  {item.issue} <span className="comparison">{item.comparison}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      
      {/* Recommended Actions */}
      <div className="recommended-actions">
        <h4>🎯 Recommended Actions (This Week)</h4>
        <div className="action-cards">
          {actions.map((action, index) => (
            <motion.div
              key={action.id}
              className={`action-card priority-${action.priority}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="action-icon">{action.icon}</div>
              <div className="action-content">
                <h5>{action.title}</h5>
                <p>{action.description}</p>
                <div className="action-footer">
                  <button 
                    className="action-button"
                    onClick={action.onClick}
                  >
                    {action.actionLabel} <ArrowRight size={16} />
                  </button>
                  <span className="expected-impact">{action.expectedImpact}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Detailed Analytics (Progressive Disclosure) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="detailed-analytics"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="analytics-grid">
              <div className="metric-detail">
                <h5>Engagement Rate</h5>
                <div className="metric-value">{engagementRate.toFixed(2)}%</div>
                <div className="metric-benchmark">Industry avg: 0.05-0.20%</div>
              </div>
              <div className="metric-detail">
                <h5>Active Followers</h5>
                <div className="metric-value">{metrics.activeFollowers.size}</div>
                <div className="metric-benchmark">
                  {metrics.followers > 0 
                    ? `${Math.round((metrics.activeFollowers.size / metrics.followers) * 100)}% of total`
                    : 'Build your audience'
                  }
                </div>
              </div>
              <div className="metric-detail">
                <h5>Top Supporters</h5>
                <div className="metric-value">{metrics.topEngagers.length}</div>
                <div className="metric-benchmark">Nurture these relationships</div>
              </div>
              <div className="metric-detail">
                <h5>Network Score</h5>
                <div className="metric-value">{healthScore}/100</div>
                <div className="metric-benchmark">
                  {healthScore < 50 ? 'Room to grow' : 'Keep it up!'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}