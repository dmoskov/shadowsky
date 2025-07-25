import { AtpAgent } from '@atproto/api'
import type { AppBskyFeedDefs } from '@atproto/api'
import { mapATProtoError } from '../../lib/errors'

export type ThreadViewPost = AppBskyFeedDefs.ThreadViewPost

export class ThreadService {
  constructor(private agent: AtpAgent) {}

  /**
   * Get a full thread view for a post
   */
  async getThread(uri: string, depth = 6): Promise<ThreadViewPost> {
    try {
      const response = await this.agent.app.bsky.feed.getPostThread({
        uri,
        depth
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
      throw mapATProtoError(error)
    }
  }
  
  /**
   * Get the root thread for any post in a conversation
   * This ensures we always show the full thread context
   */
  async getRootThread(uri: string, depth = 6): Promise<ThreadViewPost> {
    // First get the thread for this specific post
    const thread = await this.getThread(uri, depth)
    
    // Find the root by traversing up through parents
    let root = thread
    while (root.parent && root.parent.$type === 'app.bsky.feed.defs#threadViewPost') {
      const parentThread = root.parent as ThreadViewPost
      // We need to fetch the full thread from the parent to get all replies
      try {
        const fullParentThread = await this.getThread(parentThread.post.uri, depth)
        root = fullParentThread
      } catch (error) {
        // If we can't fetch parent, use what we have
        break
      }
    }
    
    return root
  }
  
  /**
   * Get thread ancestors (parent posts)
   */
  static getAncestors(thread: ThreadViewPost): ThreadViewPost[] {
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
  static getDescendants(thread: ThreadViewPost): ThreadViewPost[] {
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

// Singleton instance
let threadServiceInstance: ThreadService | null = null

export function getThreadService(agent: AtpAgent): ThreadService {
  if (!threadServiceInstance) {
    threadServiceInstance = new ThreadService(agent)
  }
  return threadServiceInstance
}