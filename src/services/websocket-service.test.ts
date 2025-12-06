import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthErrorCategory,
  WebSocketConnectionState,
  WebSocketEventType,
} from "../types/websocket";
import {
  calculateBackoff,
  categorizeAuthError,
  WebSocketService,
} from "./websocket-service";

// ============================================================================
// Mock WebSocket Implementation
// ============================================================================

type MockWebSocketEventType = "open" | "close" | "message" | "error";
type MockWebSocketEventHandler = (event: unknown) => void;

/**
 * MockWebSocket - Simulates WebSocket behavior for testing FSM transitions
 *
 * Features:
 * - Simulates connection states (CONNECTING, OPEN, CLOSING, CLOSED)
 * - Allows manual triggering of events (open, close, message, error)
 * - Tracks sent messages for verification
 * - Configurable connection delay
 */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  sentMessages: string[] = [];
  private eventHandlers: Map<
    MockWebSocketEventType,
    MockWebSocketEventHandler
  > = new Map();

  // Event handlers
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Store reference for test access
    MockWebSocket.instances.push(this);
  }

  // Static storage for test access
  static instances: MockWebSocket[] = [];
  static clearInstances(): void {
    MockWebSocket.instances = [];
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    // Simulate async close
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({
          code: code || 1000,
          reason: reason || "",
          wasClean: code === 1000,
        } as CloseEvent);
      }
    }, 0);
  }

  // Test helpers to simulate events
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateClose(
    code: number = 1000,
    reason: string = "",
    wasClean: boolean = true,
  ): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean } as CloseEvent);
    }
  }

  simulateMessage(data: object): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateError(message: string = "Connection error"): void {
    if (this.onerror) {
      this.onerror(new ErrorEvent("error", { message }));
    }
  }

  addEventListener(
    type: MockWebSocketEventType,
    handler: MockWebSocketEventHandler,
  ): void {
    this.eventHandlers.set(type, handler);
  }

  removeEventListener(type: MockWebSocketEventType): void {
    this.eventHandlers.delete(type);
  }
}

// Install mock globally
const originalWebSocket = global.WebSocket;

// ============================================================================
// calculateBackoff Tests (existing)
// ============================================================================

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

// ============================================================================
// categorizeAuthError Tests (existing)
// ============================================================================

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

// ============================================================================
// WebSocket State Machine Tests
// ============================================================================

describe("WebSocketService - State Machine", () => {
  let service: WebSocketService;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.clearInstances();
    // @ts-expect-error - Mocking global WebSocket
    global.WebSocket = MockWebSocket;

    // Use deterministic backoff for tests
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.WebSocket = originalWebSocket;
    if (service) {
      service.disconnect();
    }
  });

  // Helper to get the latest mock WebSocket instance
  function getLatestMockWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  // Helper to create service with test config
  function createService(
    overrides: Partial<{
      url: string;
      accessToken: string;
      reconnectDelay: number;
      maxReconnectAttempts: number;
      heartbeatInterval: number;
      authTimeout: number;
      debug: boolean;
    }> = {},
  ): WebSocketService {
    return new WebSocketService({
      url: "wss://test.example.com/ws",
      reconnectDelay: 1000,
      maxReconnectAttempts: 3,
      heartbeatInterval: 5000,
      authTimeout: 2000,
      debug: false,
      ...overrides,
    });
  }

  // ============================================================================
  // State Enter/Exit Tests (all 6 states)
  // ============================================================================

  describe("State Lifecycle - All 6 States", () => {
    describe("DISCONNECTED state", () => {
      it("should start in DISCONNECTED state", () => {
        service = createService();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });

      it("should enter DISCONNECTED state on disconnect()", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });

      it("should enter DISCONNECTED state on clean close", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1000, "Normal closure", true);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    describe("CONNECTING state", () => {
      it("should enter CONNECTING state when connect() is called", () => {
        service = createService();
        service.connect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });

      it("should exit CONNECTING state when connection opens", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Without token, goes directly to CONNECTED
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should exit CONNECTING state on connection error", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        mockWs = getLatestMockWs();
        mockWs.simulateError("Connection failed");
        mockWs.simulateClose(1006, "Connection failed", false);

        // Should transition to RECONNECTING (since it wasn't intentionally closed)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });
    });

    describe("CONNECTED state", () => {
      it("should enter CONNECTED state after successful connection (no auth)", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
        expect(service.isConnected()).toBe(true);
      });

      it("should enter CONNECTED state after successful auth", () => {
        service = createService({ accessToken: "test-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Should stay in CONNECTING until auth success
        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_SUCCESS,
          timestamp: new Date().toISOString(),
        });

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should exit CONNECTED state on disconnect", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    describe("DEGRADED state", () => {
      it("should enter DEGRADED state when p95 latency exceeds threshold", () => {
        // Use heartbeat interval longer than the latency we simulate to avoid overlapping
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Simulate high latency PONG responses (>5000ms threshold)
        // Use latency just under PONG timeout (10000ms) but above degraded threshold (5000ms)
        for (let i = 0; i < 20; i++) {
          // Trigger heartbeat
          vi.advanceTimersByTime(10000);
          // Simulate PONG response after 6000ms delay (above 5000ms threshold, below 10000ms timeout)
          vi.advanceTimersByTime(6000);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );
      });

      it("should exit DEGRADED state when metrics recover", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // First, push into degraded state with high latency
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(6000);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        // Now send many low-latency PONGs to recover
        // Need enough to shift the p95 below threshold (100 samples max)
        for (let i = 0; i < 100; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(50); // Low latency
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    describe("RECONNECTING state", () => {
      it("should enter RECONNECTING state after unclean close", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Simulate unclean close
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });

      it("should exit RECONNECTING state when reconnection succeeds", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Advance timer to trigger reconnect
        vi.advanceTimersByTime(1000);

        // New WebSocket should be created
        const newMockWs = getLatestMockWs();
        expect(newMockWs).not.toBe(mockWs);
        newMockWs.simulateOpen();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should exit RECONNECTING state to ERROR after max attempts", () => {
        service = createService({ maxReconnectAttempts: 2 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        // First reconnect attempt
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
        vi.advanceTimersByTime(1000);

        let currentMockWs = getLatestMockWs();
        currentMockWs.simulateClose(1006, "Connection lost", false);

        // Second reconnect attempt
        vi.advanceTimersByTime(2000);
        currentMockWs = getLatestMockWs();
        currentMockWs.simulateClose(1006, "Connection lost", false);

        // After max attempts, should be in ERROR state
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });
    });

    describe("ERROR state", () => {
      it("should enter ERROR state after max reconnect attempts", () => {
        service = createService({ maxReconnectAttempts: 1 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        vi.advanceTimersByTime(1000);
        const newMockWs = getLatestMockWs();
        newMockWs.simulateClose(1006, "Failed again", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });

      it("should enter ERROR state on fatal auth failure (token invalid)", () => {
        service = createService({ accessToken: "invalid-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Auth failure with token invalid pattern
        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Token expired",
          timestamp: new Date().toISOString(),
        });

        // Allow the close to process
        vi.advanceTimersByTime(0);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });

      it("should allow fresh connect() after ERROR state (when user re-authenticates)", () => {
        service = createService({ accessToken: "invalid-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Token expired",
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        // User re-authenticates and calls connect() again
        service.connect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });
    });
  });

  // ============================================================================
  // All 18 State Transitions
  // ============================================================================

  describe("State Transitions - All 18 documented transitions", () => {
    // Transition 1: DISCONNECTED -> CONNECTING (connect())
    describe("Transition 1: DISCONNECTED -> CONNECTING", () => {
      it("should transition from DISCONNECTED to CONNECTING on connect()", () => {
        service = createService();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        service.connect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });
    });

    // Transition 2: CONNECTING -> CONNECTED (onopen + no auth / auth success)
    describe("Transition 2: CONNECTING -> CONNECTED", () => {
      it("should transition to CONNECTED on onopen (no auth required)", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should transition to CONNECTED on auth success", () => {
        service = createService({ accessToken: "test-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_SUCCESS,
          timestamp: new Date().toISOString(),
        });

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    // Transition 3: CONNECTING -> DISCONNECTED (onclose wasClean)
    describe("Transition 3: CONNECTING -> DISCONNECTED", () => {
      it("should transition to DISCONNECTED on clean close during connecting", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        mockWs = getLatestMockWs();
        service.disconnect(); // This sets intentionally closed flag

        // Manually trigger the close since disconnect() calls ws.close()
        vi.advanceTimersByTime(0);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    // Transition 4: CONNECTING -> RECONNECTING (connection failure)
    describe("Transition 4: CONNECTING -> RECONNECTING", () => {
      it("should transition to RECONNECTING on connection failure", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        mockWs = getLatestMockWs();
        mockWs.simulateClose(1006, "Connection failed", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });
    });

    // Transition 5: CONNECTING -> ERROR (auth failure - token invalid)
    describe("Transition 5: CONNECTING -> ERROR", () => {
      it("should transition to ERROR on auth failure with invalid token", () => {
        service = createService({ accessToken: "invalid-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Token expired",
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });

      it("should transition to ERROR on auth timeout", () => {
        service = createService({
          accessToken: "test-token",
          authTimeout: 1000,
          maxReconnectAttempts: 0,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Don't send auth response, let it timeout
        vi.advanceTimersByTime(1001);
        vi.advanceTimersByTime(0); // Process close

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });
    });

    // Transition 6: CONNECTED -> DISCONNECTED (intentional disconnect)
    describe("Transition 6: CONNECTED -> DISCONNECTED", () => {
      it("should transition to DISCONNECTED on intentional disconnect", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    // Transition 7: CONNECTED -> RECONNECTING (unclean close)
    describe("Transition 7: CONNECTED -> RECONNECTING", () => {
      it("should transition to RECONNECTING on unclean close", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });

      it("should transition to RECONNECTING on PONG timeout", () => {
        service = createService({ heartbeatInterval: 100 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Trigger heartbeat
        vi.advanceTimersByTime(100);

        // Don't respond to PING, let PONG timeout (default 10000ms)
        vi.advanceTimersByTime(10001);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });
    });

    // Transition 8: CONNECTED -> DEGRADED (high latency)
    describe("Transition 8: CONNECTED -> DEGRADED", () => {
      it("should transition to DEGRADED when p95 latency exceeds 5000ms", () => {
        // Use heartbeat interval longer than latency to avoid overlap
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Generate enough high-latency samples
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000); // Heartbeat triggers PING
          vi.advanceTimersByTime(5500); // Simulate 5.5s latency (under 10s PONG timeout)
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );
      });
    });

    // Transition 9: CONNECTED -> ERROR (should not happen directly in normal flow)
    // This is covered by auth failure handling

    // Transition 10: DEGRADED -> CONNECTED (metrics recover)
    describe("Transition 10: DEGRADED -> CONNECTED", () => {
      it("should transition back to CONNECTED when metrics recover", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(5500);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        // Recover with low-latency samples (need enough to shift p95)
        for (let i = 0; i < 100; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(50);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    // Transition 11: DEGRADED -> RECONNECTING (connection lost)
    describe("Transition 11: DEGRADED -> RECONNECTING", () => {
      it("should transition to RECONNECTING when connection is lost while degraded", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(5500);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        // Simulate connection loss
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
      });
    });

    // Transition 12: DEGRADED -> DISCONNECTED (intentional disconnect)
    describe("Transition 12: DEGRADED -> DISCONNECTED", () => {
      it("should transition to DISCONNECTED on intentional disconnect while degraded", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(5500);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    // Transition 13: RECONNECTING -> CONNECTING (reconnect timer fires)
    describe("Transition 13: RECONNECTING -> CONNECTING", () => {
      it("should transition to CONNECTING when reconnect timer fires", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Advance timer to trigger reconnect (1000ms with 0.5 random = 1000ms)
        vi.advanceTimersByTime(1000);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });
    });

    // Transition 14: RECONNECTING -> CONNECTED (successful reconnection)
    describe("Transition 14: RECONNECTING -> CONNECTED", () => {
      it("should transition to CONNECTED after successful reconnection", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        vi.advanceTimersByTime(1000);
        const newMockWs = getLatestMockWs();
        newMockWs.simulateOpen();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    // Transition 15: RECONNECTING -> ERROR (max attempts exceeded)
    describe("Transition 15: RECONNECTING -> ERROR", () => {
      it("should transition to ERROR when max reconnect attempts exceeded", () => {
        service = createService({
          maxReconnectAttempts: 2,
          reconnectDelay: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        // Attempt 1
        vi.advanceTimersByTime(100);
        let currentWs = getLatestMockWs();
        currentWs.simulateClose(1006, "Failed", false);

        // Attempt 2
        vi.advanceTimersByTime(200);
        currentWs = getLatestMockWs();
        currentWs.simulateClose(1006, "Failed", false);

        // Should be in ERROR after exhausting attempts
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });
    });

    // Transition 16: RECONNECTING -> DISCONNECTED (intentional disconnect during reconnect)
    describe("Transition 16: RECONNECTING -> DISCONNECTED", () => {
      it("should transition to DISCONNECTED when disconnect is called during reconnection", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    // Transition 17: ERROR -> CONNECTING (fresh connect after error)
    describe("Transition 17: ERROR -> CONNECTING", () => {
      it("should allow fresh connect() from ERROR state", () => {
        service = createService({ maxReconnectAttempts: 0 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        // Call connect() again
        service.connect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });
    });

    // Transition 18: ERROR -> DISCONNECTED (disconnect from error state)
    describe("Transition 18: ERROR -> DISCONNECTED", () => {
      it("should transition to DISCONNECTED when disconnect is called from ERROR state", () => {
        service = createService({ maxReconnectAttempts: 0 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Connection lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        service.disconnect();

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });
  });

  // ============================================================================
  // Guard Conditions Tests
  // ============================================================================

  describe("Guard Conditions", () => {
    describe("Duplicate connection prevention", () => {
      it("should not create new connection if already OPEN", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        const wsCountBefore = MockWebSocket.instances.length;
        service.connect(); // Try to connect again

        expect(MockWebSocket.instances.length).toBe(wsCountBefore);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should not create new connection if already CONNECTING", () => {
        service = createService();
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        const wsCountBefore = MockWebSocket.instances.length;
        service.connect(); // Try to connect again

        expect(MockWebSocket.instances.length).toBe(wsCountBefore);
      });
    });

    describe("Intentional close flag", () => {
      it("should not schedule reconnect when intentionally closed", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        service.disconnect();

        // Verify state is DISCONNECTED, not RECONNECTING
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        // Advance time significantly - should not attempt reconnect
        vi.advanceTimersByTime(60000);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });
    });

    describe("Fatal auth error flag", () => {
      it("should not schedule reconnect after fatal auth error", () => {
        service = createService({ accessToken: "bad-token" });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Token expired",
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        // Advance time significantly - should not attempt reconnect
        vi.advanceTimersByTime(60000);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });
    });

    describe("Max reconnect attempts guard", () => {
      it("should stop reconnecting after max attempts", () => {
        service = createService({
          maxReconnectAttempts: 2,
          reconnectDelay: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Lost", false);

        // Attempt 1
        vi.advanceTimersByTime(100);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 2
        vi.advanceTimersByTime(200);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        const wsCountBefore = MockWebSocket.instances.length;

        // Should not create more WebSocket instances
        vi.advanceTimersByTime(10000);
        expect(MockWebSocket.instances.length).toBe(wsCountBefore);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
      });
    });
  });

  // ============================================================================
  // Idempotent Operations Tests
  // ============================================================================

  describe("Idempotent Operations", () => {
    it("connect() should be idempotent when already connected", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      const state1 = service.getStats();
      service.connect();
      const state2 = service.getStats();

      expect(state1.connectionState).toBe(state2.connectionState);
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it("disconnect() should be idempotent", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      service.disconnect();
      const state1 = service.getConnectionState();
      service.disconnect();
      const state2 = service.getConnectionState();

      expect(state1).toBe(WebSocketConnectionState.DISCONNECTED);
      expect(state2).toBe(WebSocketConnectionState.DISCONNECTED);
    });
  });

  // ============================================================================
  // Degradation Threshold Tests
  // ============================================================================

  describe("Degradation Thresholds", () => {
    describe("P95 Latency Threshold (5000ms)", () => {
      it("should not degrade when p95 latency is exactly at threshold", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Send PONGs with exactly 5000ms latency
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(5000); // Exactly at threshold
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        // Should still be CONNECTED (threshold is >5000, not >=5000)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should degrade when p95 latency exceeds threshold", () => {
        service = createService({ heartbeatInterval: 10000 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Send PONGs with 5001ms latency
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(10000);
          vi.advanceTimersByTime(5001); // Just over threshold
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );
      });
    });

    describe("Packet Loss Threshold (10%)", () => {
      it("should degrade when packet loss exceeds 10%", () => {
        service = createService({ heartbeatInterval: 100 });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Simulate 11% packet loss: 11 timeouts out of 100 exchanges
        // First, send some successful exchanges with low latency
        for (let i = 0; i < 89; i++) {
          vi.advanceTimersByTime(100);
          vi.advanceTimersByTime(50);
          mockWs.simulateMessage({
            type: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
          });
        }

        // Now trigger PONG timeouts
        for (let i = 0; i < 11; i++) {
          vi.advanceTimersByTime(100); // Heartbeat
          vi.advanceTimersByTime(10001); // PONG timeout
          // The service will reconnect after timeout, need to restore connection
          const newWs = getLatestMockWs();
          newWs.simulateOpen();
        }

        const metrics = service.getStats().metrics;
        expect(metrics?.isDegraded).toBe(true);
      });
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe("Event Emission", () => {
    it("should emit CONNECT event when connected", () => {
      service = createService();
      const connectHandler = vi.fn();
      service.on(WebSocketEventType.CONNECT, connectHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      expect(connectHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit DISCONNECT event when disconnected", () => {
      service = createService();
      const disconnectHandler = vi.fn();
      service.on(WebSocketEventType.DISCONNECT, disconnectHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      service.disconnect();
      vi.advanceTimersByTime(0);

      expect(disconnectHandler).toHaveBeenCalled();
    });

    it("should emit RECONNECT event before each reconnection attempt", () => {
      service = createService({ reconnectDelay: 100 });
      const reconnectHandler = vi.fn();
      service.on(WebSocketEventType.RECONNECT, reconnectHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      mockWs.simulateClose(1006, "Lost", false);

      vi.advanceTimersByTime(100);

      expect(reconnectHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit AUTH_SUCCESS event on successful auth", () => {
      service = createService({ accessToken: "valid-token" });
      const authSuccessHandler = vi.fn();
      service.on(WebSocketEventType.AUTH_SUCCESS, authSuccessHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_SUCCESS,
        timestamp: new Date().toISOString(),
      });

      expect(authSuccessHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit AUTH_FAILURE event on auth failure", () => {
      service = createService({ accessToken: "bad-token" });
      const authFailureHandler = vi.fn();
      service.on(WebSocketEventType.AUTH_FAILURE, authFailureHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_FAILURE,
        error: "Invalid token",
        timestamp: new Date().toISOString(),
      });

      expect(authFailureHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit AUTH_EXPIRED event on fatal auth failure", () => {
      service = createService({ accessToken: "expired-token" });
      const authExpiredHandler = vi.fn();
      service.on(WebSocketEventType.AUTH_EXPIRED, authExpiredHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_FAILURE,
        error: "Token expired",
        timestamp: new Date().toISOString(),
      });

      expect(authExpiredHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit ERROR event on errors", () => {
      service = createService();
      const errorHandler = vi.fn();
      service.on(WebSocketEventType.ERROR, errorHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateError("Test error");

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Heartbeat & PONG Timeout Tests
  // ============================================================================

  describe("Heartbeat and PONG Timeout", () => {
    it("should start heartbeat after connection established", () => {
      service = createService({ heartbeatInterval: 1000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      expect(mockWs.sentMessages.length).toBe(0);

      vi.advanceTimersByTime(1000);

      // Should have sent a PING
      expect(mockWs.sentMessages.length).toBe(1);
      const pingMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(pingMessage.type).toBe(WebSocketEventType.PING);
    });

    it("should handle PONG response and calculate latency", () => {
      service = createService({ heartbeatInterval: 1000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Trigger heartbeat
      vi.advanceTimersByTime(1000);

      // Simulate some latency
      vi.advanceTimersByTime(100);
      mockWs.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });

      const stats = service.getStats();
      expect(stats.lastPingLatency).toBeGreaterThanOrEqual(100);
    });

    it("should trigger reconnect on PONG timeout", () => {
      service = createService({ heartbeatInterval: 1000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.CONNECTED,
      );

      // Trigger heartbeat
      vi.advanceTimersByTime(1000);

      // Wait for PONG timeout (10000ms)
      vi.advanceTimersByTime(10001);

      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.RECONNECTING,
      );
    });

    it("should clear PONG timeout when PONG is received", () => {
      service = createService({ heartbeatInterval: 1000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Trigger heartbeat
      vi.advanceTimersByTime(1000);

      // Respond before timeout
      vi.advanceTimersByTime(5000);
      mockWs.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });

      // Advance past the original timeout
      vi.advanceTimersByTime(6000);

      // Should still be connected
      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.CONNECTED,
      );
    });
  });

  // ============================================================================
  // Metrics Tracking Tests
  // ============================================================================

  describe("Metrics Tracking", () => {
    it("should track reconnection count", () => {
      service = createService({ reconnectDelay: 100 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();
      mockWs.simulateClose(1006, "Lost", false);

      expect(service.getStats().metrics?.reconnectionCount).toBe(1);

      vi.advanceTimersByTime(100);
      getLatestMockWs().simulateOpen();
      getLatestMockWs().simulateClose(1006, "Lost", false);

      expect(service.getStats().metrics?.reconnectionCount).toBe(2);
    });

    it("should track PONG timeout count for packet loss calculation", () => {
      service = createService({ heartbeatInterval: 100 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Trigger a PONG timeout
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(10001);

      const metrics = service.getStats().metrics;
      expect(metrics?.pongTimeouts).toBe(1);
      expect(metrics?.totalPingPongExchanges).toBe(1);
    });

    it("should calculate uptime percentage", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Let some time pass while connected
      vi.advanceTimersByTime(10000);

      const metrics = service.getStats().metrics;
      expect(metrics?.uptimePercent).toBeGreaterThan(0);
    });

    it("should track messages sent and received", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      service.send({
        type: WebSocketEventType.PING,
        timestamp: new Date().toISOString(),
      });
      mockWs.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });

      const stats = service.getStats();
      expect(stats.messagesSent).toBeGreaterThanOrEqual(1);
      expect(stats.messagesReceived).toBeGreaterThanOrEqual(1);
    });

    it("should reset metrics on long disconnection", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Disconnect and wait for long disconnection threshold (5 minutes)
      service.disconnect();
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Reconnect - metrics should be reset
      service.connect();
      const newMockWs = getLatestMockWs();
      newMockWs.simulateOpen();

      // The resetMetrics should have been called, so reconnectionCount should be 0
      // (since we didn't actually go through the reconnection flow, it's a fresh connect)
      expect(service.getStats().metrics?.reconnectionCount).toBe(0);
    });
  });

  // ============================================================================
  // Auth Flow Tests
  // ============================================================================

  describe("Authentication Flow", () => {
    it("should send auth message when token is provided", () => {
      service = createService({ accessToken: "test-token" });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Auth message should be sent
      expect(mockWs.sentMessages.length).toBe(1);
      const authMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(authMessage.type).toBe(WebSocketEventType.AUTH);
      expect(authMessage.token).toBe("test-token");
    });

    it("should start auth timeout after sending auth message", () => {
      service = createService({
        accessToken: "test-token",
        authTimeout: 1000,
        maxReconnectAttempts: 0,
      });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Wait for auth timeout
      vi.advanceTimersByTime(1001);
      vi.advanceTimersByTime(0); // Process close

      expect(service.getConnectionState()).toBe(WebSocketConnectionState.ERROR);
    });

    it("should clear auth timeout on auth success", () => {
      service = createService({ accessToken: "test-token", authTimeout: 1000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_SUCCESS,
        timestamp: new Date().toISOString(),
      });

      // Wait past the original timeout
      vi.advanceTimersByTime(2000);

      // Should still be connected
      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.CONNECTED,
      );
    });

    it("should retry on server error during auth", () => {
      service = createService({
        accessToken: "test-token",
        reconnectDelay: 100,
      });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_FAILURE,
        error: "Internal server error",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
      vi.advanceTimersByTime(0);

      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.RECONNECTING,
      );
    });

    it("should retry with unlimited attempts on network error during auth", () => {
      service = createService({
        accessToken: "test-token",
        reconnectDelay: 100,
        maxReconnectAttempts: 1,
      });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      mockWs.simulateMessage({
        type: WebSocketEventType.AUTH_FAILURE,
        error: "Connection timeout",
        timestamp: new Date().toISOString(),
      });
      vi.advanceTimersByTime(0);

      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.RECONNECTING,
      );

      // Should continue retrying even past maxReconnectAttempts for network errors
      vi.advanceTimersByTime(100);
      let currentWs = getLatestMockWs();
      currentWs.simulateOpen();
      currentWs.simulateMessage({
        type: WebSocketEventType.AUTH_FAILURE,
        error: "Connection timeout",
        timestamp: new Date().toISOString(),
      });
      vi.advanceTimersByTime(0);

      // Should still be trying (not in ERROR state)
      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.RECONNECTING,
      );
    });
  });

  // ============================================================================
  // Message Handling Tests
  // ============================================================================

  describe("Message Handling", () => {
    it("should respond to server PING with PONG", () => {
      service = createService();
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      const messagesBefore = mockWs.sentMessages.length;
      mockWs.simulateMessage({
        type: WebSocketEventType.PING,
        timestamp: new Date().toISOString(),
      });

      expect(mockWs.sentMessages.length).toBe(messagesBefore + 1);
      const pongMessage = JSON.parse(
        mockWs.sentMessages[mockWs.sentMessages.length - 1],
      );
      expect(pongMessage.type).toBe(WebSocketEventType.PONG);
    });

    it("should emit custom events to registered handlers", () => {
      service = createService();
      const handler = vi.fn();
      service.on(WebSocketEventType.NEW_NOTIFICATION, handler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      mockWs.simulateMessage({
        type: WebSocketEventType.NEW_NOTIFICATION,
        notification: { uri: "test" },
        timestamp: new Date().toISOString(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid JSON gracefully", () => {
      service = createService();
      const errorHandler = vi.fn();
      service.on(WebSocketEventType.ERROR, errorHandler);

      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Send invalid JSON
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: "not valid json" } as MessageEvent);
      }

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Connection Cleanup Tests
  // ============================================================================

  describe("Connection Cleanup", () => {
    it("should clear all timers on disconnect", () => {
      service = createService({ heartbeatInterval: 100 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Start heartbeat
      vi.advanceTimersByTime(100);

      service.disconnect();

      // Advance time significantly - no timers should fire
      vi.advanceTimersByTime(60000);

      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.DISCONNECTED,
      );
    });

    it("should handle rapid connect/disconnect cycles", () => {
      service = createService();

      for (let i = 0; i < 10; i++) {
        service.connect();
        service.disconnect();
      }

      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.DISCONNECTED,
      );
    });
  });
});
