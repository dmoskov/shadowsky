import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageSquare, Repeat, Quote, TrendingUp } from 'lucide-react'
import type { AppBskyFeedDefs } from '@atproto/api'
import type { ContentAnalysis } from '../../services/atproto/analytics'
import { formatNumber, formatRelativeTime } from '../../utils/format-helpers'

interface Props {
  posts: AppBskyFeedDefs.PostView[]
  contentAnalysis: ContentAnalysis
}

export const ContentPerformance: React.FC<Props> = ({ posts, contentAnalysis }) => {
  const [selectedMetric, setSelectedMetric] = useState<'engagement' | 'quality'>('engagement')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  const calculateQualityScore = (post: AppBskyFeedDefs.PostView) => {
    const likes = post.likeCount || 0
    const replies = post.replyCount || 0
    const reposts = post.repostCount || 0
    const quotes = post.quoteCount || 0
    
    // Quality score favors replies and quotes over simple likes
    return (replies * 3) + (quotes * 2.5) + (reposts * 2) + likes
  }

  const sortedPosts = [...posts].sort((a, b) => {
    if (selectedMetric === 'quality') {
      return calculateQualityScore(b) - calculateQualityScore(a)
    }
    const engagementA = (a.likeCount || 0) + (a.repostCount || 0) + (a.replyCount || 0)
    const engagementB = (b.likeCount || 0) + (b.repostCount || 0) + (b.replyCount || 0)
    return engagementB - engagementA
  })

  return (
    <div className="content-performance">
      <div className="performance-header">
        <div className="metric-selector">
          <button 
            className={selectedMetric === 'engagement' ? 'active' : ''}
            onClick={() => setSelectedMetric('engagement')}
          >
            Total Engagement
          </button>
          <button 
            className={selectedMetric === 'quality' ? 'active' : ''}
            onClick={() => setSelectedMetric('quality')}
          >
            Quality Score
          </button>
        </div>
        <div className="content-stats">
          <span>{contentAnalysis.totalPosts} posts analyzed</span>
        </div>
      </div>

      <div className="top-posts">
        {sortedPosts.slice(0, 5).map((post, index) => {
          const record = post.record as any
          const text = record?.text || ''
          const isExpanded = expandedPost === post.uri
          const displayText = isExpanded || text.length <= 280 
            ? text 
            : text.slice(0, 280) + '...'
          
          return (
            <motion.div 
              key={post.uri}
              className="performance-post"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="post-rank">#{index + 1}</div>
              
              <div className="post-content" onClick={() => setExpandedPost(isExpanded ? null : post.uri)}>
                <p className="post-text">{displayText}</p>
                {text.length > 280 && !isExpanded && (
                  <button className="expand-btn">Show more</button>
                )}
                <div className="post-meta">
                  <span className="post-time">
                    {formatRelativeTime(new Date(record?.createdAt || post.indexedAt))}
                  </span>
                  {post.embed?.images && (
                    <span className="post-indicator">📷</span>
                  )}
                  {post.embed?.external && (
                    <span className="post-indicator">🔗</span>
                  )}
                  {record?.reply && (
                    <span className="post-indicator">💬</span>
                  )}
                </div>
              </div>
              
              <div className="post-metrics">
                <div className="metric-item">
                  <Heart size={16} className={post.viewer?.like ? 'liked' : ''} />
                  <span>{formatNumber(post.likeCount || 0)}</span>
                </div>
                <div className="metric-item">
                  <Repeat size={16} className={post.viewer?.repost ? 'reposted' : ''} />
                  <span>{formatNumber(post.repostCount || 0)}</span>
                </div>
                <div className="metric-item">
                  <MessageSquare size={16} />
                  <span>{formatNumber(post.replyCount || 0)}</span>
                </div>
                {post.quoteCount && post.quoteCount > 0 && (
                  <div className="metric-item">
                    <Quote size={16} />
                    <span>{formatNumber(post.quoteCount)}</span>
                  </div>
                )}
              </div>
              
              {selectedMetric === 'quality' && (
                <div className="quality-score">
                  <TrendingUp size={16} />
                  <span>{calculateQualityScore(post)}</span>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}