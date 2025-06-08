import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, Users, MessageSquare, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EngagementQualityChart } from './EngagementQualityChart'
import { MetricCard } from './MetricCard'
import { formatNumber } from '../../utils/format-helpers'

// Mock data for testing
const mockAnalytics = {
  profile: {
    handle: 'testuser',
    displayName: 'Test User',
    followersCount: 1234,
    followsCount: 567,
    postsCount: 890
  },
  engagementMetrics: {
    likes: 5432,
    reposts: 876,
    replies: 234,
    quotes: 45,
    totalEngagement: 6587,
    engagementRate: 7.4
  },
  engagementQuality: {
    overall: 72,
    conversationDepth: 68,
    contentResonance: 75,
    networkAmplification: 70,
    consistency: 76
  }
}

export const AnalyticsMock: React.FC = () => {
  const navigate = useNavigate()
  const { profile, engagementMetrics, engagementQuality } = mockAnalytics

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div className="analytics-header-top">
          <button 
            onClick={() => navigate(-1)}
            className="btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1>Analytics (Mock Data)</h1>
        </div>
        
        <div className="analytics-profile-info">
          <h2>@{profile.handle}</h2>
          <p>{profile.displayName}</p>
        </div>
      </div>

      {/* Engagement Quality Score - Hero Section */}
      <section className="analytics-hero">
        <div className="engagement-quality-score">
          <h3>Engagement Quality Score</h3>
          <div className="eqs-display">
            <div className="eqs-number">{engagementQuality.overall}</div>
            <div className="eqs-label">/ 100</div>
          </div>
          <EngagementQualityChart data={engagementQuality} />
        </div>
      </section>

      {/* Key Metrics Grid */}
      <section className="analytics-metrics-grid">
        <MetricCard
          icon={<Users size={20} />}
          title="Total Reach"
          value={formatNumber(profile.followersCount)}
          change="+12%"
          trend="up"
        />
        <MetricCard
          icon={<TrendingUp size={20} />}
          title="Engagement Rate"
          value={`${engagementMetrics.engagementRate}%`}
          subtitle="per post"
        />
        <MetricCard
          icon={<MessageSquare size={20} />}
          title="Conversations"
          value={formatNumber(engagementMetrics.replies)}
          subtitle="total replies"
        />
        <MetricCard
          icon={<Share2 size={20} />}
          title="Amplification"
          value={formatNumber(engagementMetrics.reposts)}
          subtitle="total reposts"
        />
      </section>

      {/* Simple Insights */}
      <section className="analytics-section">
        <h3>Insights</h3>
        <div className="insights-list">
          <motion.div 
            className="insight-recommendation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="insight-icon">💡</div>
            <div className="insight-content">
              <h4>Great Engagement Quality!</h4>
              <p>Your score of 72/100 shows strong audience connection. Keep up the conversational approach!</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}