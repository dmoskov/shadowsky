# Image Proxy Setup for Alt Text Generation

## Overview

To enable alt text generation for external images in production, we've implemented a server-side proxy that fetches images from external sources (like Bluesky's CDN) and returns them with proper CORS headers.

## Architecture

### Components

1. **Server-side Proxy** (`server/gif-converter.js`)
   - New endpoint: `GET /api/proxy-image`
   - Fetches images from external URLs
   - Returns images with CORS headers
   - Caches images for 1 hour

2. **Proxy Utility** (`src/utils/image-proxy-alt-text.ts`)
   - Determines when to use the proxy (production only)
   - Constructs proxy URLs
   - Fetches images through the proxy

3. **Component Updates**
   - `PostRenderer.tsx`, `Home.tsx`, `ThreadViewer.tsx`
   - Use `fetchImageThroughProxy()` instead of direct fetch
   - Removed CORS error messages

## Configuration

### Environment Variables

Add to your `.env.local` or production environment:

```bash
# URL of your proxy server
VITE_PROXY_SERVER_URL=https://api.shadowsky.io
```

### Server Setup

1. Deploy the server code from `/server`
2. Ensure the server has CORS configured for your domains
3. Update `VITE_PROXY_SERVER_URL` to point to your server

## How It Works

1. User clicks "Generate alt text" on an image
2. Frontend checks if running in production
3. If yes, constructs proxy URL: `https://api.shadowsky.io/api/proxy-image?url={imageUrl}`
4. Proxy server fetches the image from the CDN
5. Returns image with CORS headers allowing browser access
6. Frontend converts to blob and generates alt text

## Security Considerations

- The proxy validates that URLs are provided
- Implements proper error handling
- Sets appropriate cache headers
- Only proxies image content types

## Testing

### Local Development

- Works directly without proxy (Vite handles CORS)
- Set `VITE_PROXY_SERVER_URL` to test proxy locally

### Production

- Ensure proxy server is running
- Check browser console for any CORS errors
- Verify alt text generation works for CDN images

## Deployment

1. Deploy server to your hosting platform
2. Set environment variables in production
3. Update CORS origins in server if needed
4. Test with production URLs

## Troubleshooting

### Common Issues

1. **"Failed to fetch image"**
   - Check proxy server is running
   - Verify VITE_PROXY_SERVER_URL is set correctly
   - Check network tab for proxy requests

2. **CORS errors still appearing**
   - Ensure server CORS includes your domain
   - Check proxy response headers
   - Verify proxy URL construction

3. **Slow image loading**
   - Proxy adds latency
   - Consider implementing caching
   - Check server location vs users
