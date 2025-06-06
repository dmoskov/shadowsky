import { AtpAgent } from '@atproto/api'
import type { Post } from '../../types/atproto'
import { mapATProtoError } from '../../lib/errors'

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
    try {
      const result = await this.agent.like(post.uri, post.cid)
      return result
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Unlike a post (requires the like URI)
   */
  async unlikePost(likeUri: string): Promise<void> {
    try {
      await this.agent.deleteLike(likeUri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Repost a post
   */
  async repostPost(post: Post): Promise<RepostResult> {
    try {
      const result = await this.agent.repost(post.uri, post.cid)
      return result
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Delete a repost (requires the repost URI)
   */
  async deleteRepost(repostUri: string): Promise<void> {
    try {
      await this.agent.deleteRepost(repostUri)
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
    try {
      const result = await this.agent.post({
        text,
        reply: replyTo,
        createdAt: new Date().toISOString()
      })
      return result
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Create a new post
   */
  async createPost(text: string): Promise<{ uri: string; cid: string }> {
    try {
      const result = await this.agent.post({
        text,
        createdAt: new Date().toISOString()
      })
      return result
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postUri: string): Promise<void> {
    try {
      await this.agent.deletePost(postUri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  /**
   * Follow a user
   */
  async followUser(did: string): Promise<{ uri: string; cid: string }> {
    try {
      const result = await this.agent.follow(did)
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
      await this.agent.deleteFollow(followUri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}

// Singleton instance
let interactionsServiceInstance: InteractionsService | null = null

export function getInteractionsService(agent: AtpAgent): InteractionsService {
  if (!interactionsServiceInstance) {
    interactionsServiceInstance = new InteractionsService(agent)
  }
  return interactionsServiceInstance
}