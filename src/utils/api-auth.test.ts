/**
 * Tests for API Authentication Helper
 *
 * Coverage targets:
 * 1. Session management (set, get)
 * 2. Authentication status checking
 * 3. Header generation
 * 4. Header merging with different input types
 * 5. RequestInit creation with auth
 */

import type { Session } from "@bsky/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getApiAuthHeaders,
  getCurrentUserDid,
  isApiAuthenticated,
  mergeAuthHeaders,
  setApiAuthSession,
  withAuth,
} from "./api-auth";

describe("api-auth", () => {
  const mockSession: Session = {
    did: "did:plc:test123",
    handle: "test.bsky.social",
    email: "test@example.com",
    accessJwt: "access-token",
    refreshJwt: "refresh-token",
  };

  beforeEach(() => {
    // Reset session before each test
    setApiAuthSession(null);
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
      setApiAuthSession(sessionWithoutDid as Session);

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
      setApiAuthSession(sessionWithoutDid as Session);

      expect(isApiAuthenticated()).toBe(false);
    });
  });

  describe("getApiAuthHeaders", () => {
    it("should return empty object when not authenticated", () => {
      const headers = getApiAuthHeaders();

      expect(headers).toEqual({});
    });

    it("should return auth headers when authenticated", () => {
      setApiAuthSession(mockSession);

      const headers = getApiAuthHeaders();

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

    it("should merge with undefined headers", () => {
      const result = mergeAuthHeaders(undefined);

      expect(result).toEqual({
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });

    it("should merge with plain object headers", () => {
      const existingHeaders = {
        "Content-Type": "application/json",
        Accept: "*/*",
      };

      const result = mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
        Accept: "*/*",
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });

    it("should merge with Headers object", () => {
      const existingHeaders = new Headers({
        "Content-Type": "application/json",
        Accept: "*/*",
      });

      const result = mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "content-type": "application/json",
        accept: "*/*",
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });

    it("should merge with array of tuples headers", () => {
      const existingHeaders: [string, string][] = [
        ["Content-Type", "application/json"],
        ["Accept", "*/*"],
      ];

      const result = mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
        Accept: "*/*",
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });

    it("should not override existing auth headers", () => {
      const existingHeaders = {
        "X-User-DID": "did:plc:existing",
        "Content-Type": "application/json",
      };

      const result = mergeAuthHeaders(existingHeaders);

      // Auth headers are added after existing headers, so they override
      expect(result["X-User-DID"]).toBe("did:plc:test123");
    });

    it("should return only existing headers when not authenticated", () => {
      setApiAuthSession(null);

      const existingHeaders = {
        "Content-Type": "application/json",
      };

      const result = mergeAuthHeaders(existingHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
      });
    });
  });

  describe("withAuth", () => {
    beforeEach(() => {
      setApiAuthSession(mockSession);
    });

    it("should create RequestInit with auth headers", () => {
      const result = withAuth();

      expect(result).toEqual({
        headers: {
          "X-User-DID": "did:plc:test123",
          "X-Bluesky-DID": "did:plc:test123",
        },
      });
    });

    it("should preserve existing RequestInit options", () => {
      const init: RequestInit = {
        method: "POST",
        body: JSON.stringify({ test: "data" }),
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = withAuth(init);

      expect(result).toEqual({
        method: "POST",
        body: JSON.stringify({ test: "data" }),
        headers: {
          "Content-Type": "application/json",
          "X-User-DID": "did:plc:test123",
          "X-Bluesky-DID": "did:plc:test123",
        },
      });
    });

    it("should work with empty RequestInit", () => {
      const result = withAuth({});

      expect(result).toEqual({
        headers: {
          "X-User-DID": "did:plc:test123",
          "X-Bluesky-DID": "did:plc:test123",
        },
      });
    });

    it("should work with Headers object in RequestInit", () => {
      const init: RequestInit = {
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      };

      const result = withAuth(init);

      expect(result.headers).toEqual({
        "content-type": "application/json",
        "X-User-DID": "did:plc:test123",
        "X-Bluesky-DID": "did:plc:test123",
      });
    });

    it("should return RequestInit without auth when not authenticated", () => {
      setApiAuthSession(null);

      const init: RequestInit = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = withAuth(init);

      expect(result).toEqual({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });
});
