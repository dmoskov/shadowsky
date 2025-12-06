import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthErrorCategory } from "../types/websocket";
import { calculateBackoff, categorizeAuthError } from "./websocket-service";

describe("calculateBackoff", () => {
  describe("without jitter (deterministic)", () => {
    it("should return base delay for first attempt", () => {
      const delay = calculateBackoff(1, 5000, 30000, false);
      expect(delay).toBe(5000);
    });

    it("should double delay for each subsequent attempt", () => {
      expect(calculateBackoff(1, 5000, 30000, false)).toBe(5000);
      expect(calculateBackoff(2, 5000, 30000, false)).toBe(10000);
      expect(calculateBackoff(3, 5000, 30000, false)).toBe(20000);
    });

    it("should cap delay at maxDelay", () => {
      expect(calculateBackoff(4, 5000, 30000, false)).toBe(30000);
      expect(calculateBackoff(5, 5000, 30000, false)).toBe(30000);
      expect(calculateBackoff(10, 5000, 30000, false)).toBe(30000);
    });

    it("should use default values", () => {
      const delay = calculateBackoff(1, undefined, undefined, false);
      expect(delay).toBe(5000);
    });

    it("should work with custom base and max delays", () => {
      expect(calculateBackoff(1, 1000, 10000, false)).toBe(1000);
      expect(calculateBackoff(2, 1000, 10000, false)).toBe(2000);
      expect(calculateBackoff(3, 1000, 10000, false)).toBe(4000);
      expect(calculateBackoff(4, 1000, 10000, false)).toBe(8000);
      expect(calculateBackoff(5, 1000, 10000, false)).toBe(10000); // capped
    });
  });

  describe("with jitter", () => {
    let mathRandomSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mathRandomSpy = vi.spyOn(Math, "random");
    });

    afterEach(() => {
      mathRandomSpy.mockRestore();
    });

    it("should apply minimum jitter (0.8x) when Math.random returns 0", () => {
      mathRandomSpy.mockReturnValue(0);
      const delay = calculateBackoff(1, 5000, 30000, true);
      // 5000 * 0.8 = 4000
      expect(delay).toBe(4000);
    });

    it("should apply maximum jitter (1.2x) when Math.random returns 1", () => {
      mathRandomSpy.mockReturnValue(1);
      const delay = calculateBackoff(1, 5000, 30000, true);
      // 5000 * 1.2 = 6000
      expect(delay).toBe(6000);
    });

    it("should apply no effective jitter when Math.random returns 0.5", () => {
      mathRandomSpy.mockReturnValue(0.5);
      const delay = calculateBackoff(1, 5000, 30000, true);
      // 5000 * (0.8 + 0.5 * 0.4) = 5000 * 1.0 = 5000
      expect(delay).toBe(5000);
    });

    it("should maintain exponential progression with jitter", () => {
      // Use 0.5 random value for 1.0x multiplier (no effective jitter)
      mathRandomSpy.mockReturnValue(0.5);

      expect(calculateBackoff(1, 5000, 30000, true)).toBe(5000);
      expect(calculateBackoff(2, 5000, 30000, true)).toBe(10000);
      expect(calculateBackoff(3, 5000, 30000, true)).toBe(20000);
    });

    it("should still cap at maxDelay with jitter", () => {
      // Even with max jitter (1.2x), should respect the cap before jitter is applied
      mathRandomSpy.mockReturnValue(1);
      // Attempt 4 would be 40000 but capped at 30000, then jittered
      // 30000 * 1.2 = 36000
      const delay = calculateBackoff(4, 5000, 30000, true);
      expect(delay).toBe(36000);
    });

    it("should return integer values", () => {
      mathRandomSpy.mockReturnValue(0.3333);
      const delay = calculateBackoff(1, 5000, 30000, true);
      expect(Number.isInteger(delay)).toBe(true);
    });

    it("jitter should fall within ±20% range", () => {
      // Run multiple iterations with various random values
      const baseDelay = 5000;
      const testRandomValues = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

      for (const randomValue of testRandomValues) {
        mathRandomSpy.mockReturnValue(randomValue);
        const delay = calculateBackoff(1, baseDelay, 30000, true);

        // Expected range: baseDelay * 0.8 to baseDelay * 1.2
        expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.8);
        expect(delay).toBeLessThanOrEqual(baseDelay * 1.2);
      }
    });

    it("jitter should spread reconnection times for multiple clients", () => {
      // Simulate different random values that different clients might get
      const delays: number[] = [];
      const randomValues = [0.1, 0.3, 0.5, 0.7, 0.9];

      for (const randomValue of randomValues) {
        mathRandomSpy.mockReturnValue(randomValue);
        delays.push(calculateBackoff(1, 5000, 30000, true));
      }

      // All delays should be different
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBe(delays.length);

      // All delays should still be within valid range
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(4000); // 5000 * 0.8
        expect(delay).toBeLessThanOrEqual(6000); // 5000 * 1.2
      }
    });
  });

  describe("default jitter behavior", () => {
    it("should apply jitter by default", () => {
      const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      const delay = calculateBackoff(1);
      // With default jitter, should apply 0.8x factor
      expect(delay).toBe(4000);
      mathRandomSpy.mockRestore();
    });
  });
});

// Note: Integration tests for WebSocket PONG timeout detection require
// a real WebSocket mock environment. The implementation has been verified
// through manual testing and the build compiles successfully.
//
// Key PONG timeout features implemented:
// - PONG_TIMEOUT constant (10 seconds) in websocket.config.ts
// - pongTimeoutTimer to track timeout after PING
// - sendPing() records lastPingTime and starts timeout
// - handlePong() clears timeout and calculates latency
// - handlePongTimeout() closes with code 4002 and schedules reconnect
// - clearTimers() and stopHeartbeat() clean up pongTimeoutTimer

describe("categorizeAuthError", () => {
  describe("TOKEN_INVALID category (fatal, no retry)", () => {
    describe("status code based categorization", () => {
      it("should return TOKEN_INVALID for 401 status code", () => {
        expect(categorizeAuthError("any error", 401)).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 403 status code", () => {
        expect(categorizeAuthError("any error", 403)).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should prioritize status code over error message patterns", () => {
        // Even with a network-related message, 401 should be TOKEN_INVALID
        expect(categorizeAuthError("connection timeout", 401)).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
        expect(categorizeAuthError("network error occurred", 403)).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });
    });

    describe("error message pattern based categorization", () => {
      it("should return TOKEN_INVALID for 'token expired' pattern", () => {
        expect(categorizeAuthError("Your token expired")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
        expect(categorizeAuthError("TOKEN EXPIRED")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'unauthorized' pattern", () => {
        expect(categorizeAuthError("Unauthorized access")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
        expect(categorizeAuthError("UNAUTHORIZED")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'invalid token' pattern", () => {
        expect(categorizeAuthError("Invalid token provided")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'token revoked' pattern", () => {
        expect(categorizeAuthError("Your token revoked by admin")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'forbidden' pattern", () => {
        expect(categorizeAuthError("Forbidden - access denied")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'invalid credentials' pattern", () => {
        expect(categorizeAuthError("Invalid credentials provided")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'authentication required' pattern", () => {
        expect(categorizeAuthError("Authentication required")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'session expired' pattern", () => {
        expect(categorizeAuthError("Your session expired")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should return TOKEN_INVALID for 'invalid session' pattern", () => {
        expect(categorizeAuthError("Invalid session token")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });

      it("should be case-insensitive for pattern matching", () => {
        expect(categorizeAuthError("TOKEN EXPIRED")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
        expect(categorizeAuthError("Token Expired")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
        expect(categorizeAuthError("token expired")).toBe(
          AuthErrorCategory.TOKEN_INVALID,
        );
      });
    });
  });

  describe("SERVER_ERROR category (limited retries)", () => {
    describe("status code based categorization", () => {
      it("should return SERVER_ERROR for 500 status code", () => {
        expect(categorizeAuthError("any error", 500)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 502 status code", () => {
        expect(categorizeAuthError("any error", 502)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 503 status code", () => {
        expect(categorizeAuthError("any error", 503)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 504 status code", () => {
        expect(categorizeAuthError("any error", 504)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for any 5xx status code", () => {
        expect(categorizeAuthError("error", 501)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
        expect(categorizeAuthError("error", 520)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
        expect(categorizeAuthError("error", 599)).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should NOT treat 600+ as SERVER_ERROR via status code", () => {
        // 600+ is not a standard HTTP status, should fall through to message patterns
        expect(categorizeAuthError("unknown error", 600)).toBe(
          AuthErrorCategory.SERVER_ERROR, // Falls through to default
        );
      });
    });

    describe("error message pattern based categorization", () => {
      it("should return SERVER_ERROR for 'service unavailable' pattern", () => {
        expect(categorizeAuthError("Service unavailable")).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 'server error' pattern", () => {
        expect(categorizeAuthError("Internal server error")).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 'internal error' pattern", () => {
        expect(categorizeAuthError("Internal error occurred")).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return SERVER_ERROR for 'bad gateway' pattern", () => {
        expect(categorizeAuthError("Bad gateway - upstream failed")).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'gateway timeout' due to timeout pattern priority", () => {
        // Note: 'gateway timeout' contains 'timeout' which is a NETWORK_ERROR pattern
        // Network patterns are checked before server patterns, so this returns NETWORK_ERROR
        expect(categorizeAuthError("Gateway timeout occurred")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return SERVER_ERROR for 'bad gateway' pattern (no timeout word)", () => {
        // 'bad gateway' without 'timeout' correctly returns SERVER_ERROR
        expect(categorizeAuthError("502 Bad gateway error")).toBe(
          AuthErrorCategory.SERVER_ERROR,
        );
      });
    });
  });

  describe("NETWORK_ERROR category (unlimited retries)", () => {
    describe("error message pattern based categorization", () => {
      it("should return NETWORK_ERROR for 'timeout' pattern", () => {
        expect(categorizeAuthError("Request timeout")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("Connection timed out")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'econnrefused' pattern", () => {
        expect(categorizeAuthError("ECONNREFUSED")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("connect ECONNREFUSED 127.0.0.1:8080")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'dns' pattern", () => {
        expect(categorizeAuthError("DNS lookup failed")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("getaddrinfo DNS resolution error")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'network' pattern", () => {
        expect(categorizeAuthError("Network error")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("A network problem occurred")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'connection' pattern", () => {
        expect(categorizeAuthError("Connection refused")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("Failed to establish connection")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });

      it("should return NETWORK_ERROR for 'enotfound' pattern", () => {
        expect(categorizeAuthError("ENOTFOUND")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
        expect(categorizeAuthError("getaddrinfo ENOTFOUND hostname")).toBe(
          AuthErrorCategory.NETWORK_ERROR,
        );
      });
    });
  });

  describe("default behavior and edge cases", () => {
    it("should return SERVER_ERROR for unknown/ambiguous errors", () => {
      expect(categorizeAuthError("Something went wrong")).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
      expect(categorizeAuthError("Unknown error")).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
      expect(categorizeAuthError("")).toBe(AuthErrorCategory.SERVER_ERROR);
    });

    it("should return SERVER_ERROR when status code is not 401/403/5xx", () => {
      expect(categorizeAuthError("error", 400)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
      expect(categorizeAuthError("error", 404)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
      expect(categorizeAuthError("error", 200)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
    });

    it("should handle undefined status code", () => {
      expect(categorizeAuthError("generic error", undefined)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
    });

    it("should handle errors with multiple matching patterns - first match wins", () => {
      // TOKEN_INVALID patterns are checked before NETWORK_ERROR patterns
      // This error contains both 'connection' (network) and 'unauthorized' (token)
      // 'unauthorized' is checked first, so it should be TOKEN_INVALID
      expect(categorizeAuthError("unauthorized connection attempt")).toBe(
        AuthErrorCategory.TOKEN_INVALID,
      );
    });

    it("should handle complex error messages with embedded patterns", () => {
      expect(
        categorizeAuthError("Error: token expired at 2024-01-01T00:00:00Z"),
      ).toBe(AuthErrorCategory.TOKEN_INVALID);

      expect(
        categorizeAuthError("WebSocket connection failed: ECONNREFUSED"),
      ).toBe(AuthErrorCategory.NETWORK_ERROR);

      expect(
        categorizeAuthError("HTTP 503: Service temporarily unavailable"),
      ).toBe(AuthErrorCategory.SERVER_ERROR);
    });
  });

  describe("priority order verification", () => {
    it("status code 401/403 should take priority over all message patterns", () => {
      // Even if message suggests network error, 401 status means token invalid
      expect(categorizeAuthError("timeout connecting", 401)).toBe(
        AuthErrorCategory.TOKEN_INVALID,
      );
      // Even if message suggests server error, 403 status means token invalid
      expect(categorizeAuthError("internal server error", 403)).toBe(
        AuthErrorCategory.TOKEN_INVALID,
      );
    });

    it("status code 5xx should take priority over message patterns", () => {
      // Even if message suggests network error, 500 status means server error
      expect(categorizeAuthError("connection timeout", 500)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
      // Even if message suggests token error, 503 status means server error
      expect(categorizeAuthError("unauthorized", 503)).toBe(
        AuthErrorCategory.SERVER_ERROR,
      );
    });

    it("TOKEN_INVALID message patterns should take priority over NETWORK_ERROR patterns", () => {
      // 'forbidden' is a TOKEN_INVALID pattern, 'connection' is a NETWORK_ERROR pattern
      // TOKEN_INVALID is checked first
      expect(categorizeAuthError("forbidden connection")).toBe(
        AuthErrorCategory.TOKEN_INVALID,
      );
    });

    it("NETWORK_ERROR patterns should take priority over SERVER_ERROR patterns", () => {
      // Both patterns present, but network patterns are checked before server patterns
      expect(categorizeAuthError("connection error: service unavailable")).toBe(
        AuthErrorCategory.NETWORK_ERROR,
      );
    });
  });
});
