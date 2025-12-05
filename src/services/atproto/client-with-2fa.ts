/**
 * AT Protocol client with email 2FA support
 * This wraps the existing client and adds support for email authentication factors
 */

import type { ATProtoClient, Session } from "@bsky/shared";

/**
 * Error with 2FA status information
 */
export interface AuthFactorError extends Error {
  status?: string;
  error?: string;
  originalError?: Error;
}

export class ATProtoClientWith2FA {
  private client: ATProtoClient;

  constructor(client: ATProtoClient) {
    this.client = client;
  }

  async login(
    identifier: string,
    password: string,
    authFactorToken?: string,
  ): Promise<Session> {
    try {
      // No need to save credentials - auth factor token is passed directly

      // Check if the underlying client supports auth factor tokens
      if (authFactorToken && this.client.agent?.login) {
        // Use the agent's login method which supports authFactorToken
        const response = await this.client.agent.login({
          identifier,
          password,
          authFactorToken,
        });

        // Login successful
        return response.data as Session;
      } else {
        // Fall back to standard login
        return await this.client.login(identifier, password);
      }
    } catch (error: unknown) {
      const authError = error as AuthFactorError;
      // Check if this is an auth factor required error
      if (
        authError?.status === "AuthFactorTokenRequired" ||
        authError?.error === "AuthFactorTokenRequired" ||
        authError?.message?.includes("AuthFactorTokenRequired") ||
        authError?.message?.includes("sign in code has been sent")
      ) {
        // Re-throw with consistent error format but preserve the status
        const newError = new Error(
          "A sign in code has been sent to your email address",
        ) as AuthFactorError;
        newError.status = "AuthFactorTokenRequired";
        newError.originalError = error instanceof Error ? error : undefined;
        throw newError;
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Delegate all other methods to the underlying client
  logout() {
    return this.client.logout();
  }

  updateService(serviceUrl: string) {
    return this.client.updateService(serviceUrl);
  }

  getSessionPrefix() {
    return this.client.getSessionPrefix();
  }

  resumeSession(session: Session): Promise<Session> {
    return this.client.resumeSession(session);
  }

  refreshSession() {
    return this.client.refreshSession();
  }

  get agent() {
    return this.client.agent;
  }
}
