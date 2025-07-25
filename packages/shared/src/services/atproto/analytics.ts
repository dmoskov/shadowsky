import type { 
  AppBskyFeedDefs,
  BskyAgent
} from '@atproto/api'

export interface EngagementMetrics {
  likes: number
  reposts: number
  replies: number
  quotes: number
  totalEngagement: number
  engagementRate: number
  avgLikesPerPost: number
  avgRepostsPerPost: number
  avgRepliesPerPost: number
}

export interface ContentAnalysis {
  totalPosts: number
  postsWithMedia: number
  postsWithLinks?: number
  threads: number
  replies?: number
  quotes: number
  avgPostLength: number
  topHashtags: Array<{ tag: string; count: number }>
  postTypes?: {
    original: number
    replies: number
    threads: number
    media: number
  }
}

export interface TemporalPattern {
  hour: number
  dayOfWeek: number
  count: number
  avgEngagement: number
}

export interface NetworkMetrics {
  followers: number
  following: number
  mutualFollows: number
  activeFollowers: Set<string>
  topEngagers: Array<{ did: string; handle: string; interactions: number }>
}

export interface EngagementQualityScore {
  overall: number
  conversationDepth: number
  contentResonance: number
  networkAmplification: number
  consistency: number
}

export class AnalyticsService {
  constructor(private agent: BskyAgent) {}

  async getProfileAnalytics(handle: string) {
    const profileResponse = await this.agent.getProfile({ actor: handle })
    if (!profileResponse.data) throw new Error('Profile not found')
    const profile = profileResponse.data

    // Fetch recent posts (last 100)
    const posts = await this.fetchRecentPosts(handle, 100)
    
    // Calculate metrics
    const engagementMetrics = this.calculateEngagementMetrics(posts)
    const contentAnalysis = this.analyzeContent(posts)
    const temporalPatterns = this.analyzeTemporalPatterns(posts)
    const engagementQuality = await this.calculateEngagementQualityScore(
      posts, 
      profile.followersCount || 0
    )

    // Get network metrics (sample for performance)
    const networkMetrics = await this.analyzeNetwork(handle, posts)

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
      posts: posts.slice(0, 10) // Top 10 posts
    }
  }

  private async fetchRecentPosts(
    handle: string, 
    limit: number = 100
  ): Promise<AppBskyFeedDefs.PostView[]> {
    const posts: AppBskyFeedDefs.PostView[] = []
    let cursor: string | undefined

    while (posts.length < limit) {
      const response = await this.agent.app.bsky.feed.getAuthorFeed({
        actor: handle,
        limit: Math.min(50, limit - posts.length),
        cursor
      })

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

  private calculateEngagementMetrics(posts: AppBskyFeedDefs.PostView[]): EngagementMetrics {
    const totals = posts.reduce((acc, post) => ({
      likes: acc.likes + (post.likeCount || 0),
      reposts: acc.reposts + (post.repostCount || 0),
      replies: acc.replies + (post.replyCount || 0),
      quotes: acc.quotes + (post.quoteCount || 0),
    }), { likes: 0, reposts: 0, replies: 0, quotes: 0 })

    const totalEngagement = totals.likes + totals.reposts + totals.replies + totals.quotes
    
    // Calculate average engagement per post
    const avgEngagementPerPost = posts.length > 0 ? totalEngagement / posts.length : 0

    return {
      ...totals,
      totalEngagement,
      engagementRate: Math.round(avgEngagementPerPost * 10) / 10
    }
  }

  private analyzeContent(posts: AppBskyFeedDefs.PostView[]): ContentAnalysis {
    const hashtagCounts = new Map<string, number>()
    let totalLength = 0
    let postsWithMedia = 0
    let postsWithLinks = 0
    let threads = 0
    let quotes = 0

    posts.forEach(post => {
      const record = post.record as any
      const text = record?.text || ''
      totalLength += text.length

      // Count media
      if (post.embed?.images || post.embed?.media) {
        postsWithMedia++
      }

      // Count external links
      if (post.embed?.external) {
        postsWithLinks++
      }

      // Count threads
      if (record?.value?.reply) {
        threads++
      }

      // Count quotes
      if (post.embed?.record) {
        quotes++
      }

      // Extract hashtags
      const hashtags = text.match(/#[\w]+/g) || []
      hashtags.forEach(tag => {
        const normalized = tag.toLowerCase()
        hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1)
      })
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
      avgPostLength: Math.round(totalLength / Math.max(posts.length, 1)),
      topHashtags
    }
  }

  private analyzeTemporalPatterns(posts: AppBskyFeedDefs.PostView[]): TemporalPattern[] {
    const patterns = new Map<string, { count: number; engagement: number }>()

    posts.forEach(post => {
      const record = post.record as any
      const createdAt = new Date(record?.value?.createdAt || post.indexedAt)
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
        avgEngagement: Math.round(data.engagement / data.count)
      }
    })
  }

  private async calculateEngagementQualityScore(
    posts: AppBskyFeedDefs.PostView[],
    followerCount: number
  ): Promise<EngagementQualityScore> {
    // Conversation Depth: replies and quotes indicate deeper engagement
    const avgRepliesPerPost = posts.reduce((sum, post) => sum + (post.replyCount || 0), 0) / Math.max(posts.length, 1)
    const avgQuotesPerPost = posts.reduce((sum, post) => sum + (post.quoteCount || 0), 0) / Math.max(posts.length, 1)
    const conversationDepth = Math.min(100, (avgRepliesPerPost + avgQuotesPerPost * 2) * 10)

    // Content Resonance: engagement relative to follower count
    const avgEngagement = posts.reduce((sum, post) => {
      return sum + (post.likeCount || 0) + (post.repostCount || 0) + (post.replyCount || 0)
    }, 0) / Math.max(posts.length, 1)
    const engagementRate = followerCount > 0 ? (avgEngagement / followerCount) * 100 : 0
    const contentResonance = Math.min(100, engagementRate * 20)

    // Network Amplification: how far content spreads
    const avgRepostsPerPost = posts.reduce((sum, post) => sum + (post.repostCount || 0), 0) / Math.max(posts.length, 1)
    const networkAmplification = Math.min(100, avgRepostsPerPost * 15)

    // Consistency: posting regularity
    const postDates = posts.map(post => {
      const record = post.record as any
      return new Date(record?.value?.createdAt || post.indexedAt)
    }).sort((a, b) => a.getTime() - b.getTime())
    
    let avgDaysBetweenPosts = 0
    if (postDates.length > 1) {
      const daysBetween = postDates.slice(1).map((date, i) => {
        const diff = date.getTime() - postDates[i].getTime()
        return diff / (1000 * 60 * 60 * 24)
      })
      avgDaysBetweenPosts = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length
    }
    const consistency = Math.max(0, Math.min(100, 100 - (avgDaysBetweenPosts - 1) * 10))

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

  private async analyzeNetwork(
    handle: string,
    posts: AppBskyFeedDefs.PostView[]
  ): Promise<NetworkMetrics> {
    // Get profile for counts
    const profileResponse = await this.agent.getProfile({ actor: handle })
    if (!profileResponse.data) throw new Error('Profile not found')
    const profile = profileResponse.data

    // Track who engages with posts
    const engagers = new Map<string, { handle: string; interactions: number }>()
    
    // Analyze engagement from posts (this is a simplified version)
    // In a full implementation, we'd fetch likes/reposts for each post
    posts.forEach(post => {
      // Track post authors in threads
      const record = post.record as any
      if (record?.value?.reply) {
        // This is a reply, so there's engagement happening
        const authorDid = post.author.did
        const existing = engagers.get(authorDid) || { 
          handle: post.author.handle, 
          interactions: 0 
        }
        existing.interactions++
        engagers.set(authorDid, existing)
      }
    })

    // Get top engagers
    const topEngagers = Array.from(engagers.values())
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 20)

    // For MVP, we'll estimate mutual follows as ~30% of smaller follow count
    const mutualFollows = Math.round(
      Math.min(profile.followersCount || 0, profile.followsCount || 0) * 0.3
    )

    return {
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      mutualFollows,
      activeFollowers: new Set(topEngagers.map(e => e.handle)),
      topEngagers
    }
  }

  async getPostDetails(uri: string) {
    const response = await this.agent.app.bsky.feed.getPostThread({
      uri,
      depth: 3
    })

    if (!response.data.thread.post) {
      throw new Error('Post not found')
    }

    return response.data.thread
  }
}