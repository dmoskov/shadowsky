import {BskyAgent, AtpSessionData, AtpSessionEvent} from '@atproto/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

const AUTH_STORAGE_KEY = '@shadowsky/auth_session';

/**
 * AT Protocol Client Wrapper
 * Manages authentication and provides a configured BskyAgent instance
 */
export class AtProtoClient {
  private agent: BskyAgent;
  private session: AtpSessionData | null = null;

  constructor(service: string = 'https://bsky.social') {
    this.agent = new BskyAgent({
      service,
      persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
        if (evt === 'update' && sess) {
          this.session = sess;
          AsyncStorage.getItem(AUTH_STORAGE_KEY).then(stored => {
            if (stored) {
              const parsed = JSON.parse(stored);
              const updated = {...parsed, accessJwt: sess.accessJwt, refreshJwt: sess.refreshJwt};
              AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
            }
          }).catch(() => {});
        } else if (evt === 'expired') {
          this.session = null;
          AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
        }
      },
    });
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
    return rateLimited(
      async () => {
        const response = await this.agent.login({identifier, password});
        this.session = response.data as AtpSessionData;
        return this.session;
      },
      ATProtoEndpointType.AUTH
    );
  }

  /**
   * Resume session with stored data
   */
  async resumeSession(sessionData: AtpSessionData) {
    return rateLimited(
      async () => {
        await this.agent.resumeSession(sessionData);
        this.session = sessionData;
        return this.agent;
      },
      ATProtoEndpointType.AUTH
    );
  }

  /**
   * Refresh the current session
   */
  async refreshSession() {
    if (!this.session) {
      throw new Error('No active session to refresh');
    }
    return rateLimited(
      async () => {
        // BskyAgent handles token refresh automatically
        // Just verify the session is still valid
        try {
          await this.agent.getProfile({actor: this.session!.did});
          return this.session!;
        } catch (error) {
          // Session is invalid, need to re-authenticate
          throw new Error('Session expired, please log in again');
        }
      },
      ATProtoEndpointType.AUTH
    );
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

/**
 * Get the agent from the global client instance
 */
export function getAgent(): BskyAgent {
  const client = getAtProtoClient();
  return client.getAgent();
}
