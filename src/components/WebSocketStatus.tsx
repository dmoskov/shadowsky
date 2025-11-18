import { Activity, AlertCircle, CheckCircle, WifiOff } from "lucide-react";
import React, { useState } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { WebSocketConnectionState } from "../types/websocket";

export const WebSocketStatus: React.FC = () => {
  const { isConnected, connectionState, stats, reconnect } = useWebSocket();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case WebSocketConnectionState.CONNECTING:
      case WebSocketConnectionState.RECONNECTING:
        return <Activity className="h-4 w-4 animate-pulse text-yellow-500" />;
      case WebSocketConnectionState.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return "Connected";
      case WebSocketConnectionState.CONNECTING:
        return "Connecting...";
      case WebSocketConnectionState.RECONNECTING:
        return `Reconnecting... (${stats.reconnectAttempts})`;
      case WebSocketConnectionState.ERROR:
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return "bg-green-500";
      case WebSocketConnectionState.CONNECTING:
      case WebSocketConnectionState.RECONNECTING:
        return "bg-yellow-500";
      case WebSocketConnectionState.ERROR:
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 lg:bottom-4">
      <div
        className={`rounded-lg border shadow-lg transition-all duration-200 ${isExpanded ? "w-64" : "w-auto"} `}
        style={{
          background: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border)",
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-2 p-3 text-left hover:opacity-80"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {getStatusIcon()}
          {isExpanded && (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{getStatusText()}</span>
                <div
                  className={`h-2 w-2 rounded-full ${getStatusColor()} ${
                    connectionState === "connecting" ||
                    connectionState === "reconnecting"
                      ? "animate-pulse"
                      : ""
                  }`}
                />
              </div>
            </div>
          )}
        </button>

        {isExpanded && (
          <div
            className="border-t px-3 py-2 text-xs"
            style={{
              borderColor: "var(--bsky-border)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            <div className="space-y-1">
              {stats.connectedAt && (
                <div>
                  Connected: {new Date(stats.connectedAt).toLocaleTimeString()}
                </div>
              )}
              <div>Messages Sent: {stats.messagesSent}</div>
              <div>Messages Received: {stats.messagesReceived}</div>
              {stats.reconnectAttempts > 0 && (
                <div>Reconnect Attempts: {stats.reconnectAttempts}</div>
              )}
              {stats.lastError && (
                <div className="text-red-500">Error: {stats.lastError}</div>
              )}
            </div>

            {!isConnected && (
              <button
                onClick={reconnect}
                className="mt-2 w-full rounded px-2 py-1 text-xs font-medium transition-colors"
                style={{
                  background: "var(--bsky-primary)",
                  color: "white",
                }}
              >
                Reconnect
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
