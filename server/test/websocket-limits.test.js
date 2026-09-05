const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  DEFAULT_MAX_PAYLOAD_BYTES,
  WebSocketNotificationServer,
} = require("../websocket-server");

test("WebSocket server applies a conservative payload limit by default", () => {
  const httpServer = http.createServer();
  const websocketServer = new WebSocketNotificationServer(httpServer, {
    debug: false,
  });

  assert.equal(
    websocketServer.wss.options.maxPayload,
    DEFAULT_MAX_PAYLOAD_BYTES,
  );

  websocketServer.close();
  httpServer.close();
});

test("WebSocket payload limit remains configurable", () => {
  const httpServer = http.createServer();
  const websocketServer = new WebSocketNotificationServer(httpServer, {
    debug: false,
    maxPayload: 32 * 1024,
  });

  assert.equal(websocketServer.wss.options.maxPayload, 32 * 1024);

  websocketServer.close();
  httpServer.close();
});
