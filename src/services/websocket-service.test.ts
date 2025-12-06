import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WebSocketConnectionState,
  WebSocketEventType,
} from "../types/websocket";
import { calculateBackoff, WebSocketService } from "./websocket-service";

// Mock the debug module
vi.mock("@bsky/shared", () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose:
    | ((event: { code: number; reason: string; wasClean: boolean }) => void)
    | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({
        code: code || 1000,
        reason: reason || "",
        wasClean: true,
      });
    }
  });

  // Helper to simulate connection open
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  // Helper to simulate message received
  simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }
}

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

describe("WebSocketService PONG timeout detection", () => {
  let mockWs: MockWebSocket;
  let service: WebSocketService;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    // Store original WebSocket
    originalWebSocket = global.WebSocket;
    mockWs = new MockWebSocket();
    // Override close to not auto-trigger onclose (for testing timeout behavior)
    mockWs.close = vi.fn((code?: number, reason?: string) => {
      mockWs.readyState = MockWebSocket.CLOSED;
      // Don't auto-call onclose in tests - we control state manually
    });
    // @ts-expect-error - Mocking global WebSocket
    global.WebSocket = vi.fn(() => mockWs);
    service = new WebSocketService({
      url: "wss://test.example.com",
      debug: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
  });

  it("should start PONG timeout after sending PING", () => {
    // Connect without authentication (no accessToken)
    service.connect();
    // Simulate WebSocket open - this triggers the heartbeat to start
    mockWs.simulateOpen();

    // Verify connection is established
    expect(service.getConnectionState()).toBe(
      WebSocketConnectionState.CONNECTED,
    );

    // Heartbeat should start, wait for first ping (default 30s interval)
    vi.advanceTimersByTime(30000);

    // Verify PING was sent
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining(WebSocketEventType.PING),
    );

    // PONG timeout should be pending (10 seconds)
    // Verify by advancing time less than timeout
    vi.advanceTimersByTime(5000);
    expect(service.getConnectionState()).toBe(
      WebSocketConnectionState.CONNECTED,
    );
  });

  it("should clear PONG timeout when PONG is received", () => {
    service.connect();
    mockWs.simulateOpen();

    // Wait for first ping
    vi.advanceTimersByTime(30000);

    // Simulate PONG response
    mockWs.simulateMessage(
      JSON.stringify({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      }),
    );

    // Verify connection is still healthy after full PONG timeout would have elapsed
    vi.advanceTimersByTime(15000); // Past the 10s timeout
    expect(service.getConnectionState()).toBe(
      WebSocketConnectionState.CONNECTED,
    );
  });

  it("should trigger close on PONG timeout", () => {
    service.connect();
    mockWs.simulateOpen();

    // Wait for first ping
    vi.advanceTimersByTime(30000);

    // Do NOT send PONG, let timeout occur
    vi.advanceTimersByTime(10000); // PONG_TIMEOUT

    // Should close with code 4002
    expect(mockWs.close).toHaveBeenCalledWith(4002, "PONG timeout");
  });

  it("should track latency when PONG is received", () => {
    service.connect();
    mockWs.simulateOpen();

    // Wait for first ping
    vi.advanceTimersByTime(30000);

    // Simulate 50ms latency
    vi.advanceTimersByTime(50);
    mockWs.simulateMessage(
      JSON.stringify({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      }),
    );

    const stats = service.getStats();
    expect(stats.lastPingLatency).toBe(50);
    expect(stats.averageLatency).toBe(50);
  });

  it("should calculate average latency over multiple pings", () => {
    service.connect();
    mockWs.simulateOpen();

    // First ping/pong with 100ms latency
    vi.advanceTimersByTime(30000);
    vi.advanceTimersByTime(100);
    mockWs.simulateMessage(
      JSON.stringify({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      }),
    );

    // Second ping/pong with 50ms latency
    vi.advanceTimersByTime(30000 - 100); // Rest of interval
    vi.advanceTimersByTime(50);
    mockWs.simulateMessage(
      JSON.stringify({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      }),
    );

    const stats = service.getStats();
    expect(stats.lastPingLatency).toBe(50);
    expect(stats.averageLatency).toBe(75); // (100 + 50) / 2
  });

  it("should handle unsolicited PONG messages gracefully", () => {
    service.connect();
    mockWs.simulateOpen();

    // Verify connected
    expect(service.getConnectionState()).toBe(
      WebSocketConnectionState.CONNECTED,
    );

    // Receive PONG without sending PING (server-initiated)
    mockWs.simulateMessage(
      JSON.stringify({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      }),
    );

    // Should not throw, connection should remain stable
    expect(service.getConnectionState()).toBe(
      WebSocketConnectionState.CONNECTED,
    );

    // Latency should not be recorded for unsolicited PONG
    const stats = service.getStats();
    expect(stats.lastPingLatency).toBeUndefined();
  });

  it("should set error message on PONG timeout", () => {
    service.connect();
    mockWs.simulateOpen();

    // Wait for first ping
    vi.advanceTimersByTime(30000);

    // Let timeout occur
    vi.advanceTimersByTime(10000);

    const stats = service.getStats();
    expect(stats.lastError).toBe("PONG timeout - server unresponsive");
  });
});
