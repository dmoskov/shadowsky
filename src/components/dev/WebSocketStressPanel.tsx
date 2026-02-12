import { debug } from "@bsky/shared";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Power,
  RefreshCw,
  Send,
  Unplug,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getWebSocketService } from "../../services/websocket-service";
import {
  WebSocketConnectionState,
  type WebSocketDebugState,
} from "../../types/websocket";

// Check if debug mode is enabled
function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem("debug") === "true" ||
    window.location.search.includes("debug=true")
  );
}

// Common WebSocket close codes for testing
const CLOSE_CODES = [
  { code: 1000, label: "Normal", description: "Normal closure" },
  { code: 1001, label: "Going Away", description: "Server shutdown" },
  { code: 1006, label: "Abnormal", description: "Connection lost" },
  { code: 1011, label: "Server Error", description: "Unexpected condition" },
  { code: 1012, label: "Restart", description: "Server restarting" },
  { code: 4001, label: "Auth Failed", description: "Authentication error" },
  { code: 4002, label: "PONG Timeout", description: "Heartbeat timeout" },
];

export function WebSocketStressPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<WebSocketDebugState | null>(null);
  const [latencyInput, setLatencyInput] = useState(0);
  const [packetLossInput, setPacketLossInput] = useState(0);
  const [selectedCloseCode, setSelectedCloseCode] = useState(1006);
  const [floodCount, setFloodCount] = useState(100);
  const [floodInterval, setFloodInterval] = useState(10);
  const [isFlooding, setIsFlooding] = useState(false);
  const [floodProgress, setFloodProgress] = useState(0);

  // Update state periodically
  const updateState = useCallback(() => {
    const service = getWebSocketService();
    if (service) {
      const newState = service._debugGetState();
      setState(newState);
      // Sync inputs with actual values if they differ and user isn't actively editing
      if (
        newState.latency !== latencyInput &&
        document.activeElement?.id !== "latency-slider"
      ) {
        setLatencyInput(newState.latency);
      }
      if (
        newState.packetLoss !== packetLossInput &&
        document.activeElement?.id !== "packet-loss-slider"
      ) {
        setPacketLossInput(newState.packetLoss);
      }
    }
  }, [latencyInput, packetLossInput]);

  // Listen for keyboard shortcut (Ctrl+Shift+W)
  useEffect(() => {
    if (!isDebugMode()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update state on interval when panel is open
  useEffect(() => {
    if (!isOpen) return;
    updateState();
    const interval = setInterval(updateState, 500);
    return () => clearInterval(interval);
  }, [isOpen, updateState]);

  // Don't render if not in debug mode
  if (!isDebugMode()) {
    return null;
  }

  const handleSetLatency = (ms: number) => {
    const service = getWebSocketService();
    if (service) {
      service._debugSetLatency(ms);
      setLatencyInput(ms);
    }
  };

  const handleSetPacketLoss = (percent: number) => {
    const service = getWebSocketService();
    if (service) {
      service._debugSetPacketLoss(percent);
      setPacketLossInput(percent);
    }
  };

  const handleForceDisconnect = () => {
    const service = getWebSocketService();
    if (service) {
      service._debugForceDisconnect(selectedCloseCode);
    }
  };

  const handleForceReconnect = () => {
    const service = getWebSocketService();
    if (service) {
      service._debugForceReconnect();
    }
  };

  const handleFloodMessages = async () => {
    const service = getWebSocketService();
    if (service && !isFlooding) {
      setIsFlooding(true);
      setFloodProgress(0);
      const progressInterval = setInterval(
        () => {
          setFloodProgress((prev) => Math.min(prev + 5, 95));
        },
        (floodCount * floodInterval) / 20,
      );

      try {
        await service._debugFloodMessages(floodCount, floodInterval);
        setFloodProgress(100);
      } catch (error) {
        debug.error("Flood failed:", error);
      } finally {
        clearInterval(progressInterval);
        setTimeout(() => {
          setIsFlooding(false);
          setFloodProgress(0);
        }, 500);
      }
    }
  };

  const handleReset = () => {
    const service = getWebSocketService();
    if (service) {
      service._debugReset();
      setLatencyInput(0);
      setPacketLossInput(0);
    }
  };

  const getStateColor = (
    connectionState?: WebSocketConnectionState,
  ): string => {
    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return "var(--asph-success)";
      case WebSocketConnectionState.DEGRADED:
        return "#f59e0b";
      case WebSocketConnectionState.CONNECTING:
      case WebSocketConnectionState.RECONNECTING:
        return "var(--asph-primary)";
      case WebSocketConnectionState.ERROR:
        return "var(--asph-error)";
      default:
        return "var(--asph-text-tertiary)";
    }
  };

  const getWsReadyStateLabel = (readyState: number | null): string => {
    switch (readyState) {
      case 0:
        return "CONNECTING";
      case 1:
        return "OPEN";
      case 2:
        return "CLOSING";
      case 3:
        return "CLOSED";
      default:
        return "N/A";
    }
  };

  return (
    <>
      {/* Toggle button - always visible in debug mode */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          right: isOpen ? "360px" : "0",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 1001,
          background: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border)",
          borderRight: isOpen ? "1px solid var(--asph-border)" : "none",
          borderRadius: isOpen ? "8px 0 0 8px" : "8px 0 0 8px",
          padding: "12px 8px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          transition: "right 0.3s ease",
        }}
        title="WebSocket Stress Test Panel (Ctrl+Shift+W)"
      >
        {isOpen ? (
          <ChevronRight
            size={16}
            style={{ color: "var(--asph-text-secondary)" }}
          />
        ) : (
          <ChevronLeft
            size={16}
            style={{ color: "var(--asph-text-secondary)" }}
          />
        )}
        <Zap
          size={20}
          style={{
            color:
              state?.connectionState === WebSocketConnectionState.CONNECTED
                ? "var(--asph-success)"
                : state?.connectionState === WebSocketConnectionState.ERROR
                  ? "var(--asph-error)"
                  : "var(--asph-primary)",
          }}
        />
      </button>

      {/* Slide-in drawer panel */}
      <div
        style={{
          position: "fixed",
          right: isOpen ? "0" : "-360px",
          top: 0,
          bottom: 0,
          width: "360px",
          background: "var(--asph-bg-secondary)",
          borderLeft: "1px solid var(--asph-border)",
          zIndex: 1000,
          transition: "right 0.3s ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--asph-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={20} style={{ color: "var(--asph-primary)" }} />
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--asph-text-primary)",
              }}
            >
              WS Stress Test
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} style={{ color: "var(--asph-text-secondary)" }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Connection State */}
          <section>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--asph-text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Connection State
            </h3>
            <div
              style={{
                background: "var(--asph-bg-primary)",
                borderRadius: "8px",
                padding: "12px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Status
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "2px",
                  }}
                >
                  {state?.connectionState ===
                    WebSocketConnectionState.CONNECTED ||
                  state?.connectionState ===
                    WebSocketConnectionState.DEGRADED ? (
                    <Wifi
                      size={14}
                      style={{ color: getStateColor(state?.connectionState) }}
                    />
                  ) : (
                    <WifiOff
                      size={14}
                      style={{ color: getStateColor(state?.connectionState) }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: getStateColor(state?.connectionState),
                    }}
                  >
                    {state?.connectionState || "Unknown"}
                  </span>
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  WebSocket
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                    marginTop: "2px",
                  }}
                >
                  {getWsReadyStateLabel(state?.wsReadyState ?? null)}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Authenticated
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: state?.isAuthenticated
                      ? "var(--asph-success)"
                      : "var(--asph-text-secondary)",
                    marginTop: "2px",
                  }}
                >
                  {state?.isAuthenticated ? "Yes" : "No"}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Reconnects
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                    marginTop: "2px",
                  }}
                >
                  {state?.reconnectAttempts ?? 0}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Sent / Received
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                    marginTop: "2px",
                  }}
                >
                  {state?.messagesSent ?? 0} / {state?.messagesReceived ?? 0}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Latency (avg)
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                    marginTop: "2px",
                  }}
                >
                  {state?.averageLatency ? `${state.averageLatency}ms` : "N/A"}
                </div>
              </div>
            </div>
          </section>

          {/* Latency Simulation */}
          <section>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--asph-text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Gauge size={14} />
              Latency Injection
            </h3>
            <div
              style={{
                background: "var(--asph-bg-primary)",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                  }}
                >
                  Delay: {latencyInput}ms
                </span>
                {latencyInput > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#f59e0b",
                      background: "#f59e0b20",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <input
                id="latency-slider"
                type="range"
                min="0"
                max="5000"
                step="100"
                value={latencyInput}
                onChange={(e) => handleSetLatency(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "var(--asph-primary)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "var(--asph-text-tertiary)",
                  marginTop: "4px",
                }}
              >
                <span>0ms</span>
                <span>1s</span>
                <span>2s</span>
                <span>3s</span>
                <span>4s</span>
                <span>5s</span>
              </div>
              {state?.queuedMessages ? (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  Queued messages: {state.queuedMessages}
                </div>
              ) : null}
            </div>
          </section>

          {/* Packet Loss Simulation */}
          <section>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--asph-text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertTriangle size={14} />
              Packet Loss
            </h3>
            <div
              style={{
                background: "var(--asph-bg-primary)",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--asph-text-primary)",
                  }}
                >
                  Drop Rate: {packetLossInput}%
                </span>
                {packetLossInput > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--asph-error)",
                      background: "var(--asph-error)20",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <input
                id="packet-loss-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={packetLossInput}
                onChange={(e) => handleSetPacketLoss(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "var(--asph-error)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "var(--asph-text-tertiary)",
                  marginTop: "4px",
                }}
              >
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          {/* Disconnect Controls */}
          <section>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--asph-text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Unplug size={14} />
              Disconnect Simulation
            </h3>
            <div
              style={{
                background: "var(--asph-bg-primary)",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "var(--asph-text-secondary)",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Close Code
                </label>
                <select
                  value={selectedCloseCode}
                  onChange={(e) => setSelectedCloseCode(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid var(--asph-border)",
                    background: "var(--asph-bg-secondary)",
                    color: "var(--asph-text-primary)",
                    fontSize: "13px",
                  }}
                >
                  {CLOSE_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.label} ({c.description})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleForceDisconnect}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--asph-error)",
                    background: "transparent",
                    color: "var(--asph-error)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Power size={14} />
                  Disconnect
                </button>
                <button
                  onClick={handleForceReconnect}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--asph-primary)",
                    background: "transparent",
                    color: "var(--asph-primary)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <RefreshCw size={14} />
                  Reconnect
                </button>
              </div>
            </div>
          </section>

          {/* Message Flood */}
          <section>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--asph-text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Send size={14} />
              Message Flood
            </h3>
            <div
              style={{
                background: "var(--asph-bg-primary)",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      color: "var(--asph-text-secondary)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Message Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={floodCount}
                    onChange={(e) => setFloodCount(Number(e.target.value))}
                    disabled={isFlooding}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--asph-border)",
                      background: "var(--asph-bg-secondary)",
                      color: "var(--asph-text-primary)",
                      fontSize: "13px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      color: "var(--asph-text-secondary)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Interval (ms)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={floodInterval}
                    onChange={(e) => setFloodInterval(Number(e.target.value))}
                    disabled={isFlooding}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid var(--asph-border)",
                      background: "var(--asph-bg-secondary)",
                      color: "var(--asph-text-primary)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>
              {isFlooding && (
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      height: "4px",
                      background: "var(--asph-bg-tertiary)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "var(--asph-primary)",
                        width: `${floodProgress}%`,
                        transition: "width 0.1s ease",
                      }}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handleFloodMessages}
                disabled={
                  isFlooding ||
                  state?.connectionState !== WebSocketConnectionState.CONNECTED
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: isFlooding
                    ? "var(--asph-bg-tertiary)"
                    : "var(--asph-primary)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: isFlooding ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  opacity:
                    state?.connectionState !==
                    WebSocketConnectionState.CONNECTED
                      ? 0.5
                      : 1,
                }}
              >
                <Zap size={14} />
                {isFlooding ? `Flooding... ${floodProgress}%` : "Start Flood"}
              </button>
            </div>
          </section>
        </div>

        {/* Footer with reset button */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--asph-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ fontSize: "11px", color: "var(--asph-text-tertiary)" }}
          >
            Ctrl+Shift+W to toggle
          </span>
          <button
            onClick={handleReset}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid var(--asph-border)",
              background: "transparent",
              color: "var(--asph-text-secondary)",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={12} />
            Reset All
          </button>
        </div>
      </div>
    </>
  );
}
