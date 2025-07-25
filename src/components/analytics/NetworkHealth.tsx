import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Activity, HelpCircle } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
import type { NetworkMetrics } from '@bsky/shared'

interface Props {
  metrics: NetworkMetrics
  totalPosts: number
  followerGrowth?: {
    percentChange: number
    trend: 'up' | 'down' | 'stable'
  }
}

interface FollowerSegments {
  superFans: number
  regular: number
  silent: number
  ghost: number
}

export const NetworkHealth: React.FC<Props> = ({ metrics, totalPosts, followerGrowth }) => {
  // Calculate network quality score
  const calculateNetworkQuality = (): number => {
    const { followers, activeFollowers } = metrics
    
    // Engagement rate from core network (40%)
    const engagementRate = followers > 0 ? (activeFollowers.size / followers) * 100 : 0
    const engagementScore = Math.min(100, engagementRate * 5) // 20% engagement = 100 score
    
    // Follower-to-following ratio health (20%)
    const ratio = metrics.following > 0 ? metrics.followers / metrics.following : 1
    const ratioScore = ratio >= 0.8 && ratio <= 1.5 ? 100 : 
                      ratio >= 0.5 && ratio <= 2 ? 70 :
                      ratio >= 0.3 && ratio <= 3 ? 40 : 20
    
    // Active engager percentage (20%)
    const activePercentage = followers > 0 ? (activeFollowers.size / followers) * 100 : 0
    const activeScore = Math.min(100, activePercentage * 6.67) // 15% active = 100 score
    
    // Network growth velocity (20%)
    const growthScore = followerGrowth 
      ? followerGrowth.trend === 'up' ? Math.min(100, followerGrowth.percentChange * 10)
      : followerGrowth.trend === 'down' ? Math.max(0, 50 + followerGrowth.percentChange * 5)
      : 50
      : 50
    
    return Math.round(
      engagementScore * 0.4 +
      ratioScore * 0.2 +
      activeScore * 0.2 +
      growthScore * 0.2
    )
  }
  
  // Calculate follower segments
  const calculateSegments = (): FollowerSegments => {
    const { followers, topEngagers } = metrics
    
    // Estimate based on engagement patterns
    const superFanThreshold = totalPosts * 0.5
    const regularThreshold = totalPosts * 0.1
    
    let superFans = 0
    let regular = 0
    
    topEngagers.forEach(engager => {
      if (engager.interactions >= superFanThreshold) superFans++
      else if (engager.interactions >= regularThreshold) regular++
    })
    
    // Extrapolate to full follower base
    const sampleSize = topEngagers.length
    const sampleRate = followers > 0 && sampleSize > 0 ? sampleSize / followers : 0
    
    if (sampleRate > 0) {
      superFans = Math.round(superFans / sampleRate)
      regular = Math.round(regular / sampleRate)
    }
    
    const engaged = superFans + regular
    const silent = Math.round(followers * 0.3) // Estimate 30% are silent
    const ghost = followers - engaged - silent
    
    return { superFans, regular, silent, ghost: Math.max(0, ghost) }
  }
  
  const qualityScore = calculateNetworkQuality()
  const segments = calculateSegments()
  const coreEngagementRate = metrics.followers > 0 
    ? ((segments.superFans + segments.regular) / metrics.followers * 100).toFixed(1)
    : '0'
  
  return (
    <div className="network-health">
      {/* Health Metrics Cards */}
      <div className="network-health-cards">
        <motion.div 
          className="health-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="health-card-header">
            <Tooltip
              content={
                <>
                  <h4>Network Quality Score</h4>
                  <p>Composite score measuring the health and engagement of your network.</p>
                  <div className="formula">
                    Score = Core Engagement (40%) + Ratio Health (20%) + Active % (20%) + Growth (20%)
                  </div>
                  <p className="scale-info">
                    • 0-40: Needs attention<br/>
                    • 41-60: Developing<br/>
                    • 61-80: Strong<br/>
                    • 81-100: Exceptional
                  </p>
                </>
              }
              position="bottom"
              maxWidth={350}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Quality
                <HelpCircle size={14} style={{ opacity: 0.5 }} />
              </span>
            </Tooltip>
          </div>
          <div className="health-score">
            <div className="score-number">{qualityScore}</div>
            <div className="score-bar">
              <motion.div 
                className="score-bar-fill"
                style={{ 
                  width: `${qualityScore}%`,
                  backgroundColor: qualityScore >= 80 ? 'var(--color-success)' :
                                  qualityScore >= 60 ? 'var(--color-warning)' :
                                  'var(--color-error)'
                }}
                initial={{ width: 0 }}
                animate={{ width: `${qualityScore}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>
            <div className="score-label">
              {qualityScore >= 80 ? 'Exceptional' :
               qualityScore >= 60 ? 'Strong' :
               qualityScore >= 40 ? 'Developing' : 'Needs Attention'}
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="health-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="health-card-header">
            <TrendingUp size={16} style={{ color: 'var(--color-brand-primary)' }} />
            <span>Growth</span>
          </div>
          <div className="health-metric">
            <div className="metric-value">
              {followerGrowth ? (
                followerGrowth.percentChange >= 0 ? `+${followerGrowth.percentChange}%` : `${followerGrowth.percentChange}%`
              ) : 'N/A'}
            </div>
            <div className="metric-label">
              {followerGrowth?.trend === 'up' ? '↗ 7d' : 
               followerGrowth?.trend === 'down' ? '↘ 7d' : '→ 7d'}
            </div>
            <div className="metric-subtitle">
              {followerGrowth?.trend === 'up' ? 'Trending' :
               followerGrowth?.trend === 'down' ? 'Declining' : 'Stable'}
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="health-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="health-card-header">
            <Activity size={16} style={{ color: 'var(--color-brand-primary)' }} />
            <span>Engagement</span>
          </div>
          <div className="health-metric">
            <div className="metric-value">{coreEngagementRate}%</div>
            <div className="metric-label">from core</div>
            <div className="metric-subtitle">network</div>
          </div>
        </motion.div>
      </div>
      
      {/* Follower Composition */}
      <div className="follower-composition">
        <h4>Follower Composition</h4>
        <div className="composition-bars">
          <motion.div 
            className="composition-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="bar-segments">
              <motion.div 
                className="segment super-fans"
                style={{ width: metrics.followers > 0 ? `${(segments.superFans / metrics.followers) * 100}%` : '0%' }}
                initial={{ width: 0 }}
                animate={{ width: metrics.followers > 0 ? `${(segments.superFans / metrics.followers) * 100}%` : '0%' }}
                transition={{ duration: 0.8, delay: 0.5 }}
                title={`Super Fans: ${segments.superFans}`}
              />
              <motion.div 
                className="segment regular"
                style={{ width: metrics.followers > 0 ? `${(segments.regular / metrics.followers) * 100}%` : '0%' }}
                initial={{ width: 0 }}
                animate={{ width: metrics.followers > 0 ? `${(segments.regular / metrics.followers) * 100}%` : '0%' }}
                transition={{ duration: 0.8, delay: 0.6 }}
                title={`Regular Engagers: ${segments.regular}`}
              />
              <motion.div 
                className="segment silent"
                style={{ width: metrics.followers > 0 ? `${(segments.silent / metrics.followers) * 100}%` : '0%' }}
                initial={{ width: 0 }}
                animate={{ width: metrics.followers > 0 ? `${(segments.silent / metrics.followers) * 100}%` : '0%' }}
                transition={{ duration: 0.8, delay: 0.7 }}
                title={`Silent Followers: ${segments.silent}`}
              />
              <motion.div 
                className="segment ghost"
                style={{ width: metrics.followers > 0 ? `${(segments.ghost / metrics.followers) * 100}%` : '0%' }}
                initial={{ width: 0 }}
                animate={{ width: metrics.followers > 0 ? `${(segments.ghost / metrics.followers) * 100}%` : '0%' }}
                transition={{ duration: 0.8, delay: 0.8 }}
                title={`Ghost Followers: ${segments.ghost}`}
              />
            </div>
            <div className="bar-labels">
              <div className="label">
                <span className="dot super-fans"></span>
                <span>{metrics.followers > 0 ? Math.round((segments.superFans / metrics.followers) * 100) : 0}%</span>
                <span className="label-text">Super</span>
              </div>
              <div className="label">
                <span className="dot regular"></span>
                <span>{metrics.followers > 0 ? Math.round((segments.regular / metrics.followers) * 100) : 0}%</span>
                <span className="label-text">Regular</span>
              </div>
              <div className="label">
                <span className="dot silent"></span>
                <span>{metrics.followers > 0 ? Math.round((segments.silent / metrics.followers) * 100) : 0}%</span>
                <span className="label-text">Silent</span>
              </div>
              <div className="label">
                <span className="dot ghost"></span>
                <span>{metrics.followers > 0 ? Math.round((segments.ghost / metrics.followers) * 100) : 0}%</span>
                <span className="label-text">Ghost</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}