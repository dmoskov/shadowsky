# ShadowSky Backend Server

This server provides:
1. **WebSocket Server**: Real-time notification delivery (port 3001)
2. **API Endpoints**: Media processing, AI features, and image proxying (port 3002)

## Features

### WebSocket Server (Port 3001)
- Real-time notification delivery without polling
- JWT authentication via query parameter
- Automatic reconnection support
- Heartbeat/ping-pong mechanism
- Multi-device support (multiple connections per user)

See [WEBSOCKET.md](./WEBSOCKET.md) for detailed documentation.

### API Server (Port 3002)
- GIF to MP4 conversion for Bluesky uploads
- Image proxying to avoid CORS issues
- AI-powered writing feedback
- Alt text generation
- Style analysis
- Tone adjustment
- Thread optimization
- Hashtag suggestions

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed on your system:
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Configure environment variables:
```bash
# In parent directory .env file
VITE_WS_URL=ws://localhost:3001  # Enable WebSocket in frontend
```

3. Start the server:
```bash
npm start
# or for development with auto-restart:
npm run dev
```

This will start:
- WebSocket server on `ws://localhost:3001`
- API server on `http://localhost:3002`

## API Endpoints

### 1. POST /api/convert-gif

Converts a GIF to MP4 format.

**Request Body:**
```json
{
  "gifUrl": "https://example.com/image.gif"
}
```

Or with a data URL:
```json
{
  "gifUrl": "data:image/gif;base64,..."
}
```

**Response:**
- Success: Returns the MP4 video file as binary data with `Content-Type: video/mp4`
- Error: Returns JSON with error details

### 2. GET /api/proxy-image

Proxies images from external sources to avoid CORS issues.

**Query Parameters:**
- `url` (required): The URL of the image to proxy

**Example:**
```
GET /api/proxy-image?url=https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:example/image.jpeg
```

**Response:**
- Success: Returns the image with appropriate CORS headers
- Error: Returns JSON with error details

This endpoint is primarily used for fetching images from Bluesky's CDN for alt text generation.

## Environment Variables

- `PORT`: API server port (default: 3002)
- `WS_PORT`: WebSocket server port (default: 3001)

### Anthropic credentials

Local dev: set `ANTHROPIC_API_KEY`. Production uses Workload Identity
Federation instead of a stored key (`utils/anthropic-client.js`): the task
asks AWS STS for an OIDC token asserting its IAM role (`GetWebIdentityToken`,
audience `https://api.anthropic.com`) and exchanges it at
`POST /v1/oauth/token` for a short-lived access token. Requires
`sts:GetWebIdentityToken` on the task role, outbound web identity federation
enabled on the AWS account, and a federation rule in the Claude Console
matching the task role ARN. `ANTHROPIC_API_KEY`, if set, always wins.

- `ANTHROPIC_FEDERATION_RULE_ID`: `fdrl_...` rule matching the task role
- `ANTHROPIC_ORGANIZATION_ID`: Anthropic organization UUID
- `ANTHROPIC_SERVICE_ACCOUNT_ID`: `svac_...` the rule targets
- `ANTHROPIC_WORKSPACE_ID`: `wrkspc_...`; only required if the rule spans
  more than one workspace

A denied exchange is an opaque 401 by design — the reason is under
Console → Settings → Workload identity → History.

### Authentication

Clients authenticate to protected routes with an AT Protocol service-auth
token (`Authorization: Bearer <jwt>`) minted by the user's PDS via
`com.atproto.server.getServiceAuth`. The server verifies the signature
against the account's DID document (`middleware/atproto-service-auth.js`).

- `API_SERVICE_DID`: The `aud` tokens must be minted for (default
  `did:web:api.asphodel.is`; must match `API_SERVICE_DID` in
  `packages/core/src/api-auth.ts`)
- `ALLOW_UNSIGNED_DID_AUTH`: Rollout flag. While not `"false"`, the legacy
  unverified `X-User-DID` header is still accepted (and logged as
  `did-unsigned`). Set to `"false"` once all clients send service-auth tokens.
- `PLC_DIRECTORY_URL`: Override for DID resolution (default plc.directory)

### AI abuse controls

Request rate limits are per IP (30/min) and per account (20/min). Spend is
capped in tokens (`utils/ai-budget.js`); counters are in-memory per task:

- `AI_USER_DAILY_TOKEN_BUDGET`: Per-account tokens per UTC day (default 500000)
- `AI_GLOBAL_DAILY_TOKEN_BUDGET`: Service-wide tokens per UTC day (default 25000000)
- `AI_MAX_REQUEST_TOKENS`: Max estimated tokens for one request (default 120000)

Every model call emits one JSON log line (`t: "ai"`) with the endpoint,
user, auth method, and token counts for CloudWatch Logs Insights.

Each call also sends `metadata.user_id` — a salted SHA-256 of the caller's
DID — so Anthropic can attribute abuse to the end user rather than to us.
Prompts are fixed per endpoint (caller text is passed as tagged data), and
every JSON response is conformed to a declared shape with length caps, so
the routes can't be repurposed as a general-purpose model proxy.

- `AI_ATTRIBUTION_SALT`: Salt for `metadata.user_id` (set in production so
  the hash isn't reproducible from a public DID)
- `AI_BLOCKED_DIDS`: Comma-separated DIDs that get 403 from AI routes —
  the switch for cutting off an identified abuser without a deploy

## Notes

- This is a development-only feature
- The server must be running locally when using GIF conversion in the app
- GIFs are converted to MP4 with H.264 encoding for maximum compatibility
- The conversion preserves animation and optimizes for web streaming