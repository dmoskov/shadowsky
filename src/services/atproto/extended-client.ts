/**
 * Extended AT Protocol client that supports email 2FA
 */

import { ATProtoClient, debug } from "@bsky/shared";

export class ExtendedATProtoClient extends ATProtoClient {
  async loginWithAuthFactor(
    identifier: string,
    password: string,
    authFactorToken?: string,
  ) {
    try {
      // First, try the standard login method
      if (!authFactorToken) {
        return await this.login(identifier, password);
      }

      // If we have an auth factor token, we need to use the agent directly
      const loginPayload: any = {
        identifier,
        password,
      };

      // Add auth factor token if provided
      if (authFactorToken) {
        loginPayload.authFactorToken = authFactorToken;
      }

      debug.log("Attempting login with auth factor token");

      // Use the agent's login method which supports authFactorToken
      const response = await this.agent.login(loginPayload);

      // Update our internal session state
      if (response.success) {
        // The parent class should handle session persistence
        return response.data;
      }

      throw new Error("Login failed");
    } catch (error: any) {
      debug.error("Login with auth factor error:", error);

      // Check if this is an auth factor required error
      if (
        error?.status === "AuthFactorTokenRequired" ||
        error?.error === "AuthFactorTokenRequired" ||
        error?.message?.includes("AuthFactorTokenRequired")
      ) {
        // Re-throw with a more user-friendly message
        const authError = new Error(
          "A sign in code has been sent to your email address",
        );
        (authError as any).status = "AuthFactorTokenRequired";
        (authError as any).originalError = error;
        throw authError;
      }

      throw error;
    }
  }
}
