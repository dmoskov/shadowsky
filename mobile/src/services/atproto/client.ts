import {BskyAgent, AtpSessionData} from '@atproto/api';

/**
 * AT Protocol Client Wrapper
 * Manages authentication and provides a configured BskyAgent instance
 */
export class AtProtoClient {
  private agent: BskyAgent;
  private session: AtpSessionData | null = null;

  constructor(service: string = 'https://bsky.social') {
    this.agent = new BskyAgent({service});
  }

  /**
   * Initialize client with existing session
   */
  async initialize(sessionData: AtpSessionData) {
    this.session = sessionData;
    await this.agent.resumeSession(sessionData);
    return this.agent;
  }

  /**
   * Login with identifier and password
   */
  async login(identifier: string, password: string) {
    const response = await this.agent.login({identifier, password});
    this.session = response.data;
    return this.session;
  }

  /**
   * Resume session with stored data
   */
  async resumeSession(sessionData: AtpSessionData) {
    await this.agent.resumeSession(sessionData);
    this.session = sessionData;
    return this.agent;
  }

  /**
   * Refresh the current session
   */
  async refreshSession() {
    if (!this.session) {
      throw new Error('No active session to refresh');
    }
    // BskyAgent handles token refresh automatically
    // Just verify the session is still valid
    try {
      await this.agent.getProfile({actor: this.session.did});
      return this.session;
    } catch (error) {
      // Session is invalid, need to re-authenticate
      throw new Error('Session expired, please log in again');
    }
  }

  /**
   * Logout and clear session
   */
  async logout() {
    this.session = null;
    // Note: BskyAgent doesn't have a logout method
    // Session cleanup happens on the client side
  }

  /**
   * Get the current agent instance
   */
  getAgent(): BskyAgent {
    if (!this.session) {
      throw new Error('Not authenticated. Please login first.');
    }
    return this.agent;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null;
  }

  /**
   * Get current session data
   */
  getSession(): AtpSessionData | null {
    return this.session;
  }
}

// Global client instance
let clientInstance: AtProtoClient | null = null;

/**
 * Get or create the global AT Protocol client instance
 */
export function getAtProtoClient(): AtProtoClient {
  if (!clientInstance) {
    clientInstance = new AtProtoClient();
  }
  return clientInstance;
}

/**
 * Reset the global client instance (useful for logout)
 */
export function resetAtProtoClient() {
  clientInstance = null;
}
