import { AtpAgent } from '@atproto/api'
import type { AppBskyFeedDefs } from '@atproto/api'
import { ThreadService, ThreadViewPost } from '../../../packages/shared/src/index.ts'
import { debug } from '@bsky/shared'

export interface ThreadNode {
  post: ThreadViewPost
  parent?: ThreadNode
  replies: ThreadNode[]
  depth: number
  isCollapsed: boolean
  isHighlighted: boolean
  isFocused: boolean
  hasCircularReference: boolean
}

export interface ThreadNavigationState {
  focusedThreadUri?: string
  expandedNodes: Set<string>
  visitedNodes: Set<string>
  breadcrumbs: string[]
}

export class EnhancedThreadService extends ThreadService {
  private visitedUris = new Set<string>()
  private maxDepth = 50 // Maximum depth to prevent stack overflow
  private threadCache = new Map<string, { data: ThreadNode; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes
  
  constructor(agent: AtpAgent) {
    super(agent)
  }
  
  /**
   * Build a safe thread tree with infinite loop protection
   */
  async buildThreadTree(
    uri: string, 
    maxDepth = 10,
    visitedUris?: Set<string>
  ): Promise<ThreadNode | null> {
    // Check cache first
    const cached = this.threadCache.get(uri)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    
    // Initialize visited set if not provided
    const visited = visitedUris || new Set<string>()
    
    // Check for circular reference
    if (visited.has(uri)) {
      debug.warn(`Circular reference detected for URI: ${uri}`)
      return {
        post: {
          post: {
            uri,
            cid: '',
            author: { did: '', handle: 'circular-reference' },
            record: { value: { text: '[Circular Reference Detected]' } }
          },
          $type: 'app.bsky.feed.defs#threadViewPost'
        } as ThreadViewPost,
        replies: [],
        depth: 0,
        isCollapsed: false,
        isHighlighted: false,
        isFocused: false,
        hasCircularReference: true
      }
    }
    
    // Add to visited set
    visited.add(uri)
    
    try {
      // Fetch thread data
      const thread = await this.getThread(uri, maxDepth)
      
      // Build node
      const node = this.buildThreadNode(thread, 0, visited, maxDepth)
      
      // Cache the result
      if (node) {
        this.threadCache.set(uri, { data: node, timestamp: Date.now() })
      }
      
      return node
    } catch (error) {
      debug.error(`Failed to fetch thread for URI: ${uri}`, error)
      return null
    }
  }
  
  /**
   * Recursively build thread nodes with loop protection
   */
  private buildThreadNode(
    thread: ThreadViewPost,
    depth: number,
    visitedUris: Set<string>,
    maxDepth: number,
    parent?: ThreadNode
  ): ThreadNode {
    // Safety check for max depth
    if (depth > this.maxDepth) {
      debug.warn(`Max depth ${this.maxDepth} reached`)
      return {
        post: thread,
        parent,
        replies: [],
        depth,
        isCollapsed: true,
        isHighlighted: false,
        isFocused: false,
        hasCircularReference: false
      }
    }
    
    const node: ThreadNode = {
      post: thread,
      parent,
      replies: [],
      depth,
      isCollapsed: depth > 3, // Auto-collapse deep threads
      isHighlighted: false,
      isFocused: false,
      hasCircularReference: false
    }
    
    // Process replies with loop protection
    if (thread.replies && Array.isArray(thread.replies) && depth < maxDepth) {
      for (const reply of thread.replies) {
        if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
          const replyPost = reply as ThreadViewPost
          
          // Check for circular reference
          if (visitedUris.has(replyPost.post.uri)) {
            debug.warn(`Circular reference in replies: ${replyPost.post.uri}`)
            node.replies.push({
              post: replyPost,
              parent: node,
              replies: [],
              depth: depth + 1,
              isCollapsed: true,
              isHighlighted: false,
              isFocused: false,
              hasCircularReference: true
            })
          } else {
            // Add to visited before recursion
            visitedUris.add(replyPost.post.uri)
            
            const childNode = this.buildThreadNode(
              replyPost,
              depth + 1,
              visitedUris,
              maxDepth,
              node
            )
            node.replies.push(childNode)
          }
        }
      }
    }
    
    return node
  }
  
  /**
   * Get a focused view of a subthread
   */
  async getFocusedSubthread(
    rootThreadUri: string,
    focusUri: string,
    contextDepth = 2
  ): Promise<{ 
    focusedNode: ThreadNode | null, 
    breadcrumbs: ThreadViewPost[],
    context: ThreadNode | null 
  }> {
    // Build the full thread tree
    const rootTree = await this.buildThreadTree(rootThreadUri)
    if (!rootTree) {
      return { focusedNode: null, breadcrumbs: [], context: null }
    }
    
    // Find the focused node
    const focusedNode = this.findNodeByUri(rootTree, focusUri)
    if (!focusedNode) {
      return { focusedNode: null, breadcrumbs: [], context: rootTree }
    }
    
    // Build breadcrumbs
    const breadcrumbs: ThreadViewPost[] = []
    let current = focusedNode.parent
    while (current) {
      breadcrumbs.unshift(current.post)
      current = current.parent
    }
    
    // Mark focused node
    focusedNode.isFocused = true
    
    // Expand parents up to context depth
    let parent = focusedNode.parent
    let expandDepth = 0
    while (parent && expandDepth < contextDepth) {
      parent.isCollapsed = false
      parent = parent.parent
      expandDepth++
    }
    
    return { focusedNode, breadcrumbs, context: rootTree }
  }
  
  /**
   * Find a node by URI in the thread tree
   */
  private findNodeByUri(node: ThreadNode, uri: string): ThreadNode | null {
    if (node.post.post.uri === uri) {
      return node
    }
    
    for (const reply of node.replies) {
      const found = this.findNodeByUri(reply, uri)
      if (found) return found
    }
    
    return null
  }
  
  /**
   * Toggle node expansion state
   */
  toggleNodeExpansion(node: ThreadNode): void {
    node.isCollapsed = !node.isCollapsed
  }
  
  /**
   * Get thread statistics
   */
  getThreadStats(node: ThreadNode): {
    totalPosts: number
    maxDepth: number
    circularReferences: number
    authors: Set<string>
  } {
    const stats = {
      totalPosts: 0,
      maxDepth: 0,
      circularReferences: 0,
      authors: new Set<string>()
    }
    
    const traverse = (n: ThreadNode, depth: number) => {
      stats.totalPosts++
      stats.maxDepth = Math.max(stats.maxDepth, depth)
      stats.authors.add(n.post.post.author.did)
      
      if (n.hasCircularReference) {
        stats.circularReferences++
      }
      
      for (const reply of n.replies) {
        traverse(reply, depth + 1)
      }
    }
    
    traverse(node, 0)
    return stats
  }
  
  /**
   * Clear the thread cache
   */
  clearCache(): void {
    this.threadCache.clear()
  }
  
  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.threadCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.threadCache.delete(key)
      }
    }
  }
}

// Singleton instance
let enhancedThreadServiceInstance: EnhancedThreadService | null = null

export function getEnhancedThreadService(agent: AtpAgent): EnhancedThreadService {
  if (!enhancedThreadServiceInstance) {
    enhancedThreadServiceInstance = new EnhancedThreadService(agent)
  }
  return enhancedThreadServiceInstance
}