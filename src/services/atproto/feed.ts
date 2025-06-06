/**
 * Feed-related AT Protocol operations with proper typing
 */

import { ATProtoClient } from './client'
import { mapATProtoError } from '../../lib/errors'
import type { TimelineResponse, Post } from '../../types/atproto'

export class FeedService {
  constructor(private client: ATProtoClient) {}

  async getTimeline(cursor?: string): Promise<TimelineResponse> {
    try {
      const agent = this.client.getAgent()
      const response = await agent.getTimeline({ cursor, limit: 30 })
      
      return {
        cursor: response.data.cursor,
        feed: response.data.feed.map(item => ({
          post: item.post as Post,
          reply: item.reply,
          reason: item.reason
        }))
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getAuthorFeed(actor: string, cursor?: string): Promise<TimelineResponse> {
    try {
      const agent = this.client.getAgent()
      const response = await agent.getAuthorFeed({ 
        actor, 
        cursor, 
        limit: 30 
      })
      
      return {
        cursor: response.data.cursor,
        feed: response.data.feed.map(item => ({
          post: item.post as Post,
          reply: item.reply,
          reason: item.reason
        }))
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getPostThread(uri: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.getPostThread({ uri })
      return response.data
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getPost(uri: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.getPosts({ uris: [uri] })
      return response.data.posts[0] as Post
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async likePost(uri: string, cid: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.like(uri, cid)
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async unlikePost(likeUri: string) {
    try {
      const agent = this.client.getAgent()
      await agent.deleteLike(likeUri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async repost(uri: string, cid: string) {
    try {
      const agent = this.client.getAgent()
      const response = await agent.repost(uri, cid)
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async deleteRepost(repostUri: string) {
    try {
      const agent = this.client.getAgent()
      await agent.deleteRepost(repostUri)
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
      
      const post: any = { text }
      
      if (options?.reply) {
        post.reply = options.reply
      }
      
      // TODO: Handle image uploads when needed
      
      const response = await agent.post(post)
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async deletePost(uri: string) {
    try {
      const agent = this.client.getAgent()
      await agent.deletePost(uri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}