import { AtpAgent } from '@atproto/api'
import type { ProfileView, ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs'
import type { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs'
import { mapATProtoError } from '../../lib/errors'

export class ProfileService {
  constructor(private agent: AtpAgent) {}

  async getProfile(handle: string): Promise<ProfileViewDetailed> {
    try {
      const response = await this.agent.getProfile({ actor: handle })
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
      const response = await this.agent.getAuthorFeed({
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
      const response = await this.agent.follow(did)
      return response
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async unfollowUser(followUri: string): Promise<void> {
    try {
      await this.agent.deleteFollow(followUri)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getFollowers(handle: string, cursor?: string): Promise<{
    followers: ProfileView[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.getFollowers({
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
      const response = await this.agent.getFollows({
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
}

// Singleton instance
let profileServiceInstance: ProfileService | null = null

export function getProfileService(agent: AtpAgent): ProfileService {
  if (!profileServiceInstance) {
    profileServiceInstance = new ProfileService(agent)
  }
  return profileServiceInstance
}