import { AtpAgent } from '@atproto/api'
import type { ProfileView, ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs'
import type { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs'
import { mapATProtoError } from '../../lib/errors'

export class ProfileService {
  constructor(private agent: AtpAgent) {}

  async getProfile(handle: string): Promise<ProfileViewDetailed> {
    try {
      const response = await this.agent.app.bsky.actor.getProfile({ actor: handle })
      return response.data
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getAuthorFeed(handle: string, cursor?: string): Promise<{
    posts: PostView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.app.bsky.feed.getAuthorFeed({
        actor: handle,
        limit: 30,
        cursor
      })
      
      return {
        posts: response.data.feed.map(item => item.post),
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async followUser(did: string): Promise<{ uri: string; cid: string }> {
    try {
      // Get the user's DID first
      const { data: session } = await this.agent.com.atproto.server.getSession()
      const response = await this.agent.app.bsky.graph.follow.create(
        { repo: session.did },
        {
          subject: did,
          createdAt: new Date().toISOString()
        }
      )
      return { uri: response.uri, cid: response.cid }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

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

  async getFollowers(handle: string, cursor?: string): Promise<{
    followers: ProfileView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.app.bsky.graph.getFollowers({
        actor: handle,
        limit: 50,
        cursor
      })
      
      return {
        followers: response.data.followers,
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getFollows(handle: string, cursor?: string): Promise<{
    follows: ProfileView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.app.bsky.graph.getFollows({
        actor: handle,
        limit: 50,
        cursor
      })
      
      return {
        follows: response.data.follows,
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getProfiles(handles: string[]): Promise<Map<string, ProfileViewDetailed>> {
    const profileMap = new Map<string, ProfileViewDetailed>()
    
    // Fetch profiles sequentially to respect rate limits
    // This is slower but much more respectful of the API
    for (const handle of handles) {
      try {
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
        const profile = await this.getProfile(handle)
        if (profile) {
          profileMap.set(handle, profile)
        }
      } catch (error) {
        console.error(`Failed to fetch profile for ${handle}:`, error)
      }
    }
    
    return profileMap
  }
}

// Factory function - create new instance per agent
export function getProfileService(agent: AtpAgent): ProfileService {
  return new ProfileService(agent)
}