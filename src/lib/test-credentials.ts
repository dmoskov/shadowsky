import { debug } from '@bsky/shared'

/**
 * Secure test credentials helper
 * This module provides a type-safe way to access test credentials
 * from environment variables instead of hardcoded values.
 */

export interface TestCredentials {
  identifier: string
  password: string
}

/**
 * Get test credentials from environment variables
 * @throws Error if credentials are not properly configured
 */
export function getTestCredentials(): TestCredentials {
  const identifier = import.meta.env.VITE_TEST_IDENTIFIER
  const password = import.meta.env.VITE_TEST_PASSWORD

  if (!identifier || !password) {
    throw new Error(
      'Test credentials not configured. Please copy .env.example to .env.local and fill in your test account details.'
    )
  }

  // Basic validation
  if (!identifier.includes('@') && !identifier.includes('.')) {
    debug.warn('Test identifier appears to be invalid. Expected email or handle format.')
  }

  return {
    identifier,
    password
  }
}

/**
 * Check if test credentials are available
 */
export function hasTestCredentials(): boolean {
  return !!(
    import.meta.env.VITE_TEST_IDENTIFIER && 
    import.meta.env.VITE_TEST_PASSWORD
  )
}

/**
 * Parse legacy .test-credentials file format
 * @deprecated Use environment variables instead
 */
export function parseLegacyCredentials(content: string): TestCredentials | null {
  const lines = content.split('\n')
  let identifier = ''
  let password = ''
  
  for (const line of lines) {
    if (line.startsWith('TEST_USER=')) {
      identifier = line.split('=')[1]?.trim() || ''
    } else if (line.startsWith('TEST_PASS=')) {
      password = line.split('=')[1]?.trim() || ''
    }
  }
  
  if (!identifier || !password) {
    return null
  }
  
  return { identifier, password }
}