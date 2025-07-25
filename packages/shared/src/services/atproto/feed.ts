/**
 * Feed-related AT Protocol operations with proper typing
 */

import { ATProtoClient } from './client'
import { mapATProtoError } from '../../lib/errors'
import { rateLimiters, withRateLimit } from '../../lib/rate-limiter'
import { withDeduplication } from '../../lib/request-deduplication'
// import { measureAsync } from '../../lib/performance-tracking'
import type { TimelineResponse, Post } from '../../types/atproto'

export class FeedService {
  constructor(private client: ATProtoClient) {
    // Constructor intentionally left minimal
    // Method wrapping happens after method definitions
  }
  
  public initializeDeduplication() {
    // Wrap methods with deduplication after they're defined
    const originalGetTimeline = this.getTimeline.bind(this);
    this.getTimeline = withDeduplication(
      originalGetTimeline,
      (cursor) => `timeline:${cursor || 'initial'}`
    );
    
    const originalGetAuthorFeed = this.getAuthorFeed.bind(this);
    this.getAuthorFeed = withDeduplication(
      originalGetAuthorFeed,
      (actor, cursor) => `author:${actor}:${cursor || 'initial'}`
    );
    
    const originalGetPostThread = this.getPostThread.bind(this);
    this.getPostThread = withDeduplication(
      originalGetPostThread,
      (uri) => `thread:${uri}`
    );
  }

  async getTimeline(cursor?: string): Promise<TimelineResponse> {
    return withRateLimit(rateLimiters.feed, 'timeline', async () => {
      try {
        const agent = this.client.getAgent()
        const response = await agent.app.bsky.feed.getTimeline({ cursor, limit: 30 })
        
        return {
          cursor: response.data.cursor,
          feed: response.data.feed.map(item => ({
            post: item.post as Post,
            reply: item.reply && 'root' in item.reply && 'parent' in item.reply && 
                   item.reply.root.$type === 'app.bsky.feed.defs#postView' &&
                   item.reply.parent.$type === 'app.bsky.feed.defs#postView'
              ? {
                  root: item.reply.root as Post,
                  parent: item.reply.parent as Post
                }
              : undefined,
            reason: item.reason && '$type' in item.reason && 
                    (item.reason.$type === 'app.bsky.feed.defs#reasonRepost' || 
                     item.reason.$type === 'app.bsky.feed.defs#reasonPin')
              ? item.reason as any
              : undefined
          }))
        }
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  async getAuthorFeed(actor: string, cursor?: string): Promise<TimelineResponse> {
    try {
      const agent = this.client.getAgent()
      const response = await agent.app.bsky.feed.getAuthorFeed({ 
        actor, 
        cursor, 
        limit: 30 
      })
      
      return {
        cursor: response.data.cursor,
        feed: response.data.feed.map(item => ({
          post: item.post as Post,
          reply: item.reply && 'root' in item.reply && 'parent' in item.reply && 
                 item.reply.root.$type === 'app.bsky.feed.defs#postView' &&
                 item.reply.parent.$type === 'app.bsky.feed.defs#postView'
            ? {
                root: item.reply.root as Post,
                parent: item.reply.parent as Post
              }
            : undefined,
          reason: item.reason && '$type' in item.reason && 
                  (item.reason.$type === 'app.bsky.feed.defs#reasonRepost' || 
                   item.reason.$type === 'app.bsky.feed.defs#reasonPin')
            ? item.reason as any
            : undefined
        }))
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getPostThread(uri: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.app.bsky.feed.getPostThread({ uri })
      return response.data
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getPost(uri: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.app.bsky.feed.getPosts({ uris: [uri] })
      return response.data.posts[0] as Post
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async likePost(uri: string, cid: string) {
    try {
      const agent = this.client.getAgent()
      const { data: session } = await agent.com.atproto.server.getSession()
      const response = await agent.app.bsky.feed.like.create(
        { repo: session.did },
        {
          subject: { uri, cid },
          createdAt: new Date().toISOString()
        }
      )
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async unlikePost(likeUri: string) {
    try {
      const agent = this.client.getAgent()
      const parts = likeUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await agent.com.atproto.server.getSession()
      
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.like',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async repost(uri: string, cid: string) {
    try {
      const agent = this.client.getAgent()
      const { data: session } = await agent.com.atproto.server.getSession()
      const response = await agent.app.bsky.feed.repost.create(
        { repo: session.did },
        {
          subject: { uri, cid },
          createdAt: new Date().toISOString()
        }
      )
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async deleteRepost(repostUri: string) {
    try {
      const agent = this.client.getAgent()
      const parts = repostUri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await agent.com.atproto.server.getSession()
      
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.repost',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async createPost(text: string, options?: {
    reply?: { root: { uri: string; cid: string }, parent: { uri: string; cid: string } }
    images?: File[]
  }) {
    try {
      const agent = this.client.getAgent()
      
      const post: Record<string, unknown> = { text }
      
      if (options?.reply) {
        post.reply = options.reply
      }
      
      // TODO: Handle image uploads when needed
      
      const { data: session } = await agent.com.atproto.server.getSession()
      const response = await agent.com.atproto.repo.createRecord({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          ...post,
          createdAt: new Date().toISOString()
        }
      })
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async deletePost(uri: string) {
    try {
      const agent = this.client.getAgent()
      const parts = uri.split('/')
      const rkey = parts[parts.length - 1]
      const { data: session } = await agent.com.atproto.server.getSession()
      
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        rkey
      })
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}