/**
 * Authentication wrapper that handles email 2FA for AT Protocol
 */

import { BskyAgent } from "@atproto/api";

export interface LoginOptions {
  identifier: string;
  password: string;
  authFactorToken?: string;
}

// Extended error type for auth factor required errors
interface AuthFactorError extends Error {
  status: "AuthFactorTokenRequired";
  originalError: unknown;
}

export class AuthWrapper {
  private agent: BskyAgent;

  constructor(serviceUrl: string = "https://bsky.social") {
    this.agent = new BskyAgent({
      service: serviceUrl,
    });
  }

  async login(options: LoginOptions) {
    const { identifier, password, authFactorToken } = options;

    try {
      // Attempt login with optional auth factor token
      const response = await this.agent.login({
        identifier,
        password,
        authFactorToken,
      });

      return response;
    } catch (error: unknown) {
      // Check if this is an auth factor required error
      const errObj = error as Record<string, unknown>;
      if (
        errObj?.status === "AuthFactorTokenRequired" ||
        errObj?.error === "AuthFactorTokenRequired" ||
        (typeof errObj?.message === "string" &&
          errObj.message.includes("AuthFactorTokenRequired"))
      ) {
        // Re-throw with a more user-friendly message
        const authError = new Error(
          "A sign in code has been sent to your email address",
        ) as AuthFactorError;
        authError.status = "AuthFactorTokenRequired";
        authError.originalError = error;
        throw authError;
      }

      // Re-throw other errors as-is
      throw error;
    }
  }

  getAgent() {
    return this.agent;
  }
}
