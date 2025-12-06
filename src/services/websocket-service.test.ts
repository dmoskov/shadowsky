import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBackoff } from "./websocket-service";

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
