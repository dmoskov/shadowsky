/**
 * Tests for API Authentication Helper
 *
 * Coverage targets:
 * 1. Session management (set, get)
 * 2. Authentication status checking
 * 3. Header generation (service-auth token, legacy fallback)
 * 4. Header merging with different input types
 * 5. RequestInit creation with auth
 */

import type { BskyAgent } from "@atproto/api";
import type { Session } from "@bsky/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getApiAuthHeaders,
  getCurrentUserDid,
  isApiAuthenticated,
  mergeAuthHeaders,
  setApiAuthAgentProvider,
  setApiAuthSession,
  withAuth,
} from "./api-auth";

function fakeAgent(token: string | null) {
  const getServiceAuth = vi.fn(async () => {
    if (!token) throw new Error("PDS refused");
    return { success: true, headers: {}, data: { token } };
  });
  const agent = {
    com: { atproto: { server: { getServiceAuth } } },
  } as unknown as BskyAgent;
  return { agent, getServiceAuth };
}

describe("api-auth", () => {
  const mockSession: Session = {
    did: "did:plc:test123",
    handle: "test.bsky.social",
    email: "test@example.com",
    accessJwt: "access-token",
    refreshJwt: "refresh-token",
    active: true,
  };

  const bearer = { Authorization: "Bearer svc-token" };

  beforeEach(() => {
    // Reset session and agent before each test
    setApiAuthSession(null);
    setApiAuthAgentProvider(() => fakeAgent("svc-token").agent);
  });

  describe("setApiAuthSession", () => {
    it("should set the current session", () => {
      setApiAuthSession(mockSession);

      expect(getCurrentUserDid()).toBe("did:plc:test123");
    });

    it("should clear the session when set to null", () => {
      setApiAuthSession(mockSession);
      expect(getCurrentUserDid()).toBe("did:plc:test123");

      setApiAuthSession(null);
      expect(getCurrentUserDid()).toBeNull();
    });
  });

  describe("getCurrentUserDid", () => {
    it("should return null when no session is set", () => {
      expect(getCurrentUserDid()).toBeNull();
    });

    it("should return the DID when session is set", () => {
      setApiAuthSession(mockSession);

      expect(getCurrentUserDid()).toBe("did:plc:test123");
    });

    it("should return null for session without DID", () => {
      const sessionWithoutDid = { ...mockSession, did: undefined };
      setApiAuthSession(sessionWithoutDid as unknown as Session);

      expect(getCurrentUserDid()).toBeNull();
    });
  });

  describe("isApiAuthenticated", () => {
    it("should return false when no session is set", () => {
      expect(isApiAuthenticated()).toBe(false);
    });

    it("should return true when valid session is set", () => {
      setApiAuthSession(mockSession);

      expect(isApiAuthenticated()).toBe(true);
    });

    it("should return false for session without DID", () => {
      const sessionWithoutDid = { ...mockSession, did: undefined };
      setApiAuthSession(sessionWithoutDid as unknown as Session);

      expect(isApiAuthenticated()).toBe(false);
    });
  });

  describe("getApiAuthHeaders", () => {
    it("should return empty object when not authenticated", async () => {
      const headers = await getApiAuthHeaders();

      expect(headers).toEqual({});
    });

    it("should return a service-auth bearer token when authenticated", async () => {
      const { agent, getServiceAuth } = fakeAgent("svc-token");
      setApiAuthAgentProvider(() => agent);
      setApiAuthSession(mockSession);

      const headers = await getApiAuthHeaders();

      expect(headers).toEqual(bearer);
      expect(getServiceAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          aud: "did:web:api.asphodel.is",
          lxm: "is.asphodel.api.auth",
        }),
      );
    });

    it("should reuse the token across requests for the same account", async () => {
      const { agent, getServiceAuth } = fakeAgent("svc-token");
      setApiAuthAgentProvider(() => agent);
      setApiAuthSession(mockSession);

      await getApiAuthHeaders();
      await getApiAuthHeaders();

      expect(getServiceAuth).toHaveBeenCalledTimes(1);
    });

    it("should mint a fresh token after switching accounts", async () => {
      const { agent, getServiceAuth } = fakeAgent("svc-token");
      setApiAuthAgentProvider(() => agent);
      setApiAuthSession(mockSession);
      await getApiAuthHeaders();

      setApiAuthSession({ ...mockSession, did: "did:plc:other" });
      await getApiAuthHeaders();

      expect(getServiceAuth).toHaveBeenCalledTimes(2);
    });

    it("should fall back to legacy DID headers when no token can be minted", async () => {
      setApiAuthAgentProvider(() => fakeAgent(null).agent);
      setApiAuthSession(mockSession);

      const headers = await getApiAuthHeaders();

      expect(headers).toEqual({
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });
  });

  describe("mergeAuthHeaders", () => {
    beforeEach(() => {
      setApiAuthSession(mockSession);
    });

    it("should merge with undefined headers", async () => {
      const result = await mergeAuthHeaders(undefined);

      expect(result).toEqual(bearer);
    });

    it("should merge with plain object headers", async () => {
      const existingHeaders = {
        "Content-Type": "application/json",
        Accept: "*/*",
      };

      const result = await mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
        Accept: "*/*",
        ...bearer,
      });
    });

    it("should merge with Headers object", async () => {
      const existingHeaders = new Headers({
        "Content-Type": "application/json",
        Accept: "*/*",
      });

      const result = await mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "content-type": "application/json",
        accept: "*/*",
        ...bearer,
      });
    });

    it("should merge with array of tuples headers", async () => {
      const existingHeaders: [string, string][] = [
        ["Content-Type", "application/json"],
        ["Accept", "*/*"],
      ];

      const result = await mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
        Accept: "*/*",
        ...bearer,
      });
    });

    it("should override an existing Authorization header", async () => {
      const existingHeaders = {
        Authorization: "Bearer stale",
        "Content-Type": "application/json",
      };

      const result = await mergeAuthHeaders(existingHeaders);

      // Auth headers are added after existing headers, so they override
      expect(result.Authorization).toBe("Bearer svc-token");
    });

    it("should return only existing headers when not authenticated", async () => {
      setApiAuthSession(null);

      const existingHeaders = {
        "Content-Type": "application/json",
      };

      const result = await mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
      });
    });
  });

  describe("withAuth", () => {
    beforeEach(() => {
      setApiAuthSession(mockSession);
    });

    it("should add auth headers to undefined init", async () => {
      const result = await withAuth(undefined);

      expect(result).toEqual({ headers: bearer });
    });

    it("should preserve other init options", async () => {
      const init: RequestInit = {
        method: "POST",
        body: JSON.stringify({ test: true }),
        headers: { "Content-Type": "application/json" },
      };

      const result = await withAuth(init);

      expect(result.method).toBe("POST");
      expect(result.body).toBe(JSON.stringify({ test: true }));
      expect(result.headers).toEqual({
        "Content-Type": "application/json",
        ...bearer,
      });
    });

    it("should not add auth headers when not authenticated", async () => {
      setApiAuthSession(null);

      const result = await withAuth({ method: "GET" });

      expect(result).toEqual({ method: "GET", headers: {} });
    });
  });
});
