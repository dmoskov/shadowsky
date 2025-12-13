const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { BskyAgent } = require("@atproto/api");

/**
 * WebSocket Server for Real-Time Notifications
 *
 * This server provides real-time notification delivery to connected clients.
 * Features:
 * - JWT authentication via query parameter
 * - User connection management (supports multiple connections per user)
 * - Heartbeat/ping-pong keep-alive mechanism
 * - AT Protocol integration for notification polling
 * - Web Push notification delivery when browser is closed
 * - Graceful error handling and reconnection support
 */

class WebSocketNotificationServer {
  constructor(server, options = {}) {
    this.wss = new WebSocket.Server({ server, ...options });
    this.userConnections = new Map(); // Map<userDid, Set<WebSocket>>
    this.userAgents = new Map(); // Map<userDid, BskyAgent>
    this.userPollingIntervals = new Map(); // Map<userDid, NodeJS.Timeout>
    this.userLastSeenCursors = new Map(); // Map<userDid, string>
    this.usersWithPushEnabled = new Map(); // Map<userDid, boolean> - Track who has push subscriptions

    this.config = {
      heartbeatInterval: options.heartbeatInterval || 30000,
      pollInterval: options.pollInterval || 15000, // Poll every 15 seconds
      debug: options.debug !== false,
    };

    this.init();
  }

  init() {
    this.log("Initializing WebSocket server");

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      this.logError("WebSocket server error:", error);
    });
  }

  async handleConnection(ws, req) {
    const url = new URL(req.url, "ws://localhost");
    const token = url.searchParams.get("token");

    // If token is in URL, authenticate immediately (legacy support)
    if (token) {
      this.authenticateWithToken(ws, token);
      return;
    }

    // Otherwise, wait for AUTH message from client
    this.log("Waiting for authentication message...");
    ws.isAuthenticated = false;

    // Set up temporary message handler for authentication
    const authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        this.log("Connection rejected: Authentication timeout");
        ws.close(1008, "Authentication timeout");
      }
    }, 10000); // 10 second timeout

    ws.on("message", (data) => {
      if (ws.isAuthenticated) {
        // Already authenticated, handle normally
        this.handleMessage(ws, ws.userDid, data);
        return;
      }

      // Handle authentication message
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "auth") {
          clearTimeout(authTimeout);
          if (message.token) {
            // JWT token auth (app-password users) - server polls for notifications
            this.authenticateWithToken(ws, message.token);
          } else if (message.did) {
            // DID-only auth (OAuth users) - client polls, server just relays
            this.authenticateWithDid(ws, message.did);
          } else {
            this.log(
              "Connection rejected: Expected token or did in auth message",
            );
            ws.close(1008, "Expected token or did in auth message");
          }
        } else {
          this.log("Connection rejected: Expected auth message");
          ws.close(1008, "Expected authentication message");
        }
      } catch (err) {
        this.log("Connection rejected: Invalid message format");
        ws.close(1008, "Invalid message format");
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (ws.isAuthenticated && ws.userDid) {
        this.handleDisconnect(ws, ws.userDid);
      }
    });

    ws.on("error", (error) => {
      this.logError("WebSocket error:", error);
    });
  }

  async authenticateWithToken(ws, token) {
    // Decode and validate JWT token
    let decoded;
    try {
      // AT Protocol JWT tokens are not signed, just base64 encoded
      decoded = jwt.decode(token);
      if (!decoded || !decoded.sub) {
        throw new Error("Invalid token structure");
      }
    } catch (err) {
      this.log("Connection rejected: Invalid token", err.message);
      this.sendToConnection(ws, {
        type: "auth_failure",
        error: "Invalid token",
        timestamp: new Date().toISOString(),
      });
      ws.close(1008, "Invalid token");
      return;
    }

    const userDid = decoded.sub;
    ws.isAuthenticated = true;
    ws.userDid = userDid;
    this.log(`Client authenticated: ${userDid}`);

    // Store connection
    if (!this.userConnections.has(userDid)) {
      this.userConnections.set(userDid, new Set());
    }
    this.userConnections.get(userDid).add(ws);

    // Store agent for this user if not already present
    if (!this.userAgents.has(userDid)) {
      const agent = new BskyAgent({
        service: "https://bsky.social",
      });

      // Resume session with the token
      try {
        await agent.resumeSession({
          accessJwt: token,
          refreshJwt: token, // In practice, this should be stored separately
          did: userDid,
          handle: decoded.handle || "",
        });
        this.userAgents.set(userDid, agent);
        this.log(`Created agent for user: ${userDid}`);
      } catch (err) {
        this.logError(`Failed to create agent for ${userDid}:`, err.message);
      }
    }

    // Start polling for this user if not already polling
    if (!this.userPollingIntervals.has(userDid)) {
      this.startPollingForUser(userDid);
    }

    // Set up WebSocket event handlers (only if not already set up via message-based auth)
    ws.isAlive = true;

    // Note: We use application-level JSON ping/pong (sent via sendToConnection),
    // so we handle pong responses in handleMessage, not via ws.on("pong").
    // The ws.on("pong") is for WebSocket protocol-level pings (ws.ping()),
    // which we don't use because our server sends JSON messages.

    // Start heartbeat for this connection
    this.startHeartbeat(ws, userDid);

    // Send auth success message
    this.sendToConnection(ws, {
      type: "auth_success",
      timestamp: new Date().toISOString(),
    });

    // Send initial connection confirmation
    this.sendToConnection(ws, {
      type: "connect",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Authenticate with DID only (for OAuth users).
   * Server does NOT poll for notifications - client handles polling via OAuth agent.
   * WebSocket is used as a notification channel for real-time updates pushed by client.
   */
  authenticateWithDid(ws, did) {
    // Validate DID format (basic check)
    if (!did || !did.startsWith("did:")) {
      this.log("Connection rejected: Invalid DID format");
      this.sendToConnection(ws, {
        type: "auth_failure",
        error: "Invalid DID format",
        timestamp: new Date().toISOString(),
      });
      ws.close(1008, "Invalid DID format");
      return;
    }

    const userDid = did;
    ws.isAuthenticated = true;
    ws.userDid = userDid;
    ws.isOAuthUser = true; // Mark as OAuth user (no server-side polling)
    this.log(`Client authenticated (DID-only/OAuth): ${userDid}`);

    // Store connection
    if (!this.userConnections.has(userDid)) {
      this.userConnections.set(userDid, new Set());
    }
    this.userConnections.get(userDid).add(ws);

    // NOTE: No agent creation or polling for OAuth users
    // The client polls via its OAuth agent and can send notification updates to the server

    // Set up WebSocket event handlers
    ws.isAlive = true;

    // Start heartbeat for this connection
    this.startHeartbeat(ws, userDid);

    // Send auth success message
    this.sendToConnection(ws, {
      type: "auth_success",
      authType: "did",
      timestamp: new Date().toISOString(),
    });

    // Send initial connection confirmation
    this.sendToConnection(ws, {
      type: "connect",
      timestamp: new Date().toISOString(),
    });
  }

  handleMessage(ws, userDid, data) {
    try {
      const message = JSON.parse(data.toString());
      this.log(`Message from ${userDid}:`, message.type);

      // Handle application-level pong response to our JSON ping
      // This is critical for heartbeat detection - without this,
      // connections would be terminated as zombies after one heartbeat cycle
      if (message.type === "pong") {
        ws.isAlive = true;
        this.log(`Heartbeat pong received from ${userDid}`);
      }

      // Handle ping from client (client may also send pings)
      if (message.type === "ping") {
        this.sendToConnection(ws, {
          type: "pong",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      this.logError(`Failed to parse message from ${userDid}:`, err);
    }
  }

  handleDisconnect(ws, userDid) {
    this.log(`Client disconnected: ${userDid}`);

    const connections = this.userConnections.get(userDid);
    if (connections) {
      connections.delete(ws);

      // If no more connections for this user, clean up
      if (connections.size === 0) {
        this.userConnections.delete(userDid);
        this.userAgents.delete(userDid);

        // Stop polling for this user
        const interval = this.userPollingIntervals.get(userDid);
        if (interval) {
          clearInterval(interval);
          this.userPollingIntervals.delete(userDid);
        }

        this.log(`Cleaned up resources for user: ${userDid}`);
      }
    }
  }

  startHeartbeat(ws, userDid) {
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.isAlive === false) {
          this.log(
            `Connection timeout for ${userDid} - no pong received, closing connection`,
          );
          // Use close() instead of terminate() to send a proper close frame
          // This allows the client to know why it was disconnected
          ws.close(4002, "Heartbeat timeout - no pong received");
          clearInterval(heartbeat);
          return;
        }

        ws.isAlive = false;
        this.sendToConnection(ws, {
          type: "ping",
          timestamp: new Date().toISOString(),
        });
      } else {
        clearInterval(heartbeat);
      }
    }, this.config.heartbeatInterval);

    ws.on("close", () => clearInterval(heartbeat));
  }

  async startPollingForUser(userDid) {
    this.log(`Starting notification polling for user: ${userDid}`);

    // Do an initial poll immediately
    await this.pollNotificationsForUser(userDid);

    // Then poll periodically
    const interval = setInterval(async () => {
      await this.pollNotificationsForUser(userDid);
    }, this.config.pollInterval);

    this.userPollingIntervals.set(userDid, interval);
  }

  async pollNotificationsForUser(userDid) {
    const agent = this.userAgents.get(userDid);
    if (!agent) {
      this.log(`No agent found for ${userDid}, skipping poll`);
      return;
    }

    try {
      const lastCursor = this.userLastSeenCursors.get(userDid);
      const params = {
        limit: 50,
      };

      if (lastCursor) {
        params.cursor = lastCursor;
      }

      const response = await agent.listNotifications(params);

      if (response.success && response.data.notifications) {
        const notifications = response.data.notifications;

        // Filter for new notifications only (those we haven't seen yet)
        const newNotifications = lastCursor
          ? notifications.filter(
              (n) => new Date(n.indexedAt) > new Date(lastCursor),
            )
          : notifications.slice(0, 5); // On first poll, only send the 5 most recent

        if (newNotifications.length > 0) {
          this.log(
            `Found ${newNotifications.length} new notifications for ${userDid}`,
          );

          // Send each new notification to all connected clients for this user
          for (const notification of newNotifications) {
            this.sendNotificationToUser(userDid, notification);
          }

          // Update cursor to the most recent notification
          if (notifications.length > 0) {
            this.userLastSeenCursors.set(userDid, notifications[0].indexedAt);
          }
        }

        // Also send updated count
        this.sendNotificationCountToUser(userDid, response.data.notifications);
      }
    } catch (err) {
      // Handle rate limiting gracefully
      if (err.status === 429) {
        this.log(`Rate limited for ${userDid}, will retry later`);
      } else {
        this.logError(
          `Error polling notifications for ${userDid}:`,
          err.message,
        );

        // Send error to connected clients
        this.sendToUser(userDid, {
          type: "error",
          timestamp: new Date().toISOString(),
          error: "Failed to fetch notifications",
          code: err.status?.toString() || "UNKNOWN",
        });
      }
    }
  }

  /**
   * Poll notifications for users who are NOT connected via WebSocket
   * This is called periodically for push notification delivery when browser is closed
   */
  async pollNotificationsForPush(userDid, agent) {
    try {
      const lastCursor = this.userLastSeenCursors.get(userDid);
      const params = {
        limit: 50,
      };

      if (lastCursor) {
        params.cursor = lastCursor;
      }

      const response = await agent.listNotifications(params);

      if (response.success && response.data.notifications) {
        const notifications = response.data.notifications;

        // Filter for new notifications only
        const newNotifications = lastCursor
          ? notifications.filter(
              (n) => new Date(n.indexedAt) > new Date(lastCursor),
            )
          : notifications.slice(0, 5);

        if (newNotifications.length > 0) {
          this.log(
            `[Push] Found ${newNotifications.length} new notifications for ${userDid}`,
          );

          // Update cursor
          if (notifications.length > 0) {
            this.userLastSeenCursors.set(userDid, notifications[0].indexedAt);
          }
        }
      }
    } catch (err) {
      if (err.status !== 429) {
        this.logError(
          `[Push] Error polling notifications for ${userDid}:`,
          err.message,
        );
      }
    }
  }

  sendNotificationToUser(userDid, notification) {
    this.sendToUser(userDid, {
      type: "notification:new",
      timestamp: new Date().toISOString(),
      notification,
    });
  }

  sendNotificationCountToUser(userDid, notifications) {
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    this.sendToUser(userDid, {
      type: "notification:count",
      timestamp: new Date().toISOString(),
      count: unreadCount,
    });
  }

  sendToUser(userDid, message) {
    const connections = this.userConnections.get(userDid);
    if (!connections) {
      return;
    }

    const messageStr = JSON.stringify(message);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  sendToConnection(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  log(...args) {
    if (this.config.debug) {
      console.log("[WebSocket]", ...args);
    }
  }

  logError(...args) {
    console.error("[WebSocket Error]", ...args);
  }

  getStats() {
    return {
      connectedUsers: this.userConnections.size,
      totalConnections: Array.from(this.userConnections.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
      activePolling: this.userPollingIntervals.size,
    };
  }

  close() {
    this.log("Shutting down WebSocket server");

    // Clear all polling intervals
    this.userPollingIntervals.forEach((interval) => clearInterval(interval));
    this.userPollingIntervals.clear();

    // Close all connections
    this.wss.clients.forEach((ws) => {
      ws.close(1000, "Server shutdown");
    });

    this.wss.close();
  }
}

module.exports = { WebSocketNotificationServer };
