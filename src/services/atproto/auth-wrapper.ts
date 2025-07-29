/**
 * Authentication wrapper that handles email 2FA for AT Protocol
 */

import { BskyAgent } from '@atproto/api'

export interface LoginOptions {
  identifier: string
  password: string
  authFactorToken?: string
}

export class AuthWrapper {
  private agent: BskyAgent

  constructor(serviceUrl: string = 'https://bsky.social') {
    this.agent = new BskyAgent({
      service: serviceUrl
    })
  }

  async login(options: LoginOptions) {
    const { identifier, password, authFactorToken } = options

    try {
      // Attempt login with optional auth factor token
      const response = await this.agent.login({
        identifier,
        password,
        authFactorToken
      })

      return response
    } catch (error: any) {
      // Check if this is an auth factor required error
      if (error?.status === 'AuthFactorTokenRequired' || 
          error?.error === 'AuthFactorTokenRequired' ||
          error?.message?.includes('AuthFactorTokenRequired')) {
        // Re-throw with a more user-friendly message
        const authError = new Error('A sign in code has been sent to your email address')
        ;(authError as any).status = 'AuthFactorTokenRequired'
        ;(authError as any).originalError = error
        throw authError
      }
      
      // Re-throw other errors as-is
      throw error
    }
  }

  getAgent() {
    return this.agent
  }
}