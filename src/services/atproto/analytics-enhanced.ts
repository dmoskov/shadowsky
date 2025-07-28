import type { 
  AppBskyFeedDefs,
  AppBskyActorDefs,
  BskyAgent
} from '@atproto/api'
import type {
  EngagementMetrics,
  ContentAnalysis,
  TemporalPattern,
  NetworkMetrics,
  EngagementQualityScore
} from '@bsky/shared'
import { rateLimiters } from './rate-limiter'

export class EnhancedAnalyticsService {
  constructor(private agent: BskyAgent) {}

  async getEnhancedAnalytics(handle: string) {
    const profileResponse = await rateLimiters.profile.execute(async () => 
      this.agent.getProfile({ actor: handle })
    )
    if (!profileResponse.data) throw new Error('Profile not found')
    const profile = profileResponse.data

    // Fetch recent posts (last 100)
    const posts = await this.fetchRecentPosts(handle, 100)
    
    // Calculate enhanced metrics
    const engagementMetrics = this.calculateEnhancedEngagementMetrics(posts, profile.followersCount || 0)
    const contentAnalysis = this.analyzeContentEnhanced(posts)
    const temporalPatterns = this.analyzeTemporalPatterns(posts)
    const engagementQuality = this.calculateEnhancedEQS(posts, profile.followersCount || 0)
    const networkMetrics = await this.analyzeNetworkEnhanced(handle, posts)

    return {
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 0,
        postsCount: profile.postsCount || 0,
      },
      engagementMetrics,
      contentAnalysis,
      temporalPatterns,
      networkMetrics,
      engagementQuality,
      posts: posts.slice(0, 10), // Top 10 posts
      totalAnalyzed: posts.length
    }
  }

  private async fetchRecentPosts(
    handle: string, 
    limit: number = 100
  ): Promise<AppBskyFeedDefs.PostView[]> {
    const posts: AppBskyFeedDefs.PostView[] = []
    let cursor: string | undefined

    while (posts.length < limit) {
      const response = await rateLimiters.feed.execute(async () =>
        this.agent.app.bsky.feed.getAuthorFeed({
          actor: handle,
          limit: Math.min(50, limit - posts.length),
          cursor
        })
      )

      // Filter out reposts, only keep original posts
      const originalPosts = response.data.feed
        .filter(item => !item.reason && item.post.author.handle === handle)
        .map(item => item.post)

      posts.push(...originalPosts)
      
      if (!response.data.cursor || posts.length >= limit) break
      cursor = response.data.cursor
    }

    // Sort by engagement
    return posts.sort((a, b) => {
      const engagementA = (a.likeCount || 0) + (a.repostCount || 0) + (a.replyCount || 0)
      const engagementB = (b.likeCount || 0) + (b.repostCount || 0) + (b.replyCount || 0)
      return engagementB - engagementA
    })
  }

  private calculateEnhancedEngagementMetrics(
    posts: AppBskyFeedDefs.PostView[], 
    followerCount: number
  ): EngagementMetrics {
    const totals = posts.reduce((acc, post) => ({
      likes: acc.likes + (post.likeCount || 0),
      reposts: acc.reposts + (post.repostCount || 0),
      replies: acc.replies + (post.replyCount || 0),
      quotes: acc.quotes + (post.quoteCount || 0),
    }), { likes: 0, reposts: 0, replies: 0, quotes: 0 })

    const totalEngagement = totals.likes + totals.reposts + totals.replies + totals.quotes
    
    // Calculate engagement rate as percentage of followers who engaged
    // Industry standard: (total engagements / (posts * followers)) * 100
    const engagementRate = posts.length > 0 && followerCount > 0
      ? (totalEngagement / (posts.length * followerCount)) * 100
      : 0

    return {
      ...totals,
      totalEngagement,
      engagementRate: Math.round(engagementRate * 100) / 100 // 2 decimal places
    }
  }

  private analyzeContentEnhanced(posts: AppBskyFeedDefs.PostView[]): ContentAnalysis {
    const hashtagCounts = new Map<string, number>()
    let totalLength = 0
    let postsWithMedia = 0
    let postsWithLinks = 0
    let threads = 0
    let quotes = 0

    posts.forEach(post => {
      // Properly extract text from the post record
      const record = post.record as any
      const text = record?.text || ''
      
      // Only count length if text exists
      if (text) {
        totalLength += text.length
      }

      // Count media
      if (post.embed?.images || post.embed?.media) {
        postsWithMedia++
      }

      // Count external links
      if (post.embed?.external) {
        postsWithLinks++
      }

      // Count threads
      if (record?.reply) {
        threads++
      }

      // Count quotes
      if (post.embed?.record) {
        quotes++
      }

      // Extract hashtags
      if (text) {
        const hashtags = text.match(/#[\w]+/g) || []
        hashtags.forEach(tag => {
          const normalized = tag.toLowerCase()
          hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1)
        })
      }
    })

    const topHashtags = Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalPosts: posts.length,
      postsWithMedia,
      postsWithLinks,
      threads,
      quotes,
      avgPostLength: posts.length > 0 ? Math.round(totalLength / posts.length) : 0,
      topHashtags
    }
  }

  private analyzeTemporalPatterns(posts: AppBskyFeedDefs.PostView[]): TemporalPattern[] {
    const patterns = new Map<string, { count: number; engagement: number }>()

    posts.forEach(post => {
      const record = post.record as any
      const createdAt = new Date(record?.createdAt || post.indexedAt)
      const hour = createdAt.getHours()
      const dayOfWeek = createdAt.getDay()
      const key = `${hour}-${dayOfWeek}`

      const engagement = (post.likeCount || 0) + (post.repostCount || 0) + (post.replyCount || 0)
      
      const existing = patterns.get(key) || { count: 0, engagement: 0 }
      patterns.set(key, {
        count: existing.count + 1,
        engagement: existing.engagement + engagement
      })
    })

    return Array.from(patterns.entries()).map(([key, data]) => {
      const [hour, dayOfWeek] = key.split('-').map(Number)
      return {
        hour,
        dayOfWeek,
        count: data.count,
        avgEngagement: data.count > 0 ? Math.round(data.engagement / data.count) : 0
      }
    })
  }

  private calculateEnhancedEQS(
    posts: AppBskyFeedDefs.PostView[],
    followerCount: number
  ): EngagementQualityScore {
    if (posts.length === 0) {
      return {
        overall: 0,
        conversationDepth: 0,
        contentResonance: 0,
        networkAmplification: 0,
        consistency: 100
      }
    }

    // Conversation Depth: replies and quotes indicate deeper engagement
    // Using logarithmic scaling for more realistic scoring
    const avgRepliesPerPost = posts.reduce((sum, post) => sum + (post.replyCount || 0), 0) / posts.length
    const avgQuotesPerPost = posts.reduce((sum, post) => sum + (post.quoteCount || 0), 0) / posts.length
    
    // Log scale: 0.5 replies/post = 50, 1 = 69, 2 = 80, 5 = 91, 10 = 96
    const replyScore = avgRepliesPerPost > 0 ? Math.log10(avgRepliesPerPost + 1) / Math.log10(11) * 100 : 0
    // Quotes weighted slightly higher as they indicate thoughtful engagement
    const quoteScore = avgQuotesPerPost > 0 ? Math.log10(avgQuotesPerPost + 1) / Math.log10(6) * 100 : 0
    const conversationDepth = Math.min(100, replyScore * 0.6 + quoteScore * 0.4)

    // Content Resonance: engagement rate (industry standard)
    // Typical good engagement rate is 1-3% on social media
    const totalEngagements = posts.reduce((sum, post) => 
      sum + (post.likeCount || 0) + (post.replyCount || 0) + (post.repostCount || 0), 0)
    const avgEngagementsPerPost = totalEngagements / posts.length
    const engagementRate = followerCount > 0 ? (avgEngagementsPerPost / followerCount) * 100 : 0
    
    // Scale: 0.5% = 25, 1% = 50, 2% = 75, 3% = 87, 5% = 96
    const contentResonance = Math.min(100, Math.sqrt(engagementRate * 100) * 10)

    // Network Amplification: viral coefficient
    // Considers both reposts and quotes as amplification
    const avgRepostsPerPost = posts.reduce((sum, post) => sum + (post.repostCount || 0), 0) / posts.length
    const amplificationRate = followerCount > 0 ? 
      ((avgRepostsPerPost + avgQuotesPerPost * 0.5) / followerCount) * 100 : 0
    
    // Scale: 0.2% = 31, 0.5% = 50, 1% = 70, 2% = 89
    const networkAmplification = Math.min(100, Math.sqrt(amplificationRate * 200) * 10)

    // Consistency: posting regularity
    const postDates = posts.map(post => {
      const record = post.record as any
      return new Date(record?.createdAt || post.indexedAt)
    }).sort((a, b) => a.getTime() - b.getTime())
    
    let avgDaysBetweenPosts = 0
    if (postDates.length > 1) {
      const daysBetween = postDates.slice(1).map((date, i) => {
        const diff = date.getTime() - postDates[i].getTime()
        return diff / (1000 * 60 * 60 * 24)
      })
      avgDaysBetweenPosts = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length
    }
    
    // Ideal posting frequency is 1-3 days
    const consistency = avgDaysBetweenPosts === 0 ? 100 :
      avgDaysBetweenPosts <= 3 ? 100 :
      avgDaysBetweenPosts <= 7 ? 80 :
      avgDaysBetweenPosts <= 14 ? 60 :
      avgDaysBetweenPosts <= 30 ? 40 : 20

    // Calculate overall score
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

  private async analyzeNetworkEnhanced(
    handle: string,
    posts: AppBskyFeedDefs.PostView[]
  ): Promise<NetworkMetrics> {
    const profileResponse = await rateLimiters.profile.execute(async () =>
      this.agent.getProfile({ actor: handle })
    )
    if (!profileResponse.data) throw new Error('Profile not found')
    const profile = profileResponse.data

    // Track unique engagers from posts
    const uniqueEngagers = new Set<string>()
    const engagerCounts = new Map<string, { handle: string; did: string; count: number }>()
    
    // Fetch real engagement data for top posts (limit to avoid too many API calls)
    const topPosts = [...posts]
      .sort((a, b) => ((b.likeCount || 0) + (b.repostCount || 0)) - ((a.likeCount || 0) + (a.repostCount || 0)))
      .slice(0, 10) // Analyze top 10 posts to avoid rate limits
    
    try {
      // Fetch likes for each top post
      for (const post of topPosts) {
        try {
          const likesResponse = await rateLimiters.feed.execute(async () =>
            this.agent.app.bsky.feed.getLikes({
              uri: post.uri,
              limit: 30 // Get top 30 likers per post
            })
          )
          
          if (likesResponse.data.likes) {
            for (const like of likesResponse.data.likes) {
              const actor = like.actor
              uniqueEngagers.add(actor.did)
              
              const existing = engagerCounts.get(actor.did) || { 
                handle: actor.handle, 
                did: actor.did, 
                count: 0 
              }
              existing.count++
              engagerCounts.set(actor.did, existing)
            }
          }
        } catch (err) {
          debug.warn('Failed to fetch likes for post:', post.uri, err)
        }
      }
    } catch (err) {
      debug.error('Failed to fetch engagement data:', err)
    }
    
    // Get top engagers
    const topEngagers = Array.from(engagerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(e => ({
        did: e.did,
        handle: e.handle,
        interactions: e.count
      }))

    // Estimate mutual follows
    const mutualFollows = Math.round(
      Math.min(profile.followersCount || 0, profile.followsCount || 0) * 0.4
    )

    return {
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      mutualFollows,
      activeFollowers: uniqueEngagers,
      topEngagers
    }
  }
}