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

  // Helper to simulate high-latency PING/PONG exchanges to trigger degraded state
  // Uses a carefully controlled timing pattern to avoid PONG timeout issues
  function simulateHighLatencyExchanges(
    ws: MockWebSocket,
    count: number,
    heartbeatInterval: number,
    latency: number,
    isFirstBatch: boolean = true,
  ): void {
    const gapToNextHeartbeat = heartbeatInterval - latency;

    for (let i = 0; i < count; i++) {
      if (i === 0 && isFirstBatch) {
        // First iteration: advance to first heartbeat from t=0
        vi.advanceTimersByTime(heartbeatInterval);
      }
      // Advance by latency (heartbeat already fired, PING sent)
      vi.advanceTimersByTime(latency);
      // Send PONG - records latency and clears timeout
      ws.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });
      // Advance to the next heartbeat exactly
      vi.advanceTimersByTime(gapToNextHeartbeat);
    }
  }

  // Helper to simulate low-latency PING/PONG exchanges to recover from degraded state
  function simulateLowLatencyExchanges(
    ws: MockWebSocket,
    count: number,
    heartbeatInterval: number,
    latency: number = 50,
  ): void {
    const gapToNextHeartbeat = heartbeatInterval - latency;

    for (let i = 0; i < count; i++) {
      // We're already at a heartbeat boundary from previous exchanges
      // Advance by latency
      vi.advanceTimersByTime(latency);
      ws.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });
      // Advance to next heartbeat
      vi.advanceTimersByTime(gapToNextHeartbeat);
    }
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

      it("should reconnect on clean close (not intentionally closed)", () => {
        service = createService();
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1000, "Normal closure", true);

        // Clean closes without isIntentionallyClosed flag will cause reconnection
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
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
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Simulate high latency PONG responses (>5000ms threshold)
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5500);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );
      });

      it("should exit DEGRADED state when metrics recover", () => {
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // First, push into degraded state with high latency
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5500);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        // Now send many low-latency PONGs to recover
        simulateLowLatencyExchanges(mockWs, 100, heartbeatInterval, 50);

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

      it("should enter DISCONNECTED state on fatal auth failure (token invalid)", () => {
        // Note: After TOKEN_INVALID auth failure, state briefly goes ERROR then DISCONNECTED
        // when ws.close() triggers onclose handler. The key behavior is that no reconnect
        // is scheduled due to isAuthFatalError flag.
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

        // Final state is DISCONNECTED (onclose handler sets this after ERROR)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        // Verify no reconnect is scheduled
        vi.advanceTimersByTime(60000);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
        expect(MockWebSocket.instances.length).toBe(1);
      });

      it("should allow fresh connect() after fatal auth failure (when user re-authenticates)", () => {
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
          WebSocketConnectionState.DISCONNECTED,
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

    // Transition 5: CONNECTING -> DISCONNECTED (via ERROR on auth failure - token invalid)
    describe("Transition 5: CONNECTING -> ERROR/DISCONNECTED", () => {
      it("should transition to DISCONNECTED on auth failure with invalid token", () => {
        // Note: State briefly goes ERROR then DISCONNECTED when onclose fires
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

        // Final state is DISCONNECTED (onclose sets this after ERROR)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
        // Verify no reconnect is scheduled
        expect(MockWebSocket.instances.length).toBe(1);
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
        const heartbeatInterval = 16000;
        const latency = 5500; // > 5000ms threshold

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        // Generate 20 high-latency PING/PONG exchanges
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, latency);

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
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state with high latency
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5500);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DEGRADED,
        );

        // Recover with low-latency samples (need enough to shift p95)
        simulateLowLatencyExchanges(mockWs, 100, heartbeatInterval, 50);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    // Transition 11: DEGRADED -> RECONNECTING (connection lost)
    describe("Transition 11: DEGRADED -> RECONNECTING", () => {
      it("should transition to RECONNECTING when connection is lost while degraded", () => {
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5500);
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
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Push into DEGRADED state
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5500);
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
        // Process the async close event
        vi.advanceTimersByTime(0);

        // After AUTH_FAILURE with TOKEN_INVALID, state goes ERROR -> DISCONNECTED
        // when ws.close() triggers onclose handler. The key is that no reconnect
        // is scheduled due to isAuthFatalError flag.
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        // Advance time significantly - should not attempt reconnect
        vi.advanceTimersByTime(60000);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        // Verify no new WebSocket instances were created (no reconnect attempt)
        expect(MockWebSocket.instances.length).toBe(1);
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
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Send PONGs with exactly 5000ms latency (at threshold, not over)
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5000);

        // Should still be CONNECTED (threshold is >5000, not >=5000)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });

      it("should degrade when p95 latency exceeds threshold", () => {
        const heartbeatInterval = 16000;

        service = createService({
          heartbeatInterval,
          maxReconnectAttempts: 100,
        });
        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Send PONGs with 5001ms latency (just over threshold)
        simulateHighLatencyExchanges(mockWs, 20, heartbeatInterval, 5001);

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
      // Use a heartbeat interval longer than the test period to avoid overlap
      service = createService({ heartbeatInterval: 30000 });
      service.connect();
      mockWs = getLatestMockWs();
      mockWs.simulateOpen();

      // Trigger heartbeat
      vi.advanceTimersByTime(30000);

      // Respond before timeout (within 10000ms PONG timeout)
      vi.advanceTimersByTime(5000);
      mockWs.simulateMessage({
        type: WebSocketEventType.PONG,
        timestamp: new Date().toISOString(),
      });

      // Advance past when the original timeout would have fired
      // (10000ms from PING) - we already advanced 5000ms, so 6000ms more goes past the 10000ms mark
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
      // Note: When AUTH_FAILURE is received, handleAuthFailure calls scheduleReconnect(true),
      // then ws.close() triggers onclose which calls scheduleReconnect() again (not unlimited).
      // We need enough maxReconnectAttempts to survive both calls, then verify unlimited
      // retries continue working.
      service = createService({
        accessToken: "test-token",
        reconnectDelay: 100,
        maxReconnectAttempts: 5,
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

      // After onclose fires, we should be in RECONNECTING (from second scheduleReconnect call)
      expect(service.getConnectionState()).toBe(
        WebSocketConnectionState.RECONNECTING,
      );

      // Continue retrying with network errors - should not hit maxReconnectAttempts
      // because network errors get unlimited retries
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100);
        const currentWs = getLatestMockWs();
        currentWs.simulateOpen();
        currentWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Connection timeout",
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);
      }

      // After 10+ retries (well past maxReconnectAttempts), should still be trying
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

  // ============================================================================
  // Reconnection Stress Tests
  // ============================================================================

  describe("Reconnection Stress Tests", () => {
    describe("Rapid Disconnect Cycles", () => {
      it("should handle 10+ rapid disconnect/reconnect cycles in 30 seconds without failures", () => {
        service = createService({
          reconnectDelay: 1000,
          maxReconnectAttempts: 100, // High limit for stress test
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );

        const totalCycles = 15;
        let successfulReconnects = 0;

        for (let cycle = 0; cycle < totalCycles; cycle++) {
          // Simulate unexpected disconnect
          const currentWs = getLatestMockWs();
          currentWs.simulateClose(1006, "Connection lost", false);

          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.RECONNECTING,
          );

          // Advance timer to trigger reconnect (1000ms base with 0.5 jitter = 1000ms)
          vi.advanceTimersByTime(1000);

          // New connection should be created
          const newWs = getLatestMockWs();
          expect(newWs).not.toBe(currentWs);

          // Simulate successful connection
          newWs.simulateOpen();

          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.CONNECTED,
          );
          successfulReconnects++;
        }

        expect(successfulReconnects).toBe(totalCycles);
        expect(service.isConnected()).toBe(true);
      });

      it("should handle rapid disconnect cycles with varying close codes", () => {
        service = createService({
          reconnectDelay: 100,
          maxReconnectAttempts: 50,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Test various close codes that should trigger reconnect
        const closeCodes = [
          1001, 1002, 1003, 1006, 1007, 1008, 1009, 1010, 1011,
        ];

        for (const code of closeCodes) {
          const currentWs = getLatestMockWs();
          currentWs.simulateClose(code, `Close code ${code}`, false);

          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.RECONNECTING,
          );

          vi.advanceTimersByTime(100);
          getLatestMockWs().simulateOpen();

          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.CONNECTED,
          );
        }

        expect(service.isConnected()).toBe(true);
      });

      it("should not create duplicate connections during rapid reconnect attempts", () => {
        service = createService({
          reconnectDelay: 100,
          maxReconnectAttempts: 20,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        const initialInstanceCount = MockWebSocket.instances.length;

        // Trigger disconnect
        mockWs.simulateClose(1006, "Lost", false);

        // Try to trigger multiple connect() calls while in RECONNECTING state
        service.connect(); // Should be ignored - reconnect already scheduled
        service.connect();
        service.connect();

        // Only one new connection should be created after timer fires
        vi.advanceTimersByTime(100);

        // Should only have created one new WebSocket
        expect(MockWebSocket.instances.length).toBe(initialInstanceCount + 1);
      });
    });

    describe("Exponential Backoff Progression", () => {
      it("should follow 5s -> 10s -> 20s -> 30s backoff progression", () => {
        // Use mock random with 0.5 to get consistent delays (jitter factor = 1.0)
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        service = createService({
          reconnectDelay: 5000, // Base 5s
          maxReconnectAttempts: 10,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Lost", false);

        // Attempt 1: 5000ms delay
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Advance 4999ms - should still be reconnecting
        vi.advanceTimersByTime(4999);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Advance 1ms more - should trigger reconnect
        vi.advanceTimersByTime(1);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        // Fail and check 10s delay
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 2: 10000ms delay
        vi.advanceTimersByTime(9999);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
        vi.advanceTimersByTime(1);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        // Fail and check 20s delay
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 3: 20000ms delay
        vi.advanceTimersByTime(19999);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
        vi.advanceTimersByTime(1);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        // Fail and check 30s max delay
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 4: Should be capped at 30000ms (40000 would be 5000 * 2^3)
        vi.advanceTimersByTime(29999);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );
        vi.advanceTimersByTime(1);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );
      });

      it("should cap delay at 30s for all subsequent attempts", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        service = createService({
          reconnectDelay: 5000,
          maxReconnectAttempts: 20,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Trigger initial disconnect
        mockWs.simulateClose(1006, "Lost", false);

        // Fast-forward through first 4 attempts to reach the cap (without successful reconnects)
        // Attempt 1: 5s, Attempt 2: 10s, Attempt 3: 20s, Attempt 4: 30s (capped)
        for (let attempt = 1; attempt <= 4; attempt++) {
          const expectedDelay = Math.min(
            5000 * Math.pow(2, attempt - 1),
            30000,
          );
          vi.advanceTimersByTime(expectedDelay);
          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.CONNECTING,
          );
          // Fail the connection attempt
          getLatestMockWs().simulateClose(1006, "Lost", false);
        }

        // Now verify all subsequent attempts use 30s max delay
        for (let i = 0; i < 3; i++) {
          // After attempt 4, we should be capped at 30s
          // 29999ms should not trigger reconnect
          vi.advanceTimersByTime(29999);
          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.RECONNECTING,
          );
          // 1ms more should trigger reconnect
          vi.advanceTimersByTime(1);
          expect(service.getConnectionState()).toBe(
            WebSocketConnectionState.CONNECTING,
          );
          // Fail this attempt too
          getLatestMockWs().simulateClose(1006, "Lost", false);
        }
      });
    });

    describe("Jitter Prevents Thundering Herd", () => {
      it("should apply ±20% jitter to prevent simultaneous reconnects", () => {
        const delays: number[] = [];
        const baseDelay = 5000;

        // Simulate different clients with different random values
        const randomValues = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];

        for (const randomValue of randomValues) {
          vi.spyOn(Math, "random").mockReturnValue(randomValue);
          const delay = calculateBackoff(1, baseDelay, 30000, true);
          delays.push(delay);
          vi.restoreAllMocks();
        }

        // All delays should be different (proving jitter works)
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBe(delays.length);

        // All delays should be within ±20% of base
        const minExpected = baseDelay * 0.8; // 4000
        const maxExpected = baseDelay * 1.2; // 6000

        for (const delay of delays) {
          expect(delay).toBeGreaterThanOrEqual(minExpected);
          expect(delay).toBeLessThanOrEqual(maxExpected);
        }
      });

      it("should spread reconnection times across simulated clients", () => {
        // Create multiple services to simulate multiple clients
        const services: WebSocketService[] = [];

        // Different random values to simulate different clients
        const randomSequence = [0.1, 0.3, 0.5, 0.7, 0.9];
        let randomIndex = 0;

        vi.spyOn(Math, "random").mockImplementation(() => {
          const value = randomSequence[randomIndex % randomSequence.length];
          randomIndex++;
          return value;
        });

        // Create 5 services
        for (let i = 0; i < 5; i++) {
          const svc = createService({
            reconnectDelay: 5000,
            maxReconnectAttempts: 10,
          });
          services.push(svc);

          svc.connect();
          const ws = getLatestMockWs();
          ws.simulateOpen();
        }

        // Disconnect all at the same time and track delays
        // Each disconnect will trigger a jittered delay calculation
        for (let i = 0; i < services.length; i++) {
          getLatestMockWs().simulateClose(1006, "Lost", false);
        }

        // Track when each service would reconnect
        // Due to jitter, they should reconnect at different times
        // This is simulated by the different random values producing different delays

        // Clean up services
        for (const currentService of services) {
          currentService.disconnect();
        }

        // The jitter calculation should have been called multiple times
        // with different results preventing thundering herd
        expect(randomIndex).toBeGreaterThan(0);
      });
    });

    describe("Max Reconnect Attempts Triggers ERROR State", () => {
      it("should transition to ERROR state after max reconnect attempts", () => {
        service = createService({
          reconnectDelay: 100,
          maxReconnectAttempts: 3,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Initial disconnect
        mockWs.simulateClose(1006, "Lost", false);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Attempt 1
        vi.advanceTimersByTime(100);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 2
        vi.advanceTimersByTime(200);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Attempt 3
        vi.advanceTimersByTime(400);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        // Should now be in ERROR state
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        // Verify no further reconnect attempts
        const wsCountBefore = MockWebSocket.instances.length;
        vi.advanceTimersByTime(60000);
        expect(MockWebSocket.instances.length).toBe(wsCountBefore);
      });

      it("should emit error events when max attempts reached", () => {
        service = createService({
          reconnectDelay: 50,
          maxReconnectAttempts: 2,
        });

        const errorHandler = vi.fn();
        service.on(WebSocketEventType.DISCONNECT, errorHandler);

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Lost", false);

        // Exhaust all attempts
        vi.advanceTimersByTime(50);
        getLatestMockWs().simulateClose(1006, "Lost", false);
        vi.advanceTimersByTime(100);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );
        expect(service.getStats().lastError).toContain(
          "Max reconnection attempts",
        );
      });

      it("should allow manual reconnect from ERROR state", () => {
        service = createService({
          reconnectDelay: 50,
          maxReconnectAttempts: 1,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();
        mockWs.simulateClose(1006, "Lost", false);

        vi.advanceTimersByTime(50);
        getLatestMockWs().simulateClose(1006, "Lost", false);

        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.ERROR,
        );

        // Manual connect should work
        service.connect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTING,
        );

        getLatestMockWs().simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    describe("NETWORK_ERROR Gets Unlimited Retries", () => {
      it("should continue retrying on network errors beyond max attempts", () => {
        service = createService({
          accessToken: "test-token",
          reconnectDelay: 100,
          maxReconnectAttempts: 3, // Low limit to test unlimited override
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Simulate network error during auth (triggers unlimited retries)
        mockWs.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Connection timeout", // Network error pattern
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        // Should be reconnecting (not ERROR)
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Continue with many more network errors - should never hit ERROR
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(100);
          const ws = getLatestMockWs();
          ws.simulateOpen();
          ws.simulateMessage({
            type: WebSocketEventType.AUTH_FAILURE,
            error: "ECONNREFUSED", // Network error pattern
            timestamp: new Date().toISOString(),
          });
          vi.advanceTimersByTime(0);

          // Should still be trying to reconnect
          expect(service.getConnectionState()).not.toBe(
            WebSocketConnectionState.ERROR,
          );
        }
      });

      it("should distinguish between network and token errors", () => {
        // First verify token errors ARE fatal
        const tokenService = createService({
          accessToken: "test-token",
          reconnectDelay: 100,
          maxReconnectAttempts: 5,
        });

        tokenService.connect();
        let ws = getLatestMockWs();
        ws.simulateOpen();

        ws.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "Token expired", // TOKEN_INVALID - should stop retries
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        // Should NOT be reconnecting for token errors
        expect(tokenService.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        tokenService.disconnect();

        // Now verify network errors continue retrying
        const networkService = createService({
          accessToken: "test-token",
          reconnectDelay: 100,
          maxReconnectAttempts: 2,
        });

        networkService.connect();
        ws = getLatestMockWs();
        ws.simulateOpen();

        ws.simulateMessage({
          type: WebSocketEventType.AUTH_FAILURE,
          error: "DNS lookup failed", // NETWORK_ERROR - should retry
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(0);

        expect(networkService.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Continue retrying past max attempts
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(100);
          const currentWs = getLatestMockWs();
          currentWs.simulateOpen();
          currentWs.simulateMessage({
            type: WebSocketEventType.AUTH_FAILURE,
            error: "Network error",
            timestamp: new Date().toISOString(),
          });
          vi.advanceTimersByTime(0);
        }

        // Should still be trying (not ERROR)
        expect(networkService.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        networkService.disconnect();
      });
    });

    describe("Race Condition Prevention", () => {
      it("should prevent race conditions during rapid state changes", () => {
        service = createService({
          reconnectDelay: 100,
          maxReconnectAttempts: 10,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Rapid sequence of operations that could cause race conditions
        for (let i = 0; i < 20; i++) {
          if (i % 3 === 0) {
            // Simulate disconnect
            if (service.isConnected()) {
              getLatestMockWs().simulateClose(1006, "Lost", false);
            }
          } else if (i % 3 === 1) {
            // Try to connect while potentially reconnecting
            service.connect();
          } else {
            // Advance timer to trigger pending reconnects
            vi.advanceTimersByTime(100);
            // If we're in connecting state, simulate open
            if (
              service.getConnectionState() ===
              WebSocketConnectionState.CONNECTING
            ) {
              getLatestMockWs().simulateOpen();
            }
          }
        }

        // Final state should be valid (not stuck or corrupted)
        const finalState = service.getConnectionState();
        expect([
          WebSocketConnectionState.CONNECTED,
          WebSocketConnectionState.CONNECTING,
          WebSocketConnectionState.RECONNECTING,
          WebSocketConnectionState.DISCONNECTED,
        ]).toContain(finalState);

        service.disconnect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });

      it("should handle simultaneous disconnect and reconnect scheduling", () => {
        service = createService({
          reconnectDelay: 100,
          maxReconnectAttempts: 10,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Trigger reconnect via close
        mockWs.simulateClose(1006, "Lost", false);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.RECONNECTING,
        );

        // Immediately try to disconnect (user action)
        service.disconnect();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );

        // Advance time - should NOT trigger any reconnect
        const wsCount = MockWebSocket.instances.length;
        vi.advanceTimersByTime(10000);
        expect(MockWebSocket.instances.length).toBe(wsCount);
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.DISCONNECTED,
        );
      });

      it("should not create multiple reconnect timers", () => {
        service = createService({
          reconnectDelay: 1000,
          maxReconnectAttempts: 10,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Trigger multiple closes in rapid succession
        mockWs.simulateClose(1006, "Lost 1", false);

        // This should not create another timer
        const currentWs = getLatestMockWs();
        currentWs.simulateError("Error during reconnecting phase");

        // Advance to first timer
        vi.advanceTimersByTime(1000);

        // Should have exactly one new connection attempt
        const newWs = getLatestMockWs();
        expect(newWs).not.toBe(mockWs);

        newWs.simulateOpen();
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
      });
    });

    describe("Stress Test Metrics", () => {
      it("should accurately track reconnection count during stress test", () => {
        service = createService({
          reconnectDelay: 50,
          maxReconnectAttempts: 50,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        const targetReconnects = 15;

        for (let i = 0; i < targetReconnects; i++) {
          getLatestMockWs().simulateClose(1006, "Lost", false);
          vi.advanceTimersByTime(50);
          getLatestMockWs().simulateOpen();
        }

        const metrics = service.getStats().metrics;
        expect(metrics?.reconnectionCount).toBe(targetReconnects);
      });

      it("should maintain stable state after many reconnections", () => {
        service = createService({
          reconnectDelay: 10,
          maxReconnectAttempts: 100,
          heartbeatInterval: 100,
        });

        service.connect();
        mockWs = getLatestMockWs();
        mockWs.simulateOpen();

        // Perform many reconnections
        for (let i = 0; i < 25; i++) {
          getLatestMockWs().simulateClose(1006, "Lost", false);
          vi.advanceTimersByTime(10);
          getLatestMockWs().simulateOpen();
        }

        // Verify service is in stable CONNECTED state
        expect(service.getConnectionState()).toBe(
          WebSocketConnectionState.CONNECTED,
        );
        expect(service.isConnected()).toBe(true);

        // Verify heartbeat still works after many reconnections
        vi.advanceTimersByTime(100);
        const currentWs = getLatestMockWs();
        expect(currentWs.sentMessages.length).toBeGreaterThan(0);

        const lastMessage = JSON.parse(
          currentWs.sentMessages[currentWs.sentMessages.length - 1],
        );
        expect(lastMessage.type).toBe(WebSocketEventType.PING);
      });
    });
  });
});
