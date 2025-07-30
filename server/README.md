# GIF to MP4 Converter Server

This server provides an endpoint to convert GIF images to MP4 videos, which is required for uploading animated content to Bluesky.

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

### POST /api/convert-gif

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

## Environment Variables

- `PORT`: Server port (default: 3002)

## Notes

- This is a development-only feature
- The server must be running locally when using GIF conversion in the app
- GIFs are converted to MP4 with H.264 encoding for maximum compatibility
- The conversion preserves animation and optimizes for web streaming