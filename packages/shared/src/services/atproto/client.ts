/**
 * AT Protocol client with proper error handling and type safety
 */

import { BskyAgent } from '@atproto/api'
import { mapATProtoError } from '../../lib/errors'
// import { measureAsync } from '../../lib/performance-tracking'
import type { Session } from '../../types/atproto'
import { sessionCookies } from '../../lib/cookies'
import { createRateLimitedAgent } from '../../lib/rate-limited-agent'
import { debug } from '../../utils/debug'

export interface ATProtoConfig {
  service?: string
  persistSession?: boolean
  sessionPrefix?: string
  enableRateLimiting?: boolean // New option to enable/disable rate limiting
}

export class ATProtoClient {
  private _agent: BskyAgent
  private config: Required<ATProtoConfig>
  
  constructor(config: ATProtoConfig = {}) {
    this.config = {
      service: config.service || 'https://bsky.social',
      persistSession: config.persistSession !== false,
      sessionPrefix: config.sessionPrefix || '',
      enableRateLimiting: config.enableRateLimiting !== false // Default to true
    }
    
    const baseAgent = new BskyAgent({
      service: this.config.service,
      persistSession: (evt: any, session: any) => {
        debug.log('BskyAgent persistSession event:', evt, {
          hasSession: !!session,
          sessionKeys: session ? Object.keys(session) : []
        })
        
        // Only save if we have a complete session
        if (this.config.persistSession && session && session.accessJwt && session.refreshJwt) {
          this.saveSession(session)
        } else if (session && (!session.accessJwt || !session.refreshJwt)) {
          debug.warn('Skipping save - incomplete session data')
        }
      }
    })
    
    // Apply rate limiting wrapper if enabled
    this._agent = this.config.enableRateLimiting 
      ? createRateLimitedAgent(baseAgent)
      : baseAgent
  }

  async login(identifier: string, password: string): Promise<Session> {
    try {
      await this._agent.login({ identifier, password })
      
      // After login, the agent's session property is updated
      const sessionData = this._agent.session
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
      debug.log('Attempting to resume session for:', session.handle)
      
      // Convert our Session type to AtpSessionData
      const atpSession = {
        ...session,
        active: session.active ?? true
      }
      await this._agent.resumeSession(atpSession)
      
      debug.log('Session resumed successfully')
      
      // After resumeSession, the agent's session property is updated
      const sessionData = this._agent.session
      if (this.config.persistSession && sessionData) {
        this.saveSession(sessionData)
      }
      
      return sessionData as Session
    } catch (error) {
      // Log the raw error for debugging
      debug.error('Failed to resume session:', error)
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
      
      await this._agent.resumeSession(currentSession)
      
      // After resumeSession, the agent's session property is updated
      const sessionData = this._agent.session
      if (this.config.persistSession && sessionData) {
        this.saveSession(sessionData)
      }
      
      return sessionData as Session
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  logout(): void {
    debug.log('ATProtoClient.logout() called')
    console.trace('Logout call stack')
    
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
      debug.log('Saving session:', {
        hasDid: !!session.did,
        hasHandle: !!session.handle,
        hasAccessJwt: !!session.accessJwt,
        hasRefreshJwt: !!session.refreshJwt,
        sessionKeys: Object.keys(session)
      })
      
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
      debug.error('Failed to save session:', error)
    }
  }

  private clearSession(): void {
    try {
      debug.log('Clearing session with prefix:', this.config.sessionPrefix)
      const storageKey = `${this.config.sessionPrefix}bsky_session`
      localStorage.removeItem(storageKey)
      sessionCookies.clear(this.config.sessionPrefix)
    } catch (error) {
      debug.error('Failed to clear session:', error)
    }
  }

  static loadSavedSession(sessionPrefix: string = ''): Session | null {
    try {
      const storageKey = `${sessionPrefix}bsky_session`
      debug.log('Loading saved session with prefix:', sessionPrefix)
      
      // Try to load from cookie first (preferred for cross-port sharing)
      let session = sessionCookies.load(sessionPrefix)
      
      if (session) {
        debug.log('Session loaded from cookie:', session.handle)
      } else {
        debug.log('No session found in cookie, checking localStorage')
      }
      
      // Fall back to localStorage if no cookie found
      if (!session) {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          session = JSON.parse(saved)
          debug.log('Session loaded from localStorage:', session?.handle)
          // Migrate to cookie storage
          if (session) {
            sessionCookies.save(session, sessionPrefix)
          }
        }
      }
      
      if (!session) return null
      
      // Validate session has required fields
      if (!session.accessJwt || !session.refreshJwt || !session.did) {
        debug.warn('Invalid session format, clearing...', {
          hasAccessJwt: !!session.accessJwt,
          hasRefreshJwt: !!session.refreshJwt,
          hasDid: !!session.did,
          sessionKeys: Object.keys(session)
        })
        localStorage.removeItem(storageKey)
        sessionCookies.clear(sessionPrefix)
        return null
      }
      
      return session
    } catch (error) {
      debug.error('Failed to load saved session:', error)
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