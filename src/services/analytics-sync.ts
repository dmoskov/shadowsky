import { AtpAgent } from '@atproto/api'
import type { AppBskyFeedDefs, AppBskyActorDefs } from '@atproto/api'
import { getAnalyticsDB, type StoredPost, type StoredUser, type DailySnapshot, type EngagementHistory, type ActiveEngager } from './analytics-db'
import { rateLimiters } from './atproto/rate-limiter'
import { debug } from '@bsky/shared'

export class AnalyticsSyncService {
  constructor(private agent: AtpAgent) {}
  
  /**
   * Sync all data for a user
   */
  async syncUserData(handle: string, options?: {
    onProgress?: (message: string, percent: number) => void
    fullSync?: boolean
  }): Promise<void> {
    const db = await getAnalyticsDB()
    const progress = options?.onProgress || (() => {})
    
    try {
      // 1. Get user profile
      progress('Fetching user profile...', 5)
      const profileRes = await rateLimiters.profile.execute(async () =>
        this.agent.getProfile({ actor: handle })
      )
      const profile = profileRes.data
      
      // Save user
      await db.saveUser({
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        lastSync: new Date(),
        createdAt: new Date()
      })
      
      // 2. Get existing data to determine sync strategy
      const existingStats = await db.getStats(profile.did)
      const isFirstSync = existingStats.totalPosts === 0
      const fullSync = options?.fullSync || isFirstSync
      
      // 3. Fetch posts
      if (fullSync) {
        progress('Fetching all posts...', 10)
        await this.fetchAllPosts(profile.did, handle, progress)
      } else {
        progress('Fetching recent posts...', 10)
        await this.fetchRecentPosts(profile.did, handle, existingStats.newestPost!, progress)
      }
      
      // 4. Update engagement metrics for recent posts
      progress('Updating engagement metrics...', 70)
      await this.updateEngagementMetrics(profile.did, progress)
      
      // 5. Update active engagers
      progress('Analyzing active engagers...', 85)
      await this.updateActiveEngagers(profile.did, progress)
      
      // 6. Create daily snapshot
      progress('Creating daily snapshot...', 95)
      await this.createDailySnapshot(profile.did, profile)
      
      // Update last sync time
      await db.saveUser({
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        lastSync: new Date(),
        createdAt: existingStats.lastSync || new Date()
      })
      
      progress('Sync complete!', 100)
    } catch (error) {
      debug.error('Sync error:', error)
      throw error
    }
  }
  
  /**
   * Fetch all posts for a user (full sync)
   */
  private async fetchAllPosts(
    userDid: string, 
    handle: string, 
    progress: (msg: string, pct: number) => void
  ): Promise<void> {
    const db = await getAnalyticsDB()
    let cursor: string | undefined
    let totalFetched = 0
    const allPosts: StoredPost[] = []
    
    do {
      const response = await rateLimiters.feed.execute(async () =>
        this.agent.getAuthorFeed({
          actor: handle,
          limit: 100,
          cursor
        })
      )
      
      const posts = response.data.feed
        .filter(item => {
          // Only include original posts by the user
          const post = item.post
          return post.author.did === userDid && 
                 post.record && 
                 (post.record as any).$type === 'app.bsky.feed.post'
        })
        .map(item => this.convertToStoredPost(userDid, item.post))
      
      allPosts.push(...posts)
      totalFetched += posts.length
      cursor = response.data.cursor
      
      // Update progress (10-60% range for post fetching)
      const estimatedTotal = (response.data.feed[0]?.post.author.postsCount || totalFetched)
      const percentComplete = Math.min((totalFetched / estimatedTotal) * 50 + 10, 60)
      progress(`Fetched ${totalFetched} posts...`, percentComplete)
      
      // Save in batches to avoid memory issues
      if (allPosts.length >= 500) {
        await db.savePosts(allPosts)
        allPosts.length = 0
      }
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 250))
      
    } while (cursor)
    
    // Save remaining posts
    if (allPosts.length > 0) {
      await db.savePosts(allPosts)
    }
    
    progress(`Fetched all ${totalFetched} posts`, 60)
  }
  
  /**
   * Fetch only recent posts (incremental sync)
   */
  private async fetchRecentPosts(
    userDid: string,
    handle: string,
    lastPostDate: Date,
    progress: (msg: string, pct: number) => void
  ): Promise<void> {
    const db = await getAnalyticsDB()
    const recentPosts: StoredPost[] = []
    let cursor: string | undefined
    let foundOldPost = false
    
    do {
      const response = await rateLimiters.feed.execute(async () =>
        this.agent.getAuthorFeed({
          actor: handle,
          limit: 50,
          cursor
        })
      )
      
      for (const item of response.data.feed) {
        const post = item.post
        
        // Skip if not by user or not a post
        if (post.author.did !== userDid || 
            !post.record || 
            (post.record as any).$type !== 'app.bsky.feed.post') {
          continue
        }
        
        const createdAt = new Date((post.record as any).createdAt)
        
        // Stop if we've reached posts we already have
        if (createdAt <= lastPostDate) {
          foundOldPost = true
          break
        }
        
        recentPosts.push(this.convertToStoredPost(userDid, post))
      }
      
      cursor = response.data.cursor
      
      if (foundOldPost) break
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 250))
      
    } while (cursor)
    
    if (recentPosts.length > 0) {
      await db.savePosts(recentPosts)
    }
    
    progress(`Fetched ${recentPosts.length} new posts`, 60)
  }
  
  /**
   * Convert AT Protocol post to stored format
   */
  private convertToStoredPost(userDid: string, post: AppBskyFeedDefs.PostView): StoredPost {
    const record = post.record as any
    
    return {
      userDid,
      uri: post.uri,
      cid: post.cid,
      text: record.text || '',
      createdAt: new Date(record.createdAt),
      likeCount: post.likeCount || 0,
      repostCount: post.repostCount || 0,
      replyCount: post.replyCount || 0,
      quoteCount: post.quoteCount || 0,
      hasMedia: !!(post.embed?.images || post.embed?.media),
      hasEmbed: !!post.embed,
      isReply: !!record.reply,
      isThread: !!(record.reply && record.reply.parent?.uri?.includes(userDid)),
      lastUpdated: new Date()
    }
  }
  
  /**
   * Update engagement metrics for recent posts
   */
  private async updateEngagementMetrics(
    userDid: string,
    progress: (msg: string, pct: number) => void
  ): Promise<void> {
    const db = await getAnalyticsDB()
    
    // Get posts from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentPosts = await db.getPostsForUser(userDid, 100)
    const postsToUpdate = recentPosts.filter(p => new Date(p.createdAt) > thirtyDaysAgo)
    
    const updatedPosts: StoredPost[] = []
    const engagementHistory: EngagementHistory[] = []
    
    for (let i = 0; i < postsToUpdate.length; i++) {
      const post = postsToUpdate[i]
      
      try {
        // Fetch latest metrics
        const postThread = await this.agent.getPostThread({
          uri: post.uri,
          depth: 0
        })
        
        if (postThread.data.thread.post) {
          const latestPost = postThread.data.thread.post as AppBskyFeedDefs.PostView
          
          // Track engagement changes
          const now = new Date()
          engagementHistory.push({
            userDid,
            postUri: post.uri,
            date: now.toISOString().split('T')[0],
            hour: now.getHours(),
            likes: latestPost.likeCount || 0,
            reposts: latestPost.repostCount || 0,
            replies: latestPost.replyCount || 0,
            quotes: latestPost.quoteCount || 0,
            likesGained: (latestPost.likeCount || 0) - post.likeCount,
            repostsGained: (latestPost.repostCount || 0) - post.repostCount,
            repliesGained: (latestPost.replyCount || 0) - post.replyCount
          })
          
          // Update stored post
          post.likeCount = latestPost.likeCount || 0
          post.repostCount = latestPost.repostCount || 0
          post.replyCount = latestPost.replyCount || 0
          post.quoteCount = latestPost.quoteCount || 0
          post.lastUpdated = new Date()
          post.lastEngagementCheck = new Date()
          
          updatedPosts.push(post)
        }
      } catch (error) {
        debug.warn(`Failed to update metrics for post ${post.uri}:`, error)
      }
      
      // Update progress (70-85% range)
      progress(
        `Updating metrics... (${i + 1}/${postsToUpdate.length})`,
        70 + (i / postsToUpdate.length) * 15
      )
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Save updates
    if (updatedPosts.length > 0) {
      await db.savePosts(updatedPosts)
    }
    if (engagementHistory.length > 0) {
      await db.saveEngagementHistory(engagementHistory)
    }
  }
  
  /**
   * Update active engagers by fetching likes on recent popular posts
   */
  private async updateActiveEngagers(
    userDid: string,
    progress: (msg: string, pct: number) => void
  ): Promise<void> {
    const db = await getAnalyticsDB()
    
    // Get top posts by engagement
    const posts = await db.getPostsForUser(userDid, 50)
    const topPosts = posts
      .sort((a, b) => {
        const engagementA = a.likeCount + a.repostCount + a.replyCount
        const engagementB = b.likeCount + b.repostCount + b.replyCount
        return engagementB - engagementA
      })
      .slice(0, 20)
    
    const engagerMap = new Map<string, ActiveEngager>()
    
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i]
      
      try {
        // Fetch likes
        const likesRes = await rateLimiters.feed.execute(async () =>
          this.agent.app.bsky.feed.getLikes({
            uri: post.uri,
            limit: 50
          })
        )
        
        for (const like of likesRes.data.likes) {
          let existing = engagerMap.get(like.actor.did)
          if (!existing) {
            existing = {
              userDid,
              engagerDid: like.actor.did,
              engagerHandle: like.actor.handle,
              totalInteractions: 0,
              likes: [],
              reposts: [],
              replies: [],
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          }
          
          // Ensure arrays exist (in case of corrupted data)
          if (!existing.likes) existing.likes = []
          if (!existing.reposts) existing.reposts = []
          if (!existing.replies) existing.replies = []
          
          if (!existing.likes.includes(post.uri)) {
            existing.likes.push(post.uri)
            existing.totalInteractions++
          }
          existing.lastSeen = new Date()
          
          engagerMap.set(like.actor.did, existing)
        }
      } catch (error) {
        debug.warn(`Failed to fetch likes for post ${post.uri}:`, error)
      }
      
      // Update progress
      progress(
        `Analyzing engagers... (${i + 1}/${topPosts.length})`,
        85 + (i / topPosts.length) * 10
      )
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Save engagers
    for (const engager of engagerMap.values()) {
      await db.updateActiveEngager(engager)
    }
  }
  
  /**
   * Create a daily snapshot of metrics
   */
  private async createDailySnapshot(
    userDid: string,
    profile: AppBskyActorDefs.ProfileView
  ): Promise<void> {
    const db = await getAnalyticsDB()
    const today = new Date().toISOString().split('T')[0]
    
    // Get all posts
    const allPosts = await db.getPostsForUser(userDid)
    
    // Get today's posts
    const todayPosts = allPosts.filter(p => {
      const postDate = new Date(p.createdAt).toISOString().split('T')[0]
      return postDate === today
    })
    
    // Calculate totals
    const totalLikes = allPosts.reduce((sum, p) => sum + p.likeCount, 0)
    const totalReposts = allPosts.reduce((sum, p) => sum + p.repostCount, 0)
    const totalReplies = allPosts.reduce((sum, p) => sum + p.replyCount, 0)
    const totalQuotes = allPosts.reduce((sum, p) => sum + (p.quoteCount || 0), 0)
    
    // Calculate averages
    const postCount = allPosts.length || 1
    const avgLikesPerPost = totalLikes / postCount
    const avgRepostsPerPost = totalReposts / postCount
    const avgRepliesPerPost = totalReplies / postCount
    
    // Calculate engagement rate
    const totalEngagement = totalLikes + totalReposts + totalReplies + totalQuotes
    const engagementRate = profile.followersCount 
      ? (totalEngagement / (postCount * profile.followersCount)) * 100
      : 0
    
    const snapshot: DailySnapshot = {
      userDid,
      date: today,
      followersCount: profile.followersCount || 0,
      followingCount: profile.followsCount || 0,
      postsCount: profile.postsCount || 0,
      totalLikes,
      totalReposts,
      totalReplies,
      totalQuotes,
      engagementRate: Math.round(engagementRate * 100) / 100,
      avgLikesPerPost: Math.round(avgLikesPerPost * 10) / 10,
      avgRepostsPerPost: Math.round(avgRepostsPerPost * 10) / 10,
      avgRepliesPerPost: Math.round(avgRepliesPerPost * 10) / 10,
      postsToday: todayPosts.length,
      mediaPostsToday: todayPosts.filter(p => p.hasMedia).length,
      threadsToday: todayPosts.filter(p => p.isThread).length
    }
    
    await db.saveDailySnapshot(snapshot)
  }
}