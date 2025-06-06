import { AtpAgent } from '@atproto/api'
import type { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs'
import type { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs'
import { mapATProtoError } from '../../lib/errors'

export class SearchService {
  constructor(private agent: AtpAgent) {}

  async searchActors(query: string, cursor?: string): Promise<{
    actors: ProfileView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.app.bsky.actor.searchActors({
        q: query,
        limit: 25,
        cursor
      })
      
      return {
        actors: response.data.actors,
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async searchPosts(query: string, cursor?: string): Promise<{
    posts: PostView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.app.bsky.feed.searchPosts({
        q: query,
        limit: 25,
        cursor
      })
      
      return {
        posts: response.data.posts,
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async searchActorsTypeahead(query: string): Promise<ProfileView[]> {
    try {
      const response = await this.agent.app.bsky.actor.searchActorsTypeahead({
        q: query,
        limit: 8
      })
      
      return response.data.actors
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}

// Singleton instance
let searchServiceInstance: SearchService | null = null

export function getSearchService(agent: AtpAgent): SearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService(agent)
  }
  return searchServiceInstance
}