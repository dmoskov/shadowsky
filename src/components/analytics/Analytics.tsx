import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Clock,
  BarChart3,
  Share2,
  Calendar,
  RefreshCw,
  HelpCircle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { StoredAnalyticsService } from '../../services/atproto/analytics-stored'
import { EngagementQualityChart } from './EngagementQualityChart'
import { ContentPerformance } from './ContentPerformance'
import { TemporalHeatmap } from './TemporalHeatmap'
import { Tooltip } from '../ui/Tooltip'
import { NetworkGraph } from './NetworkGraph'
import { NetworkHealth } from './NetworkHealth'
import { PowerUsers } from './PowerUsers'
import { NetworkInsights } from './NetworkInsights'
import { NetworkHealthActionable } from './NetworkHealthActionable'
import { MetricCard } from './MetricCard'
import { FollowerGrowthChart } from './FollowerGrowthChart'
import { AnalyticsSyncStatus } from './AnalyticsSyncStatus'
import { formatNumber } from '../../utils/format-helpers'
import { generateInsights } from '../../utils/analytics-insights'
import { useAnalyticsSync } from '../../hooks/useAnalyticsSync'

export const Analytics: React.FC = () => {
  const { handle } = useParams<{ handle?: string }>()
  const navigate = useNavigate()
  const { client, session } = useAuth()
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d')
  const { syncStatus, syncAnalytics, isFirstSync } = useAnalyticsSync()

  const targetHandle = handle || session?.handle
  const targetDid = session?.did

  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics-stored', targetDid, selectedTimeRange, syncStatus.lastSync],
    queryFn: async () => {
      console.log('Analytics query - targetDid:', targetDid)
      if (!targetDid) throw new Error('Not authenticated')
      
      const service = new StoredAnalyticsService()
      try {
        const result = await service.getStoredAnalytics(targetDid, selectedTimeRange)
        console.log('Analytics query success:', result)
        return result
      } catch (err) {
        console.error('Analytics query error:', err)
        throw err
      }
    },
    enabled: !!targetDid && !isFirstSync && syncStatus.stats !== null && syncStatus.stats.totalPosts > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Generate sparkline data from real historical data
  const generateSparklineData = (metric: 'engagement' | 'posts' | 'followers') => {
    if (!analytics?.historicalData?.snapshots || analytics.historicalData.snapshots.length < 2) {
      // Not enough data for sparklines yet
      return []
    }
    
    const snapshots = analytics.historicalData.snapshots.slice(-10) // Last 10 data points
    
    if (metric === 'engagement') {
      return snapshots.map(s => s.engagementRate)
    } else if (metric === 'posts') {
      return snapshots.map(s => s.postsToday)
    } else if (metric === 'followers') {
      return snapshots.map(s => s.followersCount)
    }
    
    return []
  }

  if (isLoading) {
    return (
      <div className="analytics-container">
        <div className="analytics-loading">
          <div className="spinner spinner-lg"></div>
          <p>Analyzing your Bluesky presence...</p>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    console.error('Analytics error state:', error)
    return (
      <div className="analytics-container">
        <div className="analytics-error">
          <p>Unable to load analytics</p>
          {error && (
            <p className="error-details" style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          )}
          <button onClick={() => refetch()} className="btn btn-primary">
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { profile, engagementMetrics, contentAnalysis, engagementQuality } = analytics

  // Show first sync UI if needed
  if (isFirstSync && !syncStatus.isSyncing && !syncStatus.lastSync) {
    console.log('Showing first sync UI - isFirstSync:', isFirstSync, 'lastSync:', syncStatus.lastSync, 'stats:', syncStatus.stats)
    return (
      <div className="analytics-container">
        <AnalyticsSyncStatus 
          syncStatus={syncStatus}
          onSync={syncAnalytics}
          isFirstSync={isFirstSync}
        />
      </div>
    )
  }

  return (
    <div className="analytics-container">
      {/* Sync Status Bar */}
      <AnalyticsSyncStatus 
        syncStatus={syncStatus}
        onSync={syncAnalytics}
        isFirstSync={isFirstSync}
      />
      
      <div className="analytics-header">
        <div className="analytics-header-top">
          <button 
            onClick={() => navigate(-1)}
            className="btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1>Analytics</h1>
          <button 
            onClick={() => refetch()}
            className="btn-icon"
            aria-label="Refresh analytics"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        
        <div className="analytics-profile-info">
          <h2>@{profile.handle}</h2>
          <p>{profile.displayName}</p>
        </div>

        <div className="time-range-selector">
          <button 
            className={selectedTimeRange === '7d' ? 'active' : ''}
            onClick={() => setSelectedTimeRange('7d')}
          >
            7 days
          </button>
          <button 
            className={selectedTimeRange === '30d' ? 'active' : ''}
            onClick={() => setSelectedTimeRange('30d')}
          >
            30 days
          </button>
          <button 
            className={selectedTimeRange === '90d' ? 'active' : ''}
            onClick={() => setSelectedTimeRange('90d')}
          >
            90 days
          </button>
        </div>
      </div>

      {/* Engagement Quality Score - Hero Section */}
      <section className="analytics-hero">
        <div className="engagement-quality-score">
          <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            Engagement Quality Score
            <Tooltip 
              content={
                <>
                  <h4>Engagement Quality Score (EQS)</h4>
                  <p>A composite metric that measures the overall quality and depth of engagement your content generates.</p>
                  <div className="formula">
                    EQS = (Conversation × 30%) + (Resonance × 30%) + (Amplification × 20%) + (Consistency × 20%)
                  </div>
                  <p className="scale-info">
                    • 0-40: Building engagement<br/>
                    • 41-60: Good engagement<br/>
                    • 61-80: Strong engagement<br/>
                    • 81-100: Exceptional engagement
                  </p>
                  <p className="scale-info">Higher scores indicate content that sparks meaningful discussions and spreads organically.</p>
                </>
              }
              position="bottom"
              maxWidth={400}
            >
              <HelpCircle size={16} style={{ opacity: 0.5, cursor: 'help' }} />
            </Tooltip>
          </h3>
          <div className="eqs-display">
            <div className="eqs-number">{engagementQuality.overall}</div>
            <div className="eqs-label">/ 100</div>
          </div>
          <EngagementQualityChart data={engagementQuality} />
        </div>
      </section>

      {/* Follower Growth Chart */}
      <section className="analytics-section">
        <FollowerGrowthChart 
          currentFollowers={profile.followersCount}
          timeRange={selectedTimeRange}
          historicalData={analytics.historicalData?.snapshots}
        />
      </section>

      {/* Key Metrics Grid */}
      <section className="analytics-metrics-grid">
        <MetricCard
          icon={<Users size={20} />}
          title={
            <Tooltip
              content={
                <>
                  <h4>Total Reach</h4>
                  <p>Your total follower count - the maximum potential audience for your posts.</p>
                  <p className="scale-info">
                    • Direct reach: People who follow you<br/>
                    • Extended reach: Followers + their networks (via reposts)<br/>
                    • Growth tracked daily for trend analysis
                  </p>
                </>
              }
              position="top"
              maxWidth={300}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Total Reach
                <HelpCircle size={14} style={{ opacity: 0.5 }} />
              </span>
            </Tooltip>
          }
          value={formatNumber(profile.followersCount)}
          change="+12%"
          trend="up"
          sparklineData={generateSparklineData('followers')}
        />
        <MetricCard
          icon={<TrendingUp size={20} />}
          title={
            <Tooltip
              content={
                <>
                  <h4>Engagement Rate</h4>
                  <p>The percentage of your followers who interact with your posts on average.</p>
                  <div className="formula">
                    Rate = (Total Engagements / (Posts × Followers)) × 100
                  </div>
                  <p className="scale-info">
                    • Includes: likes, reposts, replies, quotes<br/>
                    • Industry average: 0.05-0.20%<br/>
                    • Good engagement: 0.20-0.50%<br/>
                    • Excellent: Above 0.50%
                  </p>
                </>
              }
              position="top"
              maxWidth={350}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Engagement Rate
                <HelpCircle size={14} style={{ opacity: 0.5 }} />
              </span>
            </Tooltip>
          }
          value={`${engagementMetrics.engagementRate}%`}
          subtitle="per post"
          sparklineData={generateSparklineData('engagement')}
        />
        <MetricCard
          icon={<MessageSquare size={20} />}
          title={
            <Tooltip
              content={
                <>
                  <h4>Conversations</h4>
                  <p>Total number of replies your posts have generated.</p>
                  <p className="scale-info">
                    • Direct replies show engagement depth<br/>
                    • Higher reply counts indicate thought-provoking content<br/>
                    • Average: {contentAnalysis.totalPosts > 0 ? (engagementMetrics.replies / contentAnalysis.totalPosts).toFixed(1) : '0'} replies per post
                  </p>
                </>
              }
              position="top"
              maxWidth={300}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Conversations
                <HelpCircle size={14} style={{ opacity: 0.5 }} />
              </span>
            </Tooltip>
          }
          value={formatNumber(engagementMetrics.replies)}
          subtitle="total replies"
          sparklineData={generateSparklineData('posts').map(v => v * 3)} // Simulate reply activity
        />
        <MetricCard
          icon={<Share2 size={20} />}
          title={
            <Tooltip
              content={
                <>
                  <h4>Amplification</h4>
                  <p>How often your posts are reposted, spreading your content beyond your immediate followers.</p>
                  <p className="scale-info">
                    • Reposts extend your reach exponentially<br/>
                    • High repost counts indicate shareable content<br/>
                    • Average: {contentAnalysis.totalPosts > 0 ? (engagementMetrics.reposts / contentAnalysis.totalPosts).toFixed(1) : '0'} reposts per post
                  </p>
                </>
              }
              position="top"
              maxWidth={300}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Amplification
                <HelpCircle size={14} style={{ opacity: 0.5 }} />
              </span>
            </Tooltip>
          }
          value={formatNumber(engagementMetrics.reposts)}
          subtitle="total reposts"
          sparklineData={generateSparklineData('posts').map(v => v * 2)} // Simulate repost activity
        />
      </section>

      {/* Content Performance */}
      <section className="analytics-section">
        <h3>Content Performance</h3>
        <ContentPerformance 
          posts={analytics.posts}
          contentAnalysis={contentAnalysis}
        />
      </section>

      {/* Temporal Patterns */}
      <section className="analytics-section">
        <h3>Best Times to Post</h3>
        <TemporalHeatmap patterns={analytics.temporalPatterns} />
      </section>

      {/* Network Analysis - New Actionable Version */}
      <section className="analytics-section">
        <NetworkHealthActionable 
          metrics={analytics.networkMetrics}
          totalPosts={contentAnalysis.totalPosts}
          engagementRate={engagementMetrics.engagementRate}
          followerGrowth={analytics.historicalData?.followerGrowth ? {
            percentChange: analytics.historicalData.followerGrowth.percentChange,
            trend: analytics.historicalData.followerGrowth.percentChange > 0 ? 'up' : 
                  analytics.historicalData.followerGrowth.percentChange < 0 ? 'down' : 'stable'
          } : undefined}
          onComposePost={(template) => {
            // Open compose modal with optional template
            const event = new CustomEvent('openComposeModal', { detail: { template } })
            window.dispatchEvent(event)
          }}
        />
      </section>

      {/* Content Insights */}
      <section className="analytics-section">
        <h3>Content Insights</h3>
        <div className="content-insights">
          <div className="insight-card">
            <h4>Top Hashtags</h4>
            <div className="hashtag-list">
              {contentAnalysis.topHashtags.slice(0, 5).map(tag => (
                <div key={tag.tag} className="hashtag-item">
                  <span className="hashtag">{tag.tag}</span>
                  <span className="count">{tag.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="insight-card">
            <h4>Content Mix</h4>
            <div className="content-mix">
              <div className="mix-item">
                <div className="mix-bar" style={{ width: `${(contentAnalysis.postsWithMedia / contentAnalysis.totalPosts) * 100}%` }} />
                <span>Media Posts ({Math.round((contentAnalysis.postsWithMedia / contentAnalysis.totalPosts) * 100)}%)</span>
              </div>
              <div className="mix-item">
                <div className="mix-bar" style={{ width: `${(contentAnalysis.threads / contentAnalysis.totalPosts) * 100}%` }} />
                <span>Threads ({Math.round((contentAnalysis.threads / contentAnalysis.totalPosts) * 100)}%)</span>
              </div>
              <div className="mix-item">
                <div className="mix-bar" style={{ width: `${(contentAnalysis.quotes / contentAnalysis.totalPosts) * 100}%` }} />
                <span>Quote Posts ({Math.round((contentAnalysis.quotes / contentAnalysis.totalPosts) * 100)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actionable Insights */}
      <section className="analytics-section">
        <h3>Insights & Recommendations</h3>
        <div className="insights-list">
          {generateInsights({
            temporalPatterns: analytics.temporalPatterns,
            engagementQuality,
            contentAnalysis,
            engagementMetrics
          }).map((insight, index) => (
            <motion.div 
              key={insight.title}
              className="insight-recommendation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="insight-icon">{insight.icon}</div>
              <div className="insight-content">
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}