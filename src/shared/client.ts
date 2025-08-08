/**
 * AT Protocol client wrapper
 */

import type { AtpSessionData, AtpSessionEvent } from "@atproto/api";
import { BskyAgent } from "@atproto/api";
import { deleteCookie, getCookie, setCookie } from "../utils/cookies";
import { debug } from "./debug";

export interface ATProtoConfig {
  service: string;
  persistSession?: boolean;
  sessionPrefix?: string;
  enableRateLimiting?: boolean;
}

export interface Session extends AtpSessionData {
  did: string;
  handle: string;
  email?: string;
  emailConfirmed?: boolean;
  accessJwt: string;
  refreshJwt: string;
}

export class ATProtoClient {
  agent: BskyAgent;
  private config: ATProtoConfig;
  private sessionKey: string;

  constructor(config: ATProtoConfig) {
    this.config = config;
    this.sessionKey = `${config.sessionPrefix || ""}bsky_session`;

    this.agent = new BskyAgent({
      service: config.service,
      persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
        if (config.persistSession && sess) {
          this.saveSession(sess as Session);
        } else if (evt === "expired" || evt === "create-failed") {
          this.clearSession();
        }
      },
    });
  }

  async login(identifier: string, password: string): Promise<Session> {
    try {
      const response = await this.agent.login({ identifier, password });
      const session = response.data as Session;

      if (this.config.persistSession) {
        this.saveSession(session);
      }

      return session;
    } catch (error) {
      debug.error("Login failed:", error);
      throw error;
    }
  }

  async resumeSession(session: Session): Promise<Session> {
    try {
      const response = await this.agent.resumeSession(session);
      return response.data as Session;
    } catch (error) {
      debug.error("Resume session failed:", error);
      throw error;
    }
  }

  async refreshSession(): Promise<Session | null> {
    try {
      // The agent might not have a refreshSession method
      // Fall back to resuming with current session
      const currentSession = ATProtoClient.loadSavedSession(
        this.config.sessionPrefix || "",
      );
      if (currentSession) {
        return await this.resumeSession(currentSession);
      }
      return null;
    } catch (error) {
      debug.error("Refresh session failed:", error);
      return null;
    }
  }

  logout() {
    this.clearSession();
  }

  updateService(serviceUrl: string) {
    // Create a new agent with the updated service URL
    this.agent = new BskyAgent({
      service: serviceUrl,
    });
  }

  getSessionPrefix(): string {
    return this.config.sessionPrefix || "";
  }

  private saveSession(session: Session) {
    if (typeof window !== "undefined") {
      // Use cookies for cross-subdomain access
      setCookie(this.sessionKey, JSON.stringify(session), {
        secure: true,
        sameSite: "lax",
      });
      // Also save to localStorage for backward compatibility
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    }
  }

  private clearSession() {
    if (typeof window !== "undefined") {
      // Clear from both cookie and localStorage
      deleteCookie(this.sessionKey);
      localStorage.removeItem(this.sessionKey);
    }
  }

  static loadSavedSession(prefix: string = ""): Session | null {
    if (typeof window === "undefined") return null;

    try {
      const sessionKey = `${prefix}bsky_session`;
      // Try to load from cookie first (for cross-subdomain access)
      let saved = getCookie(sessionKey);

      // Fall back to localStorage if cookie not found
      if (!saved) {
        saved = localStorage.getItem(sessionKey);
        // If found in localStorage, migrate to cookie
        if (saved) {
          setCookie(sessionKey, saved, {
            secure: true,
            sameSite: "lax",
          });
        }
      }

      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }
}
