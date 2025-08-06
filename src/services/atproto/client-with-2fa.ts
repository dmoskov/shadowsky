/**
 * AT Protocol client with email 2FA support
 * This wraps the existing client and adds support for email authentication factors
 */

export class ATProtoClientWith2FA {
  private client: any

  constructor(client: any) {
    this.client = client
  }

  async login(identifier: string, password: string, authFactorToken?: string) {
    try {
      // No need to save credentials - auth factor token is passed directly

      // Check if the underlying client supports auth factor tokens
      if (authFactorToken && this.client.agent?.login) {
        // Use the agent's login method which supports authFactorToken
        const response = await this.client.agent.login({
          identifier,
          password,
          authFactorToken
        })
        
        // Login successful
        return response.data
      } else {
        // Fall back to standard login
        return await this.client.login(identifier, password)
      }
    } catch (error: any) {
      // Check if this is an auth factor required error
      if (error?.status === 'AuthFactorTokenRequired' || 
          error?.error === 'AuthFactorTokenRequired' ||
          error?.message?.includes('AuthFactorTokenRequired') ||
          error?.message?.includes('sign in code has been sent')) {
        // Re-throw with consistent error format but preserve the status
        const authError = new Error('A sign in code has been sent to your email address')
        ;(authError as any).status = 'AuthFactorTokenRequired'
        ;(authError as any).originalError = error
        throw authError
      }
      
      // Re-throw other errors
      throw error
    }
  }

  // Delegate all other methods to the underlying client
  logout() {
    return this.client.logout()
  }

  updateService(serviceUrl: string) {
    return this.client.updateService(serviceUrl)
  }

  getSessionPrefix() {
    return this.client.getSessionPrefix()
  }

  resumeSession(session: any) {
    return this.client.resumeSession(session)
  }

  refreshSession() {
    return this.client.refreshSession()
  }

  get agent() {
    return this.client.agent
  }
}