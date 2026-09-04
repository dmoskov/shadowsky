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
- `ANTHROPIC_API_KEY`: Required for AI features

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

## Notes

- This is a development-only feature
- The server must be running locally when using GIF conversion in the app
- GIFs are converted to MP4 with H.264 encoding for maximum compatibility
- The conversion preserves animation and optimizes for web streaming