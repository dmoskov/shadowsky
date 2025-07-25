/**
 * AT Protocol client with proper error handling and type safety
 */

import { BskyAgent } from '@atproto/api'
import { mapATProtoError } from '../../lib/errors'
// import { measureAsync } from '../../lib/performance-tracking'
import type { Session } from '../../types/atproto'
import { sessionCookies } from '../../lib/cookies'

export interface ATProtoConfig {
  service?: string
  persistSession?: boolean
  sessionPrefix?: string
}

export class ATProtoClient {
  private _agent: BskyAgent
  private config: Required<ATProtoConfig>
  
  constructor(config: ATProtoConfig = {}) {
    this.config = {
      service: config.service || 'https://bsky.social',
      persistSession: config.persistSession !== false,
      sessionPrefix: config.sessionPrefix || ''
    }
    
    this._agent = new BskyAgent({
      service: this.config.service
    })
  }

  async login(identifier: string, password: string): Promise<Session> {
    try {
      const response = await this._agent.login({ identifier, password })
      
      const sessionData = response.data as any
      if (this.config.persistSession && sessionData) {
        this.saveSession(sessionData)
      }
      
      return sessionData as Session
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async resumeSession(session: Session): Promise<Session> {
    try {
      // Convert our Session type to AtpSessionData
      const atpSession = {
        ...session,
        active: session.active ?? true
      }
      const response = await this._agent.resumeSession(atpSession)
      
      const sessionData = response.data as any
      if (this.config.persistSession && sessionData) {
        this.saveSession(sessionData)
      }
      
      return sessionData as Session
    } catch (error) {
      // Log the raw error for debugging
      console.debug('Raw resumeSession error:', error)
      throw mapATProtoError(error)
    }
  }

  async refreshSession(): Promise<Session | null> {
    try {
      if (!this._agent.session) return null
      
      // BskyAgent doesn't have refreshSession, we need to manually refresh
      // by resuming with the current session
      const currentSession = this._agent.session
      if (!currentSession) return null
      
      const response = await this._agent.resumeSession(currentSession)
      
      const sessionData = response.data as any
      if (this.config.persistSession && sessionData) {
        this.saveSession(sessionData)
      }
      
      return sessionData as Session
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  logout(): void {
    // Clear persisted session first
    if (this.config.persistSession) {
      this.clearSession()
    }
    
    // Since we can't directly clear the agent's session (it's read-only),
    // we'll rely on the page reload in AuthContext to fully reset the app
    // The important part is clearing localStorage so the session isn't resumed
  }

  getAgent(): BskyAgent {
    return this._agent
  }
  
  get agent(): BskyAgent {
    return this._agent
  }

  getSession(): Session | null {
    return this._agent.session as Session | null
  }

  isAuthenticated(): boolean {
    return this._agent.session !== undefined
  }

  getSessionPrefix(): string {
    return this.config.sessionPrefix
  }

  private saveSession(session: any): void {
    try {
      // Ensure we're saving all required fields
      const sessionData: Session = {
        did: session.did,
        handle: session.handle,
        email: session.email,
        emailConfirmed: session.emailConfirmed,
        emailAuthFactor: session.emailAuthFactor,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
        active: session.active
      }
      const storageKey = `${this.config.sessionPrefix}bsky_session`
      // Save to both localStorage (for backward compatibility) and cookies
      localStorage.setItem(storageKey, JSON.stringify(sessionData))
      sessionCookies.save(sessionData, this.config.sessionPrefix)
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  private clearSession(): void {
    try {
      const storageKey = `${this.config.sessionPrefix}bsky_session`
      localStorage.removeItem(storageKey)
      sessionCookies.clear(this.config.sessionPrefix)
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  static loadSavedSession(sessionPrefix: string = ''): Session | null {
    try {
      const storageKey = `${sessionPrefix}bsky_session`
      
      // Try to load from cookie first (preferred for cross-port sharing)
      let session = sessionCookies.load(sessionPrefix)
      
      // Fall back to localStorage if no cookie found
      if (!session) {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          session = JSON.parse(saved)
          // Migrate to cookie storage
          if (session) {
            sessionCookies.save(session, sessionPrefix)
          }
        }
      }
      
      if (!session) return null
      
      // Validate session has required fields
      if (!session.accessJwt || !session.refreshJwt || !session.did) {
        console.warn('Invalid session format, clearing...')
        localStorage.removeItem(storageKey)
        sessionCookies.clear(sessionPrefix)
        return null
      }
      
      return session
    } catch (error) {
      console.error('Failed to load saved session:', error)
      // Clear corrupted session data
      try {
        const storageKey = `${sessionPrefix}bsky_session`
        localStorage.removeItem(storageKey)
        sessionCookies.clear(sessionPrefix)
      } catch {
        // Ignore storage errors
      }
      return null
    }
  }
}

// Note: We don't export a raw BskyAgent instance anymore
// All services should use the authenticated agent from ATProtoClient