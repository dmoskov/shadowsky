import { debug } from '../utils/debug'

/**
 * Cookie utilities for secure session management
 */

interface CookieOptions {
  expires?: Date
  maxAge?: number // seconds
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean // Note: Can't be set from JS for security
}

export const cookies = {
  set(name: string, value: string, options: CookieOptions = {}): void {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
    
    // Default options for session cookies
    const opts: CookieOptions = {
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
      // 30 days by default
      maxAge: 30 * 24 * 60 * 60,
      ...options
    }
    
    if (opts.expires) {
      cookie += `; expires=${opts.expires.toUTCString()}`
    } else if (opts.maxAge) {
      cookie += `; max-age=${opts.maxAge}`
    }
    
    if (opts.domain) {
      cookie += `; domain=${opts.domain}`
    }
    
    if (opts.path) {
      cookie += `; path=${opts.path}`
    }
    
    if (opts.secure) {
      cookie += '; secure'
    }
    
    if (opts.sameSite) {
      cookie += `; samesite=${opts.sameSite}`
    }
    
    document.cookie = cookie
  },
  
  get(name: string): string | null {
    const nameEq = `${encodeURIComponent(name)}=`
    const cookies = document.cookie.split(';')
    
    for (const cookie of cookies) {
      const trimmed = cookie.trim()
      if (trimmed.startsWith(nameEq)) {
        return decodeURIComponent(trimmed.substring(nameEq.length))
      }
    }
    
    return null
  },
  
  remove(name: string, options: Pick<CookieOptions, 'domain' | 'path'> = {}): void {
    this.set(name, '', {
      ...options,
      maxAge: 0,
      expires: new Date(0)
    })
  },
  
  // Helper to get the shared domain for local development
  getSharedDomain(): string | undefined {
    // For local development, we need to share cookies between ports
    const hostname = window.location.hostname
    
    // For localhost/127.0.0.1, we can't set a domain that works across ports
    // So we'll use a path-based approach instead
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined // Don't set domain for localhost
    }
    
    // For production, use the actual domain
    return hostname
  }
}

// Specialized session cookie functions
export const sessionCookies = {
  getCookieName(prefix: string = ''): string {
    return `${prefix}bsky_session`
  },
  
  save(session: any, prefix: string = ''): void {
    try {
      const sessionStr = JSON.stringify(session)
      const cookieName = this.getCookieName(prefix)
      
      // Don't use secure flag on localhost to ensure cookie is set
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1'
      
      cookies.set(cookieName, sessionStr, {
        domain: cookies.getSharedDomain(),
        secure: !isLocalhost && window.location.protocol === 'https:',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })
      
      // Verify cookie was set
      const savedCookie = cookies.get(cookieName)
      if (!savedCookie) {
        debug.error('Cookie was not set successfully for', cookieName)
      } else {
        debug.log(`Session cookie saved successfully: ${cookieName} (${sessionStr.length} chars)`)
      }
    } catch (error) {
      debug.error('Failed to save session to cookie:', error)
    }
  },
  
  load(prefix: string = ''): any | null {
    try {
      const cookieName = this.getCookieName(prefix)
      debug.log('Loading cookie:', cookieName)
      
      const sessionStr = cookies.get(cookieName)
      debug.log('Cookie value length:', sessionStr ? sessionStr.length : 0)
      
      if (!sessionStr) return null
      
      const session = JSON.parse(sessionStr)
      debug.log('Parsed session from cookie:', {
        handle: session.handle,
        hasDid: !!session.did,
        hasAccessJwt: !!session.accessJwt,
        hasRefreshJwt: !!session.refreshJwt,
        keys: Object.keys(session)
      })
      return session
    } catch (error) {
      debug.error('Failed to load session from cookie:', error)
      return null
    }
  },
  
  clear(prefix: string = ''): void {
    const cookieName = this.getCookieName(prefix)
    debug.log('Clearing cookie:', cookieName)
    cookies.remove(cookieName, {
      domain: cookies.getSharedDomain()
    })
  }
}