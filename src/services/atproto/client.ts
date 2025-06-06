/**
 * AT Protocol client with proper error handling and type safety
 */

import { BskyAgent } from '@atproto/api'
import { mapATProtoError } from '../../lib/errors'
import type { Session } from '../../types/atproto'

export interface ATProtoConfig {
  service?: string
  persistSession?: boolean
}

export class ATProtoClient {
  private agent: BskyAgent
  private config: Required<ATProtoConfig>
  
  constructor(config: ATProtoConfig = {}) {
    this.config = {
      service: config.service || 'https://bsky.social',
      persistSession: config.persistSession !== false
    }
    
    this.agent = new BskyAgent({
      service: this.config.service
    })
  }

  async login(identifier: string, password: string): Promise<Session> {
    try {
      const response = await this.agent.login({ identifier, password })
      
      if (this.config.persistSession && response.data) {
        this.saveSession(response.data)
      }
      
      return response.data as Session
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async resumeSession(session: Session): Promise<Session> {
    try {
      const response = await this.agent.resumeSession(session)
      
      if (this.config.persistSession && response.data) {
        this.saveSession(response.data)
      }
      
      return response.data as Session
    } catch (error) {
      // Log the raw error for debugging
      console.debug('Raw resumeSession error:', error)
      throw mapATProtoError(error)
    }
  }

  async refreshSession(): Promise<Session | null> {
    try {
      if (!this.agent.session) return null
      
      const response = await this.agent.refreshSession()
      
      if (this.config.persistSession && response.data) {
        this.saveSession(response.data)
      }
      
      return response.data as Session
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  logout(): void {
    this.agent.session = undefined
    if (this.config.persistSession) {
      this.clearSession()
    }
  }

  getAgent(): BskyAgent {
    return this.agent
  }

  getSession(): Session | null {
    return this.agent.session as Session | null
  }

  isAuthenticated(): boolean {
    return this.agent.session !== undefined
  }

  private saveSession(session: Session): void {
    try {
      localStorage.setItem('bsky_session', JSON.stringify(session))
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  private clearSession(): void {
    try {
      localStorage.removeItem('bsky_session')
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  static loadSavedSession(): Session | null {
    try {
      const saved = localStorage.getItem('bsky_session')
      if (!saved) return null
      
      const session = JSON.parse(saved)
      
      // Validate session has required fields
      if (!session.accessJwt || !session.refreshJwt || !session.did) {
        console.warn('Invalid session format, clearing...')
        localStorage.removeItem('bsky_session')
        return null
      }
      
      return session
    } catch (error) {
      console.error('Failed to load saved session:', error)
      // Clear corrupted session data
      try {
        localStorage.removeItem('bsky_session')
      } catch {
        // Ignore localStorage errors
      }
      return null
    }
  }
}

// Export singleton instance  
export const atClient = new BskyAgent({ service: 'https://bsky.social' })