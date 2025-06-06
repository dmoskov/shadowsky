import { BskyAgent } from '@atproto/api'
import { atClient } from './client'
import type { AppBskyFeedDefs } from '@atproto/api'
import { handleATProtoError } from '../../lib/errors'

export type ThreadViewPost = AppBskyFeedDefs.ThreadViewPost

class ThreadService {
  private agent: BskyAgent

  constructor() {
    this.agent = atClient
  }

  /**
   * Get a full thread view for a post
   */
  async getThread(uri: string, depth = 6, height = 80): Promise<ThreadViewPost> {
    try {
      const response = await this.agent.getPostThread({
        uri,
        depth,
        height
      })
      
      if (!response.data.thread) {
        throw new Error('Thread not found')
      }
      
      // Type guard to ensure we have a ThreadViewPost
      if (response.data.thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
        throw new Error('Invalid thread response')
      }
      
      return response.data.thread as ThreadViewPost
    } catch (error) {
      throw handleATProtoError(error)
    }
  }
  
  /**
   * Get thread ancestors (parent posts)
   */
  getAncestors(thread: ThreadViewPost): ThreadViewPost[] {
    const ancestors: ThreadViewPost[] = []
    let current = thread.parent
    
    while (current && current.$type === 'app.bsky.feed.defs#threadViewPost') {
      ancestors.unshift(current as ThreadViewPost)
      current = (current as ThreadViewPost).parent
    }
    
    return ancestors
  }
  
  /**
   * Get thread descendants (replies) flattened
   */
  getDescendants(thread: ThreadViewPost): ThreadViewPost[] {
    const descendants: ThreadViewPost[] = []
    
    const traverse = (node: ThreadViewPost) => {
      if (node.replies && Array.isArray(node.replies)) {
        for (const reply of node.replies) {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            descendants.push(reply as ThreadViewPost)
            traverse(reply as ThreadViewPost)
          }
        }
      }
    }
    
    traverse(thread)
    return descendants
  }
}

// Export singleton instance
export const threadService = new ThreadService()