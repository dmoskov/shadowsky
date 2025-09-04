# Media Processing Server

This server provides endpoints for:
1. Converting GIF images to MP4 videos for Bluesky uploads
2. Proxying images from external sources to avoid CORS issues

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

2. Start the server:
```bash
npm start
# or for development with auto-restart:
npm run dev
```

The server will run on port 3002 by default.

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

- `PORT`: Server port (default: 3002)

## Notes

- This is a development-only feature
- The server must be running locally when using GIF conversion in the app
- GIFs are converted to MP4 with H.264 encoding for maximum compatibility
- The conversion preserves animation and optimizes for web streaming