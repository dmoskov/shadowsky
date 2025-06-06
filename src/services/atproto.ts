import { BskyAgent } from '@atproto/api'

export class ATProtoService {
  private agent: BskyAgent
  
  constructor() {
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    })
  }

  async login(identifier: string, password: string) {
    try {
      const response = await this.agent.login({
        identifier,
        password
      })
      return { success: true, data: response.data }
    } catch (error) {
      console.error('Login failed:', error)
      return { success: false, error }
    }
  }

  async resume(session: any) {
    try {
      await this.agent.resumeSession(session)
      return { success: true }
    } catch (error) {
      console.error('Resume session failed:', error)
      return { success: false, error }
    }
  }

  getAgent() {
    return this.agent
  }

  isLoggedIn() {
    return this.agent.session !== undefined
  }

  logout() {
    this.agent.session = undefined
  }

  getSession() {
    return this.agent.session
  }
}

export const atProtoService = new ATProtoService()