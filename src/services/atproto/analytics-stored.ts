import { getAnalyticsDB } from '../analytics-db'
import type { 
  EngagementMetrics, 
  ContentAnalysis, 
  EngagementQualityScore as EngagementQuality,
  NetworkMetrics,
  TemporalPattern
} from './analytics'
import type { AppBskyActorDefs, AppBskyFeedDefs } from '@atproto/api'

export interface AnalyticsData {
  profile: AppBskyActorDefs.ProfileView
  posts: AppBskyFeedDefs.PostView[]
  engagementMetrics: EngagementMetrics
  contentAnalysis: ContentAnalysis
  temporalPatterns: TemporalPattern[]
  engagementQuality: EngagementQuality
  networkMetrics: NetworkMetrics
  historicalData?: {
    snapshots: Array<{
      date: string
      followersCount: number
      followingCount: number
      postsCount: number
      engagementRate: number
      totalLikes: number
      totalReposts: number
      totalReplies: number
      postsToday: number
    }>
    followerGrowth: {
      dailyGrowth: number[]
      percentChange: number
      totalGained: number
    }
    engagementTrend: {
      trend: 'up' | 'down' | 'stable'
      percentChange: number
    }
  }
}

export class StoredAnalyticsService {
  /**
   * Get analytics data from stored database
   */
  async getStoredAnalytics(userDid: string, timeRange: string = '30d'): Promise<AnalyticsData> {
    const db = await getAnalyticsDB()
    
    // Parse time range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // Get user data
    const user = await db.getUser(userDid)
    if (!user) throw new Error('User not found in database')
    
    // Get posts within time range
    const allPosts = await db.getPostsForUser(userDid)
    const posts = allPosts.filter(p => new Date(p.createdAt) >= startDate)
    
    // Get snapshots for trend data
    const snapshots = await db.getSnapshots(userDid, days)
    
    // Get active engagers
    const topEngagers = await db.getTopEngagers(userDid)
    
    // Build profile (using latest snapshot for current metrics)
    const latestSnapshot = snapshots[snapshots.length - 1]
    const profile: AppBskyActorDefs.ProfileView = {
      did: user.did,
      handle: user.handle,
      displayName: user.displayName,
      followersCount: latestSnapshot?.followersCount || 0,
      followsCount: latestSnapshot?.followingCount || 0,
      postsCount: latestSnapshot?.postsCount || 0,
      description: '',
      indexedAt: new Date().toISOString()
    }
    
    // Calculate engagement metrics
    const engagementMetrics = this.calculateEngagementMetrics(posts, profile.followersCount || 0)
    
    // Analyze content
    const contentAnalysis = this.analyzeContent(posts)
    
    // Calculate engagement quality
    const engagementQuality = this.calculateEngagementQuality(posts, engagementMetrics)
    
    // Analyze temporal patterns
    const temporalPatterns = this.analyzeTemporalPatterns(posts)
    
    // Build network metrics
    const networkMetrics: NetworkMetrics = {
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      mutualFollows: Math.round(Math.min(profile.followersCount || 0, profile.followsCount || 0) * 0.4),
      activeFollowers: new Set(topEngagers.map(e => e.engagerDid)),
      topEngagers: topEngagers.map(e => ({
        did: e.engagerDid,
        handle: e.engagerHandle,
        interactions: e.totalInteractions
      }))
    }
    
    // Convert stored posts to PostView format (simplified)
    const postViews: AppBskyFeedDefs.PostView[] = posts.map(p => ({
      uri: p.uri,
      cid: p.cid,
      author: profile,
      record: {
        text: p.text,
        createdAt: p.createdAt.toISOString(),
        $type: 'app.bsky.feed.post'
      },
      likeCount: p.likeCount,
      repostCount: p.repostCount,
      replyCount: p.replyCount,
      quoteCount: p.quoteCount,
      indexedAt: p.lastUpdated.toISOString()
    }))
    
    return {
      profile,
      posts: postViews,
      engagementMetrics,
      contentAnalysis,
      temporalPatterns,
      engagementQuality,
      networkMetrics,
      historicalData: {
        snapshots,
        followerGrowth: this.calculateFollowerGrowth(snapshots),
        engagementTrend: this.calculateEngagementTrend(snapshots)
      }
    }
  }
  
  private calculateEngagementMetrics(posts: any[], followerCount: number): EngagementMetrics {
    const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0)
    const totalReposts = posts.reduce((sum, p) => sum + p.repostCount, 0)
    const totalReplies = posts.reduce((sum, p) => sum + p.replyCount, 0)
    const totalQuotes = posts.reduce((sum, p) => sum + (p.quoteCount || 0), 0)
    
    const totalEngagement = totalLikes + totalReposts + totalReplies + totalQuotes
    const engagementRate = followerCount > 0 && posts.length > 0
      ? (totalEngagement / (posts.length * followerCount)) * 100
      : 0
    
    return {
      likes: totalLikes,
      reposts: totalReposts,
      replies: totalReplies,
      quotes: totalQuotes,
      totalEngagement,
      engagementRate: Math.round(engagementRate * 100) / 100,
      avgLikesPerPost: posts.length > 0 ? totalLikes / posts.length : 0,
      avgRepostsPerPost: posts.length > 0 ? totalReposts / posts.length : 0,
      avgRepliesPerPost: posts.length > 0 ? totalReplies / posts.length : 0
    }
  }
  
  private analyzeContent(posts: any[]): ContentAnalysis {
    const totalPosts = posts.length
    const postsWithMedia = posts.filter(p => p.hasMedia).length
    const threads = posts.filter(p => p.isThread).length
    const replies = posts.filter(p => p.isReply).length
    const quotes = posts.filter(p => p.quoteCount > 0).length
    
    // Extract hashtags
    const hashtagCounts = new Map<string, number>()
    posts.forEach(post => {
      const hashtags = post.text.match(/#\w+/g) || []
      hashtags.forEach(tag => {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1)
      })
    })
    
    const topHashtags = Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    // Calculate average post length
    const totalChars = posts.reduce((sum, p) => sum + p.text.length, 0)
    const avgPostLength = totalPosts > 0 ? Math.round(totalChars / totalPosts) : 0
    
    return {
      totalPosts,
      postsWithMedia,
      threads,
      replies,
      quotes,
      avgPostLength,
      topHashtags,
      postTypes: {
        original: totalPosts - replies,
        replies,
        threads,
        media: postsWithMedia
      }
    }
  }
  
  private calculateEngagementQuality(posts: any[], metrics: EngagementMetrics): EngagementQuality {
    const followerCount = posts[0]?.followerCount || 1 // Avoid division by zero
    
    // Calculate conversation depth with logarithmic scaling
    const avgRepliesPerPost = metrics.avgRepliesPerPost
    const avgQuotesPerPost = posts.length > 0 
      ? posts.reduce((sum, p) => sum + (p.quoteCount || 0), 0) / posts.length 
      : 0
    
    const replyScore = avgRepliesPerPost > 0 ? Math.log10(avgRepliesPerPost + 1) / Math.log10(11) * 100 : 0
    const quoteScore = avgQuotesPerPost > 0 ? Math.log10(avgQuotesPerPost + 1) / Math.log10(6) * 100 : 0
    const conversationDepth = Math.min(100, replyScore * 0.6 + quoteScore * 0.4)
    
    // Calculate content resonance using engagement rate
    const totalEngagements = posts.reduce((sum, p) => 
      sum + p.likeCount + p.repostCount + p.replyCount, 0)
    const avgEngagementsPerPost = posts.length > 0 ? totalEngagements / posts.length : 0
    const engagementRate = (avgEngagementsPerPost / followerCount) * 100
    const contentResonance = Math.min(100, Math.sqrt(engagementRate * 100) * 10)
    
    // Calculate network amplification
    const avgRepostsPerPost = metrics.avgRepostsPerPost
    const amplificationRate = ((avgRepostsPerPost + avgQuotesPerPost * 0.5) / followerCount) * 100
    const networkAmplification = Math.min(100, Math.sqrt(amplificationRate * 200) * 10)
    
    // Calculate consistency
    let consistency = 100
    if (posts.length > 1) {
      const postDates = posts.map(p => new Date(p.createdAt)).sort((a, b) => a.getTime() - b.getTime())
      const daysBetween = postDates.slice(1).map((date, i) => {
        const diff = date.getTime() - postDates[i].getTime()
        return diff / (1000 * 60 * 60 * 24)
      })
      const avgDaysBetween = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length
      
      consistency = avgDaysBetween <= 3 ? 100 :
        avgDaysBetween <= 7 ? 80 :
        avgDaysBetween <= 14 ? 60 :
        avgDaysBetween <= 30 ? 40 : 20
    }
    
    const overall = Math.round(
      conversationDepth * 0.3 +
      contentResonance * 0.3 +
      networkAmplification * 0.2 +
      consistency * 0.2
    )
    
    return {
      overall,
      conversationDepth: Math.round(conversationDepth),
      contentResonance: Math.round(contentResonance),
      networkAmplification: Math.round(networkAmplification),
      consistency: Math.round(consistency)
    }
  }
  
  private analyzeTemporalPatterns(posts: any[]): TemporalPattern[] {
    const patterns = new Map<string, { count: number; engagement: number }>()
    
    posts.forEach(post => {
      const date = new Date(post.createdAt)
      const hour = date.getHours()
      const day = date.getDay()
      const key = `${day}-${hour}`
      
      const existing = patterns.get(key) || { count: 0, engagement: 0 }
      existing.count++
      existing.engagement += post.likeCount + post.repostCount + post.replyCount
      patterns.set(key, existing)
    })
    
    return Array.from(patterns.entries()).map(([key, data]) => {
      const [day, hour] = key.split('-').map(Number)
      return {
        hour,
        dayOfWeek: day,
        count: data.count,
        avgEngagement: data.engagement / data.count
      }
    })
  }
  
  private calculateFollowerGrowth(snapshots: any[]): {
    dailyGrowth: number[]
    percentChange: number
    totalGained: number
  } {
    if (snapshots.length < 2) {
      return { dailyGrowth: [], percentChange: 0, totalGained: 0 }
    }
    
    const dailyGrowth = snapshots.slice(1).map((snapshot, i) => {
      return snapshot.followersCount - snapshots[i].followersCount
    })
    
    const first = snapshots[0].followersCount
    const last = snapshots[snapshots.length - 1].followersCount
    const totalGained = last - first
    const percentChange = first > 0 ? ((last - first) / first) * 100 : 0
    
    return {
      dailyGrowth,
      percentChange: Math.round(percentChange * 100) / 100,
      totalGained
    }
  }
  
  private calculateEngagementTrend(snapshots: any[]): {
    trend: 'up' | 'down' | 'stable'
    percentChange: number
  } {
    if (snapshots.length < 2) {
      return { trend: 'stable', percentChange: 0 }
    }
    
    // Compare average engagement rate of first half vs second half
    const midPoint = Math.floor(snapshots.length / 2)
    const firstHalf = snapshots.slice(0, midPoint)
    const secondHalf = snapshots.slice(midPoint)
    
    const avgFirst = firstHalf.reduce((sum, s) => sum + s.engagementRate, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.engagementRate, 0) / secondHalf.length
    
    const percentChange = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0
    const trend = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable'
    
    return {
      trend,
      percentChange: Math.round(percentChange * 100) / 100
    }
  }
}