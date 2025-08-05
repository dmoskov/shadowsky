/**
 * Cookie utility functions for cross-subdomain authentication
 */

interface CookieOptions {
  expires?: Date
  maxAge?: number
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

/**
 * Set a cookie with proper domain configuration for cross-subdomain access
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}) {
  if (typeof document === 'undefined') return

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  // Set domain to root domain for cross-subdomain access
  // Extract root domain from current hostname
  const hostname = window.location.hostname
  let domain = options.domain

  if (!domain && hostname !== 'localhost') {
    // For shadowsky.io domains, use the root domain
    if (hostname.includes('shadowsky.io')) {
      domain = '.shadowsky.io'
    } else {
      // For other domains, try to extract the root domain
      const parts = hostname.split('.')
      if (parts.length > 2) {
        domain = '.' + parts.slice(-2).join('.')
      }
    }
  }

  if (domain) {
    cookieString += `; Domain=${domain}`
  }

  // Default to root path for accessibility across all routes
  cookieString += `; Path=${options.path || '/'}`

  // Set expiration (default to 30 days if not specified)
  if (options.expires) {
    cookieString += `; Expires=${options.expires.toUTCString()}`
  } else if (options.maxAge) {
    cookieString += `; Max-Age=${options.maxAge}`
  } else {
    // Default to 30 days
    const defaultExpires = new Date()
    defaultExpires.setDate(defaultExpires.getDate() + 30)
    cookieString += `; Expires=${defaultExpires.toUTCString()}`
  }

  // Security settings
  if (options.secure !== false && window.location.protocol === 'https:') {
    cookieString += '; Secure'
  }

  // SameSite attribute (default to 'lax' for security)
  cookieString += `; SameSite=${options.sameSite || 'lax'}`

  document.cookie = cookieString
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const nameEQ = encodeURIComponent(name) + '='
  const cookies = document.cookie.split(';')

  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length))
    }
  }

  return null
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, options: Pick<CookieOptions, 'domain' | 'path'> = {}) {
  if (typeof document === 'undefined') return

  // Extract domain logic same as setCookie
  const hostname = window.location.hostname
  let domain = options.domain

  if (!domain && hostname !== 'localhost') {
    if (hostname.includes('shadowsky.io')) {
      domain = '.shadowsky.io'
    } else {
      const parts = hostname.split('.')
      if (parts.length > 2) {
        domain = '.' + parts.slice(-2).join('.')
      }
    }
  }

  setCookie(name, '', {
    ...options,
    domain,
    expires: new Date(0),
    maxAge: 0
  })
}

/**
 * Check if cookies are enabled
 */
export function areCookiesEnabled(): boolean {
  if (typeof document === 'undefined') return false

  try {
    const testKey = '__cookie_test__'
    setCookie(testKey, 'test', { maxAge: 60 })
    const result = getCookie(testKey) === 'test'
    deleteCookie(testKey)
    return result
  } catch {
    return false
  }
}