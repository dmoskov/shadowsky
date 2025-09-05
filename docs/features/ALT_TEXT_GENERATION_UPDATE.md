# Alt Text Generation Update

## Overview

We've refactored the alt text generation feature to handle image fetching on the backend instead of the frontend. This eliminates CORS issues and simplifies the frontend code.

## Changes Made

### Backend Changes

1. **New Endpoint**: `/api/generate-alt-text`
   - Accepts POST requests with `imageUrl` and `apiKey`
   - Fetches the image server-side (no CORS issues)
   - Sends image to Anthropic API for analysis
   - Returns generated alt text to frontend

### Frontend Changes

1. **Simplified Flow**:
   - Frontend now sends just the image URL to backend
   - No more blob URL conversion or proxy fetching
   - Cleaner error handling

2. **Updated Components**:
   - `PostRenderer.tsx`
   - `Home.tsx`
   - `ThreadViewer.tsx`

3. **Removed Files**:
   - `src/utils/image-proxy-alt-text.ts` (no longer needed)

## How It Works Now

1. User clicks "Generate alt text" on an image
2. Frontend calls `generateAltText(imageUrl)` with the image URL
3. This sends a POST request to `/api/generate-alt-text`
4. Backend fetches the image and sends it to Anthropic
5. Backend returns the generated alt text
6. Frontend displays the alt text to the user

## Benefits

- **No CORS Issues**: Backend can fetch from any domain
- **Simpler Frontend**: No complex proxy logic or blob conversions
- **Better Security**: API key stays on backend
- **Cleaner Code**: Removed unnecessary utility files

## Configuration

The backend endpoint URL is configured via:
- Production: `VITE_PROXY_SERVER_URL` or defaults to `https://api.shadowsky.io`
- Development: Defaults to `http://localhost:3001`

## SSL/Certificate Note

If you encounter SSL errors with `api.shadowsky.io`, ensure the CloudFront distribution has proper SSL certificates configured for that domain.