/**
 * Extended AT Protocol client that supports email 2FA
 */

import { ATProtoClient, debug, Session } from "@bsky/shared";
import { AuthFactorError } from "./client-with-2fa";

/**
 * Login payload with optional auth factor token
 */
interface LoginPayload {
  identifier: string;
  password: string;
  authFactorToken?: string;
}

export class ExtendedATProtoClient extends ATProtoClient {
  async loginWithAuthFactor(
    identifier: string,
    password: string,
    authFactorToken?: string,
  ): Promise<Session> {
    try {
      // First, try the standard login method
      if (!authFactorToken) {
        return await this.login(identifier, password);
      }

      // If we have an auth factor token, we need to use the agent directly
      const loginPayload: LoginPayload = {
        identifier,
        password,
        authFactorToken,
      };

      debug.log("Attempting login with auth factor token");

      // Use the agent's login method which supports authFactorToken
      const response = await this.agent.login(loginPayload);

      // Update our internal session state
      if (response.success) {
        // The parent class should handle session persistence
        return response.data as Session;
      }

      throw new Error("Login failed");
    } catch (error: unknown) {
      debug.error("Login with auth factor error:", error);

      const authErr = error as AuthFactorError;
      // Check if this is an auth factor required error
      if (
        authErr?.status === "AuthFactorTokenRequired" ||
        authErr?.error === "AuthFactorTokenRequired" ||
        authErr?.message?.includes("AuthFactorTokenRequired")
      ) {
        // Re-throw with a more user-friendly message
        const newError = new Error(
          "A sign in code has been sent to your email address",
        ) as AuthFactorError;
        newError.status = "AuthFactorTokenRequired";
        newError.originalError = error instanceof Error ? error : undefined;
        throw newError;
      }

      throw error;
    }
  }
}
