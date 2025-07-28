import { AtpAgent } from '@atproto/api'
import type { Post } from '../../types/atproto'
import { mapATProtoError } from '../../lib/errors'
import { rateLimiters, withRateLimit } from '../../lib/rate-limiter'
import { debug } from '../../utils/debug'

// Helper to ensure agent is authenticated
function ensureAuthenticated(agent: AtpAgent): void {
  if (!agent.session) {
    debug.error('Agent has no session:', agent)
    throw new Error('Not authenticated - no session on agent')
  }
  debug.log('Agent session confirmed:', agent.session.handle)
}

export interface LikeResult {
  uri: string
  cid: string
}

export interface RepostResult {
  uri: string
  cid: string
}

class InteractionsService {
  constructor(private agent: AtpAgent) {}

  /**
   * Like a post
   */
  async likePost(post: Post): Promise<LikeResult> {
    return withRateLimit(rateLimiters.interactions, 'like', async () => {
      try {
        // Ensure agent is authenticated
        ensureAuthenticated(this.agent)
        
        debug.log('Post details:', { uri: post.uri, cid: post.cid })
        
        const { data: session } = await this.agent.com.atproto.server.getSession()
        debug.log('Session check passed:', session.handle, session.did)
        
        const result = await this.agent.app.bsky.feed.like.create(
          { repo: session.did },
          {
            subject: { uri: post.uri, cid: post.cid },
            createdAt: new Date().toISOString()
          }
        )
        
        debug.log('Like created successfully:', result)
        return result
      } catch (error) {
        debug.error('Like error details:', error)
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Unlike a post (requires the like URI)
   */
  async unlikePost(likeUri: string): Promise<void> {
    try {
      // Parse the AT URI to get the rkey
      const parts = likeUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await this.agent.com.atproto.server.getSession()
      
      await this.agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.like',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Repost a post
   */
  async repostPost(post: Post): Promise<RepostResult> {
    return withRateLimit(rateLimiters.interactions, 'repost', async () => {
      try {
        // Ensure agent is authenticated
        ensureAuthenticated(this.agent)
        
        const { data: session } = await this.agent.com.atproto.server.getSession()
        const result = await this.agent.app.bsky.feed.repost.create(
          { repo: session.did },
          {
            subject: { uri: post.uri, cid: post.cid },
            createdAt: new Date().toISOString()
          }
        )
        return result
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Delete a repost (requires the repost URI)
   */
  async deleteRepost(repostUri: string): Promise<void> {
    try {
      // Parse the AT URI to get the rkey
      const parts = repostUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await this.agent.com.atproto.server.getSession()
      
      await this.agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.repost',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Create a reply to a post
   */
  async createReply(
    text: string,
    replyTo: {
      root: { uri: string; cid: string }
      parent: { uri: string; cid: string }
    }
  ): Promise<{ uri: string; cid: string }> {
    return withRateLimit(rateLimiters.interactions, 'createReply', async () => {
      try {
        const { data: session } = await this.agent.com.atproto.server.getSession()
        const result = await this.agent.com.atproto.repo.createRecord({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            reply: replyTo,
            createdAt: new Date().toISOString()
          }
        })
        return { uri: result.data.uri, cid: result.data.cid }
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Create a new post
   */
  async createPost(text: string): Promise<{ uri: string; cid: string }> {
    return withRateLimit(rateLimiters.interactions, 'createPost', async () => {
      try {
        const { data: session } = await this.agent.com.atproto.server.getSession()
        const result = await this.agent.com.atproto.repo.createRecord({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString()
          }
        })
        return { uri: result.data.uri, cid: result.data.cid }
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Delete a post
   */
  async deletePost(postUri: string): Promise<void> {
    try {
      // Parse the AT URI to get the rkey
      const parts = postUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await this.agent.com.atproto.server.getSession()
      
      await this.agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Follow a user
   */
  async followUser(did: string): Promise<{ uri: string; cid: string }> {
    try {
      const { data: session } = await this.agent.com.atproto.server.getSession()
      const result = await this.agent.app.bsky.graph.follow.create(
        { repo: session.did },
        {
          subject: did,
          createdAt: new Date().toISOString()
        }
      )
      return result
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followUri: string): Promise<void> {
    try {
      // Parse the AT URI to get the rkey
      const parts = followUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await this.agent.com.atproto.server.getSession()
      
      await this.agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.graph.follow',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}

// Factory function - create new instance per agent
export function getInteractionsService(agent: AtpAgent): InteractionsService {
  return new InteractionsService(agent)
}